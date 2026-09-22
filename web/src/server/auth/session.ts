import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hsvIdSsoLogoutAll, hsvIdSsoValidate, type HsvCompleteness, type HsvSsoUser } from "@/server/integrations/hsvId";
import { matchLocalUser } from "@/server/auth/identityLink";
import { userRepository } from "@/server/repositories/userRepository";
import type { AdminRole, UserStatus } from "@/generated/prisma/client";

/**
 * The CMS session IS the shared SSO session of `hsv-id` (docs/AUTHENTICATION.md,
 * "SSO (hsv-id)"). The cookie `hsv_sso` holds an opaque token; `hsv-id` keeps
 * the session (log out anywhere = logged out everywhere; lock / soft-delete /
 * password change revoke it at once). Every request validates the token
 * against `hsv-id` — with a SHORT cache (30 s) so a lock or logout done on
 * another platform takes effect here within ~30 s, not on the next login.
 *
 * What stays local: the `User` row (ROLE, status, authorship). Its `status`
 * is re-read from the database on every request (no cache), so an Admin
 * disabling a CMS account still blocks it immediately — disabling here does
 * NOT sign the person out of the other platforms.
 *
 * SSO_COOKIE_DOMAIN (optional): ".hoisinhvien.com.vn" in production makes
 * platforms on the same parent domain share the cookie (sign in once, in
 * everywhere). Unset = host-only cookie (safe for staging/dev).
 */

export const SSO_COOKIE = "hsv_sso";
const LEGACY_COOKIE = "admin_session"; // pre-SSO opaque session cookie — cleared on login/logout
const CACHE_TTL_MS = 30_000;
const CACHE_MAX_ENTRIES = 2000;

type Validated = { user: HsvSsoUser; completeness: HsvCompleteness };
// On globalThis, NOT a module-level Map: Next can load this module as several separate copies (route handlers, server actions, pages), and
// a per-copy Map makes "invalidate after saving the profile" invisible to the page that renders next (seen on the Hoạt động staging).
const globalForSso = globalThis as unknown as { __cmsSsoValidationCache?: Map<string, { at: number; value: Validated }> };
const validationCache = (globalForSso.__cmsSsoValidationCache ??= new Map<string, { at: number; value: Validated }>());

function cookieDomain(): string | undefined {
  return process.env.SSO_COOKIE_DOMAIN || undefined;
}

function cacheSet(token: string, value: Validated) {
  if (validationCache.size >= CACHE_MAX_ENTRIES) validationCache.delete(validationCache.keys().next().value as string);
  validationCache.set(token, { at: Date.now(), value });
}

/** Drop the cached validation of a token (after the profile was saved, so the next read sees fresh data + completeness). */
export function invalidateSsoCache(token: string) {
  validationCache.delete(token);
}

/** Drop every cached validation of one hsv-id account (password reset / forced logout done from here). */
export function invalidateSsoCacheForIdentity(identityUserId: string) {
  for (const [token, entry] of validationCache) if (entry.value.user.id === identityUserId) validationCache.delete(token);
}

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  role: AdminRole;
  status: UserStatus;
}

/** Sets the SSO cookie after `hsv-id` accepted the credentials (`authService.login`) — no authentication happens here. */
export async function createSession(token: string, expiresAt: Date): Promise<void> {
  const store = await cookies();
  store.set(SSO_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    ...(cookieDomain() ? { domain: cookieDomain() } : {}),
  });
  store.delete(LEGACY_COOKIE);
}

/** The current SSO token (for the profile view/edit actions, which act at `hsv-id` on the person's behalf). */
export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SSO_COOKIE)?.value ?? null;
}

export type SsoIdentity =
  | { ok: true; user: HsvSsoUser; completeness: HsvCompleteness }
  | { ok: false; reason: "NO_SESSION" | "BLOCKED" | "HSV_ID_UNAVAILABLE" };

/** Who `hsv-id` says the cookie belongs to. React `cache`: layout + page of one request validate once. */
export const getSsoIdentity = cache(async (): Promise<SsoIdentity> => {
  const token = await getSessionToken();
  if (!token) return { ok: false, reason: "NO_SESSION" };

  const cached = validationCache.get(token);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return { ok: true, ...cached.value };

  const result = await hsvIdSsoValidate(token);
  if (!result.ok) {
    validationCache.delete(token);
    return { ok: false, reason: result.reason === "INVALID" ? "NO_SESSION" : result.reason === "BLOCKED" ? "BLOCKED" : "HSV_ID_UNAVAILABLE" };
  }
  cacheSet(token, { user: result.user, completeness: result.completeness });
  return { ok: true, user: result.user, completeness: result.completeness };
});

/**
 * The DAL's core check (Next's own auth guide, "Creating a Data Access
 * Layer"). `null` for every invalid case: no cookie, session gone/expired at
 * `hsv-id`, hsv-id unreachable, no local CMS account linked to that identity,
 * or the local account disabled. Never creates or links anything (linking
 * with proof happens only in `authService.login`).
 */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const identity = await getSsoIdentity();
  if (!identity.ok) return null;

  const match = await matchLocalUser(identity.user);
  if (match.kind !== "linked") return null;
  const user = match.user;

  // Brief section 13: "account disabled check" — re-checked on every request (local DB, uncached).
  if (user.status !== "ACTIVE") return null;

  // The shared profile is the source of the display name: a change made on another platform shows here too.
  let displayName = user.displayName;
  if (identity.user.fullName && identity.user.fullName !== user.displayName) {
    displayName = identity.user.fullName;
    void userRepository.update(user.id, { displayName }).catch(() => {});
  }

  return { id: user.id, email: user.email, displayName, role: user.role, status: user.status };
});

/** Ends the SSO session for EVERY platform (logout here = logout everywhere) and clears the cookie. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SSO_COOKIE)?.value;
  if (token) {
    validationCache.delete(token);
    await hsvIdSsoLogoutAll({ token }).catch((err) => console.error("[hsv-id] đăng xuất SSO thất bại:", err));
  }
  store.set(SSO_COOKIE, "", { path: "/", maxAge: 0, ...(cookieDomain() ? { domain: cookieDomain() } : {}) });
  store.delete(LEGACY_COOKIE);
}

/**
 * For "an Admin reset this account's password". The sessions themselves live
 * in `hsv-id` and its `change-password` already revoked them; what remains
 * is this process's 30 s validation cache. (Disabling a CMS account needs
 * nothing: `getSession` re-reads the local status on every request.)
 */
export async function destroyAllSessionsForUser(userId: string): Promise<void> {
  const target = await userRepository.findIdentitySyncFields(userId);
  if (target?.identityUserId) invalidateSsoCacheForIdentity(target.identityUserId);
}

/** Where the editorial ("Ban biên tập") sign-in lives — the shared `/dang-nhap` page, editorial tab. */
export const EDITORIAL_LOGIN_PATH = "/dang-nhap?luong=bien-tap";

/**
 * Brief section 6: "Nếu chưa đăng nhập: → redirect về trang đăng nhập." The
 * one function every protected admin Server Component/Server Action should
 * call first — see docs/AUTHORIZATION.md, "Route guard".
 *
 * Since sign-in was split into a PERSONAL and an EDITORIAL flow
 * (docs/AUTHENTICATION.md, "Hai luồng đăng nhập"), a bare SSO session — a
 * personal account signed in here or on Hoạt động / Đào tạo — never gets a
 * CMS account by opening `/admin`: it is sent to the editorial sign-in. CMS
 * roles are granted only by an Admin (`userService.grantRole`).
 */
export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (session) return session;
  redirect(EDITORIAL_LOGIN_PATH);
}
