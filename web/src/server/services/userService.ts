import { randomBytes } from "node:crypto";
import { userRepository, type PublicUser } from "@/server/repositories/userRepository";
import { auditLogRepository } from "@/server/repositories/auditLogRepository";
import { hashPassword } from "@/server/auth/password";
import { destroyAllSessionsForUser } from "@/server/auth/session";
import { hsvIdChangePassword, hsvIdConfigured, hsvIdCreateUser, hsvIdGetProfile, hsvIdGetUser, hsvIdLink, hsvIdLookupByIdentifier, type HsvIdUser } from "@/server/integrations/hsvId";
import { normalizeEmail } from "@/server/auth/identityLink";
import type { SessionUser } from "@/server/auth/session";
import type { AdminRole, UserStatus } from "@/generated/prisma/client";

/**
 * `/admin/users` business rules (brief section 7). Every method here takes
 * the acting `SessionUser` and re-checks `actor.role === "ADMIN"` itself —
 * on top of whatever the calling route/Server Action already checked via
 * `requireRole`/`requirePermission` — because a service is the place brief
 * section 3 says the real check has to live ("Mọi action nhạy cảm phải xác
 * thực quyền tại server/service layer"), not just the route that happens to
 * call it today. See docs/AUTHORIZATION.md, "Server authorization".
 */

function assertIsAdmin(actor: SessionUser) {
  if (actor.role !== "ADMIN") {
    throw new Error("Only ADMIN can manage user accounts.");
  }
}

/** A user-facing refusal from the role-grant flow (the message is shown to the Admin as-is). */
export class GrantRoleError extends Error {}

/** What the Admin sees before granting a role — enough to be sure it is the right person, no more. */
export interface IdentityPreview {
  hsvId: string;
  fullName: string;
  email: string | null;
  phoneMasked: string | null;
  organizationName: string | null;
  localityName: string | null;
  isMember: boolean;
  /** This HSV-ID account already has a CMS account. */
  existing: { userId: string; role: AdminRole; status: UserStatus } | null;
  /** Why a role cannot be granted to this account (null = it can). */
  blocker: string | null;
}

function maskPhone(phone: string | null): string | null {
  if (!phone || phone.startsWith("auto-")) return null;
  return phone.length <= 5 ? phone : `${phone.slice(0, 3)}${"•".repeat(Math.max(phone.length - 6, 2))}${phone.slice(-3)}`;
}

/**
 * Why an HSV-ID account can't be given a CMS account (null = it can). Shared
 * by the preview and the grant itself, so the button never promises what the
 * grant then refuses. `hsv-id` does not verify e-mails, so an UNLINKED legacy
 * CMS row with the same e-mail is never attached here on the Admin's word
 * either — see auth/identityLink.ts.
 */
async function grantBlocker(identity: HsvIdUser): Promise<string | null> {
  if (identity.status !== "ACTIVE") return "Tài khoản HSV-ID này đang bị khoá hoặc chưa kích hoạt.";
  const email = normalizeEmail(identity.email);
  if (!email) return "Tài khoản HSV-ID này chỉ có số điện thoại. Cổng thông tin cần email — người đó bổ sung email ở hồ sơ HSV-ID trước.";
  const byEmail = await userRepository.findByEmailInsensitive(email);
  if (byEmail && byEmail.identityUserId !== identity.id) {
    return byEmail.identityUserId
      ? "Email này đã gắn với một tài khoản HSV-ID khác trong Cổng."
      : "Email này thuộc một tài khoản Cổng cũ chưa liên kết HSV-ID. Người đó đăng nhập tab Ban biên tập bằng mật khẩu cũ một lần để tự liên kết.";
  }
  return null;
}

