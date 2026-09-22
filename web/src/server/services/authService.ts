import { userRepository } from "@/server/repositories/userRepository";
import { auditLogRepository } from "@/server/repositories/auditLogRepository";
import { createSession, destroySession, getSession } from "@/server/auth/session";
import { matchLocalUser, type LocalUserRow } from "@/server/auth/identityLink";
import { verifyPassword } from "@/server/auth/password";
import { checkLoginRateLimit, clearLoginRateLimit, recordFailedLogin } from "@/server/auth/rateLimit";
import { hsvIdCreateUser, hsvIdLink, hsvIdSsoLogin, hsvIdSsoLogout, hsvIdVerifyAndGetUser } from "@/server/integrations/hsvId";

/**
 * Brief section 4: the one error message every failure path returns —
 * "Thông tin đăng nhập không chính xác." never distinguishes "no such
 * account", "wrong password", "locked" or "account disabled", so none of
 * those facts leaks to whoever is submitting the form. See
 * docs/AUTHENTICATION.md, "Login error messages". (Three messages differ on
 * purpose and reveal nothing an attacker without the password could learn:
 * too many attempts, the identity service being unreachable, and — only
 * after the password was proven right — "no CMS role granted yet".)
 */
const GENERIC_LOGIN_ERROR = "Thông tin đăng nhập không chính xác.";
const RATE_LIMITED_ERROR = "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau ít phút.";
const UNAVAILABLE_ERROR = "Hệ thống định danh đang gián đoạn, vui lòng thử lại sau ít phút.";
/**
 * A real HSV-ID account (the password was right) that no Admin has granted a
 * CMS role. Said plainly rather than with the generic message: it reveals
 * nothing the person couldn't learn by signing in on Hoạt động, and "sai
 * mật khẩu" would send them hunting for a password that is in fact correct.
 * Roles are only ever granted by an Admin (`/admin/users`) — never on login.
 */
const NO_EDITOR_ACCESS_ERROR =
  "Tài khoản HSV-ID của bạn chưa được cấp quyền Ban biên tập. Liên hệ Admin của Cổng để được phân quyền, hoặc dùng tab “Tài khoản cá nhân”.";

export type LoginResult = { ok: true } | { ok: false; error: string };

/**
 * Accounts that predate SSO and were never synced to `hsv-id` only have a
 * local password. The first time such a person signs in (hsv-id says "wrong
 * credentials"), a matching LOCAL password proves they own the account, so
 * the account is created in `hsv-id` with that password and linked — the
 * lazy migration the CMS always did, no bulk step needed. Returns whether an
 * hsv-id account now exists for this login (the caller retries the SSO login).
 */
async function migrateLegacyAccount(local: LocalUserRow, password: string): Promise<boolean> {
  if (local.identityUserId || local.status !== "ACTIVE") return false;
  if (!(await verifyPassword(password, local.passwordHash))) return false;

  let identityUserId = await hsvIdCreateUser({ email: local.email, password, fullName: local.displayName, platformUserId: local.id });
  // `null` usually = the e-mail already has an hsv-id account (made on another platform). Link only if THIS password also opens it, so both
  // sides genuinely share one credential (never adopt an unknown password by linking blindly).
  if (!identityUserId) {
    const existing = await hsvIdVerifyAndGetUser(local.email, password);
    if (existing && (await hsvIdLink(existing.id, local.id))) identityUserId = existing.id;
  }
  if (!identityUserId) return false;
  await userRepository.setIdentityUserId(local.id, identityUserId);
  return true;
}

