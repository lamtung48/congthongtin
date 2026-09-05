import { userRepository } from "@/server/repositories/userRepository";
import { auditLogRepository } from "@/server/repositories/auditLogRepository";
import { createSession, destroySession, getSession } from "@/server/auth/session";
import { verifyPassword } from "@/server/auth/password";
import { checkLoginRateLimit, clearLoginRateLimit, recordFailedLogin } from "@/server/auth/rateLimit";

/**
 * Brief section 4: the one error message every failure path returns —
 * "Thông tin đăng nhập không chính xác." never distinguishes "no such
 * account", "wrong password", or "account disabled", so none of those facts
 * leaks to whoever is submitting the form. See docs/AUTHENTICATION.md,
 * "Login error messages".
 */
const GENERIC_LOGIN_ERROR = "Thông tin đăng nhập không chính xác.";
const RATE_LIMITED_ERROR = "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau ít phút.";

export type LoginResult = { ok: true } | { ok: false; error: string };

export const authService = {
  async login(identifier: string, password: string, requestIp: string | null): Promise<LoginResult> {
    const rateLimitKey = `${identifier.toLowerCase()}:${requestIp ?? "unknown"}`;
    const rateLimit = checkLoginRateLimit(rateLimitKey);
    if (!rateLimit.allowed) {
      return { ok: false, error: RATE_LIMITED_ERROR };
    }

    const user = await userRepository.findByEmailOrUsernameWithHash(identifier);

    // Same generic failure for "no such user", "wrong password", and
    // "disabled account" — a different message per case would let an
    // attacker enumerate valid emails or disabled accounts, exactly what
    // brief section 4 warns against generalizing from (it names the
    // password case explicitly; the same principle applies to the other
    // two).
    if (!user || user.status !== "ACTIVE") {
      recordFailedLogin(rateLimitKey);
      return { ok: false, error: GENERIC_LOGIN_ERROR };
    }

    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      recordFailedLogin(rateLimitKey);
      return { ok: false, error: GENERIC_LOGIN_ERROR };
    }

    clearLoginRateLimit(rateLimitKey);
    await createSession(user.id);
    await userRepository.touchLastLogin(user.id);
    await auditLogRepository.record({ actorId: user.id, action: "LOGIN", entityType: "User", entityId: user.id });

    return { ok: true };
  },

  async logout(): Promise<void> {
    const session = await getSession();
    await destroySession();
    if (session) {
      await auditLogRepository.record({ actorId: session.id, action: "LOGOUT", entityType: "User", entityId: session.id });
    }
  },
};