export const userService = {
  list: userRepository.list,
  count: userRepository.count,
  getById: userRepository.findById,

  /**
   * Admin → "Cấp quyền Ban biên tập": look up ONE HSV-ID account by its exact
   * e-mail or phone (no fuzzy search — the Admin must already know who they
   * mean, and the CMS never browses the member directory). Returns `null`
   * when there is no such account.
   */
  async lookupIdentity(actor: SessionUser, identifier: string): Promise<IdentityPreview | null> {
    assertIsAdmin(actor);
    const found = await hsvIdLookupByIdentifier(identifier);
    if (!found.ok) {
      if (found.reason === "NOT_FOUND") return null;
      throw new GrantRoleError("Hệ thống định danh đang gián đoạn, vui lòng thử lại sau ít phút.");
    }
    const identity = found.user;
    const [profile, linked] = await Promise.all([hsvIdGetProfile(identity.id), userRepository.findByIdentityUserId(identity.id)]);
    return {
      hsvId: identity.id,
      fullName: profile?.fullName || identity.fullName,
      email: identity.email,
      phoneMasked: maskPhone(profile?.phone ?? identity.phone),
      organizationName: profile?.organization?.name ?? profile?.organizationOther ?? null,
      localityName: profile?.locality?.name ?? null,
      isMember: profile?.membership.isMember ?? false,
      existing: linked ? { userId: linked.id, role: linked.role, status: linked.status } : null,
      blocker: linked ? null : await grantBlocker(identity),
    };
  },

  /**
   * The ONLY way a person gets a CMS role since 2026-09-22 (no more
   * CONTRIBUTOR-on-login): an Admin grants it to an existing HSV-ID account.
   * The account is re-read from `hsv-id` by id here — never trusting an
   * e-mail/name sent by the browser — and the new local row is linked to it
   * directly, so the person signs in on the "Ban biên tập" tab with their
   * usual HSV-ID password. Already a CMS user → refused (change the role in
   * the table instead).
   */
  async grantRole(actor: SessionUser, identityUserId: string, role: AdminRole): Promise<PublicUser> {
    assertIsAdmin(actor);
    const found = await hsvIdGetUser(identityUserId);
    if (!found.ok) {
      throw new GrantRoleError(found.reason === "NOT_FOUND" ? "Không tìm thấy tài khoản HSV-ID." : "Hệ thống định danh đang gián đoạn, vui lòng thử lại sau ít phút.");
    }
    if (await userRepository.findByIdentityUserId(identityUserId)) {
      throw new GrantRoleError("Tài khoản này đã có quyền trong Cổng — đổi vai trò ở bảng bên dưới.");
    }
    const blocker = await grantBlocker(found.user);
    if (blocker) throw new GrantRoleError(blocker);

    const user = await userRepository.createFromIdentity({
      email: normalizeEmail(found.user.email)!,
      displayName: found.user.fullName || found.user.email!,
      identityUserId,
      role,
      createdById: actor.id,
    });
    // Best-effort: record the link on the hsv-id side too (409 = already linked, fine). Sign-in does not depend on it.
    await hsvIdLink(identityUserId, user.id).catch(() => false);
    await auditLogRepository.record({
      actorId: actor.id,
      action: "CREATE_USER",
      entityType: "User",
      entityId: user.id,
      metadata: { via: "admin-grant", role, identityUserId },
    });
    return user;
  },

  async create(
    actor: SessionUser,
    input: { email: string; username?: string; displayName: string; role: AdminRole; password: string }
  ): Promise<PublicUser> {
    assertIsAdmin(actor);
    // Most people already have an HSV-ID account (Hoạt động / Đào tạo). Creating a second, password-bearing CMS account for that e-mail
    // could never be linked to it (the person's real password differs) — they must be granted a role instead.
    const existing = await hsvIdLookupByIdentifier(input.email);
    if (existing.ok) {
      throw new GrantRoleError("Email này đã có tài khoản HSV-ID — dùng “Cấp quyền cho tài khoản HSV-ID” ở trên thay vì tạo tài khoản mới.");
    }
    if (existing.reason === "UNAVAILABLE" && hsvIdConfigured()) {
      throw new GrantRoleError("Hệ thống định danh đang gián đoạn, chưa tạo được tài khoản. Vui lòng thử lại sau ít phút.");
    }
    const passwordHash = await hashPassword(input.password);
    const user = await userRepository.create({
      email: input.email,
      username: input.username || null,
      displayName: input.displayName,
      role: input.role,
      passwordHash,
      createdBy: { connect: { id: actor.id } },
    });
    // Sync to the shared identity service straight away, while the real
    // password is still in hand (best-effort — a `hsv-id` outage must not
    // fail account creation; the login lazy-sync will catch it later).
    const identityUserId = await hsvIdCreateUser({
      email: user.email,
      password: input.password,
      fullName: user.displayName,
      platformUserId: user.id,
    });
    if (identityUserId) {
      await userRepository.setIdentityUserId(user.id, identityUserId);
    }
    await auditLogRepository.record({
      actorId: actor.id,
      action: "CREATE_USER",
      entityType: "User",
      entityId: user.id,
      metadata: { role: input.role },
    });
    return user;
  },

  async updateProfile(actor: SessionUser, userId: string, input: { displayName?: string; username?: string | null }): Promise<PublicUser> {
    assertIsAdmin(actor);
    const user = await userRepository.update(userId, input);
    await auditLogRepository.record({ actorId: actor.id, action: "UPDATE_USER", entityType: "User", entityId: userId });
    return user;
  },

  /**
   * Brief section 15's Manager test ("không nâng chính mình lên Admin")
   * can't even reach this method — `user.changeRole` isn't in Manager's
   * permission set (`src/server/auth/permissions.ts`), so the route guard
   * already rejects a Manager before this runs. The check kept here is a
   * narrower one: even an Admin can't change their *own* role, so a lone
   * Admin account can never lock itself out of the CMS by accident.
   */
  async changeRole(actor: SessionUser, userId: string, newRole: AdminRole): Promise<PublicUser> {
    assertIsAdmin(actor);
    if (userId === actor.id) {
      throw new Error("An Admin cannot change their own role.");
    }
    const user = await userRepository.update(userId, { role: newRole });
    await auditLogRepository.record({
      actorId: actor.id,
      action: "CHANGE_ROLE",
      entityType: "User",
      entityId: userId,
      metadata: { newRole },
    });
    return user;
  },

  async setStatus(actor: SessionUser, userId: string, status: UserStatus): Promise<PublicUser> {
    assertIsAdmin(actor);
    if (userId === actor.id && status === "DISABLED") {
      throw new Error("An Admin cannot disable their own account.");
    }
    const user = await userRepository.update(userId, { status });
    if (status === "DISABLED") {
      // Brief section 13: disabling an account must take effect
      // immediately, not just block future logins — kill every session
      // that account currently holds.
      await destroyAllSessionsForUser(userId);
    }
    await auditLogRepository.record({
      actorId: actor.id,
      action: status === "DISABLED" ? "DISABLE_USER" : "ENABLE_USER",
      entityType: "User",
      entityId: userId,
    });
    return user;
  },

  /**
   * Admin-initiated reset: generates a temporary password, invalidates
   * every existing session for the account, and returns the plaintext
   * password exactly once for the Admin to relay out-of-band — it is never
   * logged, stored in `AuditLog.metadata`, or retrievable again afterward.
   * No email-delivery flow exists in this task (nothing in the brief asks
   * for one); see docs/AUTHENTICATION.md, "Password reset" for the
   * follow-up this implies.
   */
  async resetPassword(actor: SessionUser, userId: string): Promise<{ temporaryPassword: string }> {
    assertIsAdmin(actor);
    const temporaryPassword = randomBytes(9).toString("base64url");

    // Push the new password to the shared identity (`hsv-id`) FIRST. For a linked
    // account, if `hsv-id` doesn't take it (service down), abort the whole reset —
    // never leave the local hash ahead of `hsv-id`, or the user's next login
    // verifies the old password against `hsv-id` and is rejected outright.
    const syncTarget = await userRepository.findIdentitySyncFields(userId);
    if (syncTarget?.identityUserId) {
      const synced = await hsvIdChangePassword(syncTarget.identityUserId, temporaryPassword);
      if (!synced && hsvIdConfigured()) {
        throw new Error("Dịch vụ tài khoản dùng chung đang tạm gián đoạn, chưa đặt lại được mật khẩu. Vui lòng thử lại sau ít phút.");
      }
    }

    const passwordHash = await hashPassword(temporaryPassword);
    await userRepository.updatePasswordHash(userId, passwordHash);
    await destroyAllSessionsForUser(userId);

    // Account never synced yet -> create it in `hsv-id` now (best-effort; login re-syncs).
    if (syncTarget && !syncTarget.identityUserId) {
      const identityUserId = await hsvIdCreateUser({
        email: syncTarget.email,
        password: temporaryPassword,
        fullName: syncTarget.displayName,
        platformUserId: syncTarget.id,
      });
      if (identityUserId) {
        await userRepository.setIdentityUserId(syncTarget.id, identityUserId);
      }
    }

    await auditLogRepository.record({ actorId: actor.id, action: "RESET_PASSWORD", entityType: "User", entityId: userId });
    return { temporaryPassword };
  },
};
