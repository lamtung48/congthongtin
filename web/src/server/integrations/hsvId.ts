import "server-only";

/**
 * Client for the shared Identity service `hsv-id` (/opt/hsv-id on the VPS).
 *
 * `hsv-id` is NOT SSO — this CMS still issues and validates its own
 * database-backed sessions (docs/AUTHENTICATION.md). `hsv-id` only owns the
 * canonical password + root profile shared with the other HSV platforms
 * (`hoinghi`, `daotaohsv`), so the same person uses one password everywhere.
 *
 * Fault-tolerant by design: if `hsv-id` is unreachable, every function here
 * returns `null`/`false` instead of throwing, and the caller MUST fall back
 * to the local `User.passwordHash`. This CMS never hard-depends on `hsv-id`
 * being up. Same contract as `/opt/hoinghi/apps/api/src/lib/hsv-id.ts` and
 * `/opt/daotaohsv/src/lib/hsv-id.ts`.
 *
 * The API is internal-only (docker network, never public) and authenticated
 * with the shared `X-Internal-Key` header.
 */

const HSV_ID_URL = process.env.HSV_ID_URL;
const HSV_ID_INTERNAL_KEY = process.env.HSV_ID_INTERNAL_KEY;

/** PlatformLink.platform value that identifies this CMS inside `hsv-id`. */
const PLATFORM = "congthongtin";

export function hsvIdConfigured(): boolean {
  return Boolean(HSV_ID_URL && HSV_ID_INTERNAL_KEY);
}

async function call(path: string, init: RequestInit): Promise<{ status: number; body: any } | null> {
  if (!hsvIdConfigured()) return null;
  try {
    const res = await fetch(`${HSV_ID_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", "X-Internal-Key": HSV_ID_INTERNAL_KEY!, ...init.headers },
      // Never let a slow/hung identity service stall a login request.
      signal: AbortSignal.timeout(5000),
    });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  } catch (err) {
    console.error("[hsv-id] gọi thất bại, dùng dữ liệu cục bộ:", err);
    return null;
  }
}

/**
 * Verify a password against `hsv-id`.
 * - `true`  — correct.
 * - `false` — `hsv-id` explicitly rejected it (HTTP 401).
 * - `null`  — undetermined: `hsv-id` unreachable, or the account isn't in
 *   `hsv-id` yet (404), or it's locked there (423). The caller falls back
 *   to the local `passwordHash`.
 */
export async function hsvIdVerifyPassword(identifier: string, password: string): Promise<boolean | null> {
  const res = await call("/internal/verify-credentials", {
    method: "POST",
    body: JSON.stringify({ identifier, password }),
  });
  if (!res) return null;
  if (res.status === 200) return true;
  if (res.status === 401) return false;
  return null;
}

export interface HsvIdUser {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string;
  status: string;
}

/**
 * Like `hsvIdVerifyPassword` but returns the full `hsv-id` account on
 * success (HTTP 200), else `null`. Used to:
 *  - link a pre-existing `hsv-id` account (created from another platform)
 *    to a local row, and
 *  - auto-provision a local CONTRIBUTOR for someone who has an `hsv-id`
 *    account (i.e. a hoinghi/daotaohsv user) but no CMS account yet.
 */
export async function hsvIdVerifyAndGetUser(identifier: string, password: string): Promise<HsvIdUser | null> {
  const res = await call("/internal/verify-credentials", {
    method: "POST",
    body: JSON.stringify({ identifier, password }),
  });
  if (res?.status !== 200) return null;
  const u = res.body?.user;
  if (!u?.id) return null;
  return { id: u.id, email: u.email ?? null, phone: u.phone ?? null, fullName: u.fullName ?? "", status: u.status ?? "ACTIVE" };
}

/** Attach this CMS to an existing `hsv-id` account. Returns whether the
 *  link now exists (201, or 409 = already linked — both are "linked"). */
export async function hsvIdLink(identityUserId: string, platformUserId: string): Promise<boolean> {
  const res = await call(`/internal/users/${identityUserId}/link`, {
    method: "POST",
    body: JSON.stringify({ platform: PLATFORM, platformUserId }),
  });
  return res?.status === 201 || res?.status === 409;
}

/**
 * Create an `hsv-id` account and link it to this CMS's local `User.id`.
 * Returns the new `hsv-id` user id, or `null` on any failure — callers must
 * NOT block login/user-creation on this.
 *
 * A 409 (the email already belongs to a different `hsv-id` account, usually
 * one created from another platform) deliberately does NOT auto-`/link`
 * here — same call as `hoinghi` makes: auto-linking would swap this
 * person's working local password for a different platform's, with no way
 * back. An Admin resolves those by hand via the `hsv-id` API.
 */
export async function hsvIdCreateUser(input: {
  email?: string | null;
  password: string;
  fullName: string;
  platformUserId: string;
}): Promise<string | null> {
  const res = await call("/internal/users", {
    method: "POST",
    body: JSON.stringify({
      email: input.email ?? undefined,
      password: input.password,
      fullName: input.fullName,
      platform: PLATFORM,
      platformUserId: input.platformUserId,
    }),
  });
  if (res?.status === 201) return (res.body?.user?.id as string | undefined) ?? null;
  if (res && res.status !== 409) {
    console.error("[hsv-id] tạo tài khoản thất bại:", res.status, res.body);
  }
  return null;
}

/** Push a new password to `hsv-id`. Returns whether it took effect there. */
export async function hsvIdChangePassword(identityUserId: string, newPassword: string): Promise<boolean> {
  const res = await call(`/internal/users/${identityUserId}/change-password`, {
    method: "POST",
    body: JSON.stringify({ newPassword }),
  });
  return res?.status === 200;
}
