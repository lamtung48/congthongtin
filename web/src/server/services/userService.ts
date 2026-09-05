import { randomBytes } from "node:crypto";
import { userRepository, type PublicUser } from "@/server/repositories/userRepository";
import { auditLogRepository } from "@/server/repositories/auditLogRepository";
import { hashPassword } from "@/server/auth/password";
import { destroyAllSessionsForUser } from "@/server/auth/session";
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

export const userService = {
  list: userRepository.list,
  count: userRepository.count,
  getById: userRepository.findById,

  async create(
    actor: SessionUser,
    input: { email: string; username?: string; displayName: string; role: AdminRole; password: string }
  ): Promise<PublicUser> {
    assertIsAdmin(actor);
    const passwordHash = await hashPassword(input.password);
    const user = await userRepository.create({
      email: input.email,
      username: input.username || null,
      displayName: input.displayName,
      role: input.role,
      passwordHash,
      createdBy: { connect: { id: actor.id } },
    });
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
    const passwordHash = await hashPassword(temporaryPassword);
    await userRepository.updatePasswordHash(userId, passwordHash);
    await destroyAllSessionsForUser(userId);
    await auditLogRepository.record({ actorId: actor.id, action: "RESET_PASSWORD", entityType: "User", entityId: userId });
    return { temporaryPassword };
  },
};
