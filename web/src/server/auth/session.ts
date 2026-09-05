import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { sessionRepository } from "@/server/repositories/sessionRepository";
import type { AdminRole, UserStatus } from "@/generated/prisma/client";

/**
 * Database-backed sessions (brief section 5: "Sử dụng session server-side").
 * The cookie holds only an opaque random token — never a JWT, never any
 * encoded user data. Every request that needs the session re-validates
 * against the `Session` table (and the owning `User`'s current `status`),
 * so disabling an account takes effect on that account's very next request,
 * not whenever a signed token happens to expire. This is deliberately the
 * heavier-but-simpler option Next's own auth guide calls "Database Sessions"
 * — see docs/AUTHENTICATION.md, "Why database sessions, not JWT" for why
 * this was chosen over `jose`/stateless signing.
 */

const COOKIE_NAME = "admin_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, fixed from creation — see docs/AUTHENTICATION.md.

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  role: AdminRole;
  status: UserStatus;
}

async function readRequestMeta() {
  const h = await headers();
  return {
    userAgent: h.get("user-agent"),
    // `x-forwarded-for` is set by whatever reverse proxy sits in front of
    // the app in production; falls back to nothing locally rather than
    // guessing at a header that isn't there.
    ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  };
}

/**
 * Creates a session row and sets the cookie. Called only after credentials
 * are already verified (`authService.login`) — this function itself does
 * no authentication, only session issuance.
 */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const meta = await readRequestMeta();

  await sessionRepository.create({
    userId,
    tokenHash,
    expiresAt,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * The DAL's core check (Next's own auth guide, "Creating a Data Access
 * Layer"). `cache()` memoizes this per render pass so a page that reads the
 * session from several components/layouts only hits the database once.
 * Returns `null` for every invalid case (no cookie, expired session,
 * disabled account) — callers decide what to do about `null`
 * (`requireSession`/`requireRole` below redirect/forbid; a page that wants
 * to render differently for logged-out visitors can check it directly).
 */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const session = await sessionRepository.findByTokenHashWithUser(tokenHash);
  if (!session) return null;

  if (session.expiresAt < new Date()) {
    await sessionRepository.deleteByTokenHash(tokenHash);
    return null;
  }

  // Brief section 13: "account disabled check" — re-checked on every
  // request, not just at login, so disabling an account invalidates an
  // already-open session immediately rather than at its next natural
  // expiry.
  if (session.user.status !== "ACTIVE") {
    return null;
  }

  // Best-effort activity timestamp — failure here (e.g. a race with the
  // session being deleted concurrently) must never fail the request that
  // triggered it.
  void sessionRepository.touchLastSeen(session.id);

  return {
    id: session.user.id,
    email: session.user.email,
    displayName: session.user.displayName,
    role: session.user.role,
    status: session.user.status,
  };
});

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await sessionRepository.deleteByTokenHash(hashToken(token));
  }
  cookieStore.delete(COOKIE_NAME);
}

/** For "log out everywhere" / an Admin disabling a user mid-session. */
export async function destroyAllSessionsForUser(userId: string): Promise<void> {
  await sessionRepository.deleteAllForUser(userId);
}

/**
 * Brief section 6: "Nếu chưa đăng nhập: → redirect về /admin/login." The
 * one function every protected admin Server Component/Server Action should
 * call first — see docs/AUTHORIZATION.md, "Route guard".
 */
export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    redirect("/admin/login");
  }
  return session;
}
