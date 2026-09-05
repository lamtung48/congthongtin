import "server-only";
import { forbidden } from "next/navigation";
import { requireSession, type SessionUser } from "./session";
import { hasPermission, type Permission } from "./permissions";

/**
 * Brief section 6: "Nếu đăng nhập nhưng không đủ quyền: → trả forbidden/
 * unauthorized page phù hợp." `forbidden()` is Next.js's own documented
 * primitive for exactly this (`node_modules/next/dist/docs/.../forbidden.md`)
 * — it throws a real 403, rendered by `src/app/admin/forbidden.tsx`, rather
 * than this app hand-rolling a redirect or a plain "you can't be here" div
 * that still returns HTTP 200. Requires `experimental.authInterrupts` in
 * `next.config.ts` (enabled specifically for this).
 *
 * These are the only functions any admin Server Component, Server Action,
 * or Route Handler should call to authorize itself — see
 * docs/AUTHORIZATION.md, "Route guard" and "Server authorization" for why
 * every one of them (not just the top-level layout) does its own check.
 */

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const session = await requireSession();
  if (!hasPermission(session.role, permission)) {
    forbidden();
  }
  return session;
}

export async function requireAnyPermission(permissions: Permission[]): Promise<SessionUser> {
  const session = await requireSession();
  if (!permissions.some((p) => hasPermission(session.role, p))) {
    forbidden();
  }
  return session;
}

/** For the rare check that isn't really "can do X" but "is this exact
 *  role" (e.g. only ADMIN may ever reach `/admin/users`, regardless of any
 *  future permission split). Prefer `requirePermission` when the check is
 *  actually about a capability. */
export async function requireRole(role: SessionUser["role"]): Promise<SessionUser> {
  const session = await requireSession();
  if (session.role !== role) {
    forbidden();
  }
  return session;
}
