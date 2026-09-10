import { userRepository } from "@/server/repositories/userRepository";
import { auditLogRepository } from "@/server/repositories/auditLogRepository";
import { createSession, destroySession, getSession } from "@/server/auth/session";
import { verifyPassword } from "@/server/auth/password";
import { checkLoginRateLimit, clearLoginRateLimit, recordFailedLogin } from "@/server/auth/rateLimit";
import { hsvIdCreateUser, hsvIdLink, hsvIdVerifyAndGetUser, hsvIdVerifyPassword } from "@/server/integrations/hsvId";

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

/**
 * Auto-provision a CONTRIBUTOR for someone who authenticates against
 * `hsv-id` but has no CMS `User` row yet. Returns the ready-to-use account,
 * or `null` when provisioning isn't possible/allowed (`hsv-id` unreachable,
 * wrong password, locked account, or an `hsv-id` account with no email —
 * the CMS is email-keyed). Idempotent: a row that already exists by email
 * or by `identityUserId` is reused (and linked if it wasn't).
 */
async function provisionContributorFromIdentity(identifier: string, password: string) {
  const idUser = await hsvIdVerifyAndGetUser(identifier, password);
  if (!idUser || idUser.status === "LOCKED") return null;

  const email = (idUser.email ?? (identifier.includes("@") ? identifier : null))?.trim().toLowerCase();
  if (!email) return null;

  const existing = await userRepository.findByEmailOrIdentityUserId(email, idUser.id);
  if (existing) {
    if (!existing.identityUserId) await userRepository.setIdentityUserId(existing.id, idUser.id);
    return existing.status === "ACTIVE" ? existing : null;
  }

  const created = await userRepository.createFromIdentityAsContributor({
    email,
    displayName: idUser.fullName || email,
    identityUserId: idUser.id,
  });
  await auditLogRepository.record({
    actorId: null,
    action: "CREATE_USER",
    entityType: "User",
    entityId: created.id,
    metadata: { via: "hsv-id", role: "CONTRIBUTOR", identityUserId: idUser.id },
  });
  return created;
}

export const authService = {
  async login(identifier: string, password: string, requestIp: string | null): Promise<LoginResult> {
    const rateLimitKey = `${identifier.toLowerCase()}:${requestIp ?? "unknown"}`;
    const rateLimit = checkLoginRateLimit(rateLimitKey);
    if (!rateLimit.allowed) {
      return { ok: false, error: RATE_LIMITED_ERROR };
    }

    const user = await userRepository.findByEmailOrUsernameWithHash(identifier);

    // No local CMS account: if the shared identity service (`hsv-id`)
    // recognises these exact credentials, this is someone who has a
    // hoinghi/daotaohsv account but has never used the portal. Product
    // decision (docs/AUTHENTICATION.md, "Auto-provisioning"): give them a
    // CONTRIBUTOR account on the spot — draft + submit their own articles,
    // nothing more, until an Admin promotes them. `hsv-id` unreachable, an
    // unknown/locked account, or no usable email ⇒ fall through to the
    // same generic error as any other failed login.
    if (!user) {
      const provisioned = await provisionContributorFromIdentity(identifier, password);
      if (!provisioned) {
        recordFailedLogin(rateLimitKey);
        return { ok: false, error: GENERIC_LOGIN_ERROR };
      }
      clearLoginRateLimit(rateLimitKey);
      await createSession(provisioned.id);
      await userRepository.touchLastLogin(provisioned.id);
      await auditLogRepository.record({ actorId: provisioned.id, action: "LOGIN", entityType: "User", entityId: provisioned.id });
      return { ok: true };
    }

    // Same generic failure for "wrong password" and "disabled account" — a
    // different message per case would let an attacker enumerate disabled
    // accounts, exactly what brief section 4 warns against generalizing
    // from (it names the password case explicitly; the same principle
    // applies here).
    if (user.status !== "ACTIVE") {
      recordFailedLogin(rateLimitKey);
      return { ok: false, error: GENERIC_LOGIN_ERROR };
    }

    // Shared identity (`hsv-id`) — see docs/AUTHENTICATION.md, "Shared
    // identity". Once an account is linked, `hsv-id` is the password
    // authority and the local hash is only a fallback for when `hsv-id`
    // can't be reached. An unlinked account is verified locally and then
    // synced to `hsv-id` on the spot, using the real password from this
    // request (no bulk migration needed). All of this stays behind the one
    // GENERIC_LOGIN_ERROR — no failure path reveals which check ran.
    let passwordValid: boolean;
    if (user.identityUserId) {
      // On success `hsv-id` also hands back the current shared profile — pull the
      // canonical display name in so a change made on hoinghi/daotaohsv shows here too.
      const idUser = await hsvIdVerifyAndGetUser(identifier, password);
      if (idUser) {
        passwordValid = true;
        if (idUser.fullName && idUser.fullName !== user.displayName) {
          await userRepository.update(user.id, { displayName: idUser.fullName });
        }
      } else {
        const hsvResult = await hsvIdVerifyPassword(identifier, password);
        passwordValid = hsvResult ?? (await verifyPassword(password, user.passwordHash));
      }
    } else {
      passwordValid = await verifyPassword(password, user.passwordHash);
      if (passwordValid) {
        // First, try to create the account in hsv-id outright.
        let identityUserId = await hsvIdCreateUser({
          email: user.email,
          password,
          fullName: user.displayName,
          platformUserId: user.id,
        });
        // `null` here usually means the email already belongs to an hsv-id
        // account created from another platform (hoinghi/daotaohsv). Link
        // to it — but ONLY if the exact password just accepted here also
        // authenticates there, so both sides genuinely share one
        // credential (never adopt an unknown password by linking blindly).
        if (!identityUserId) {
          const existing = await hsvIdVerifyAndGetUser(identifier, password);
          if (existing && (await hsvIdLink(existing.id, user.id))) {
            identityUserId = existing.id;
          }
        }
        if (identityUserId) {
          await userRepository.setIdentityUserId(user.id, identityUserId);
        }
      }
    }
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