export const authService = {
  async login(identifier: string, password: string, requestIp: string | null, userAgent: string | null = null): Promise<LoginResult> {
    const rateLimitKey = `${identifier.toLowerCase()}:${requestIp ?? "unknown"}`;
    const rateLimit = checkLoginRateLimit(rateLimitKey);
    if (!rateLimit.allowed) {
      return { ok: false, error: RATE_LIMITED_ERROR };
    }

    // `hsv-id` knows e-mails/phones, not this CMS's optional `username` — resolve a username to its account's e-mail first.
    const local = await userRepository.findByEmailOrUsernameWithHash(identifier);
    const ssoIdentifier = local && !identifier.includes("@") ? local.email : identifier;

    let sso = await hsvIdSsoLogin({ identifier: ssoIdentifier, password, ip: requestIp, userAgent });
    if (!sso.ok && sso.error === "INVALID_CREDENTIALS" && local && (await migrateLegacyAccount(local, password))) {
      sso = await hsvIdSsoLogin({ identifier: ssoIdentifier, password, ip: requestIp, userAgent });
    }

    if (!sso.ok) {
      if (sso.error === "RATE_LIMITED") return { ok: false, error: RATE_LIMITED_ERROR };
      if (sso.error === "UNAVAILABLE") return { ok: false, error: UNAVAILABLE_ERROR };
      recordFailedLogin(rateLimitKey);
      return { ok: false, error: GENERIC_LOGIN_ERROR };
    }

    // hsv-id accepted the credentials; now find (or, with proof, link) the local CMS account. None is ever CREATED here: a CMS role
    // exists only because an Admin granted it (userService.grantRole).
    const match = await matchLocalUser(sso.user);
    let user: LocalUserRow | null = null;
    if (match.kind === "linked") {
      user = match.user;
    } else if (match.kind === "unlinked-email") {
      // Same e-mail, different account history: link ONLY when the local password proves ownership (see auth/identityLink.ts).
      if (await verifyPassword(password, match.user.passwordHash)) {
        await userRepository.setIdentityUserId(match.user.id, sso.user.id);
        user = { ...match.user, identityUserId: sso.user.id };
      }
    } else if (match.kind === "none") {
      // Only the session just opened is revoked — this never signs the person out of the other platforms.
      await hsvIdSsoLogout(sso.token).catch(() => false);
      clearLoginRateLimit(rateLimitKey);
      return { ok: false, error: NO_EDITOR_ACCESS_ERROR };
    }

    // Same generic failure for a disabled account and an unproven / conflicting e-mail match. The session we just opened at hsv-id is
    // revoked — only that one, so a refusal here never signs the person out of the other platforms.
    if (!user || user.status !== "ACTIVE") {
      await hsvIdSsoLogout(sso.token).catch(() => false);
      recordFailedLogin(rateLimitKey);
      return { ok: false, error: GENERIC_LOGIN_ERROR };
    }

    clearLoginRateLimit(rateLimitKey);
    await createSession(sso.token, new Date(sso.expiresAt));
    // The shared profile is the source of the display name (a change made on another platform shows here too).
    if (sso.user.fullName && sso.user.fullName !== user.displayName) {
      await userRepository.update(user.id, { displayName: sso.user.fullName });
    }
    await userRepository.touchLastLogin(user.id);
    await auditLogRepository.record({ actorId: user.id, action: "LOGIN", entityType: "User", entityId: user.id });

    return { ok: true };
  },

  /**
   * PERSONAL sign-in (`/dang-nhap`, docs/AUTHENTICATION.md "Hai luồng đăng
   * nhập"): any `hsv-id` account — the same one used on Hoạt động / Đào tạo.
   * Only opens the shared SSO session and sets the cookie: no local `User`
   * row is looked up, linked or created (ordinary accounts are not CMS
   * accounts; an editor signing in here still gets their CMS role, because
   * `getSession` finds their already-linked row). Same generic-error rule as
   * `login`.
   */
  async personalLogin(identifier: string, password: string, requestIp: string | null, userAgent: string | null = null): Promise<LoginResult> {
    const rateLimitKey = `person:${identifier.toLowerCase()}:${requestIp ?? "unknown"}`;
    if (!checkLoginRateLimit(rateLimitKey).allowed) {
      return { ok: false, error: RATE_LIMITED_ERROR };
    }

    const sso = await hsvIdSsoLogin({ identifier: identifier.trim(), password, ip: requestIp, userAgent });
    if (!sso.ok) {
      if (sso.error === "RATE_LIMITED") return { ok: false, error: RATE_LIMITED_ERROR };
      if (sso.error === "UNAVAILABLE") return { ok: false, error: UNAVAILABLE_ERROR };
      recordFailedLogin(rateLimitKey);
      return { ok: false, error: GENERIC_LOGIN_ERROR };
    }

    clearLoginRateLimit(rateLimitKey);
    await createSession(sso.token, new Date(sso.expiresAt));
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
