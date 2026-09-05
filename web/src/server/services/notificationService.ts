import { notificationRepository } from "@/server/repositories/notificationRepository";
import { userRepository } from "@/server/repositories/userRepository";
import type { SessionUser } from "@/server/auth/session";
import type { AdminRole, NotificationType } from "@/generated/prisma/client";

/**
 * Editorial workflow task, brief sections 9/10: in-app notifications only.
 * `articleService.ts` calls `notifyUser`/`notifyRoles` at exactly the 4
 * trigger points the brief names (submit → Manager/Admin, return/approve/
 * publish → Contributor) — this file owns recipient resolution and message
 * wording, `articleService` only supplies the article + who did what.
 * Every read/write below is scoped to `actor.id` server-side (brief
 * section 12: never trust which user a client claims to be) — there is no
 * "read anyone's notifications" permission for any role, Admin included:
 * a notification is inherently personal, unlike an article or an audit log.
 */

export const notificationService = {
  /** One notification for one specific user — used for the Contributor-
   *  facing triggers (return/approve/publish), where there's exactly one
   *  natural recipient: whoever created the article. Silently a no-op when
   *  `userId` is null (an article with no `createdById`, e.g. seeded
   *  content) — there's no one to notify. */
  async notifyUser(userId: string | null, type: NotificationType, entityType: string, entityId: string, message: string) {
    if (!userId) return;
    await notificationRepository.create({ userId, type, entityType, entityId, message });
  },

  /** Fan-out to every active user in the given roles — used for "Cộng tác
   *  viên → gửi duyệt: notify Manager/Admin phù hợp" (brief section 9),
   *  since this CMS has no per-article reviewer assignment to notify a
   *  single person instead. */
  async notifyRoles(roles: AdminRole[], type: NotificationType, entityType: string, entityId: string, message: string) {
    const recipients = await userRepository.listActiveByRoles(roles);
    await notificationRepository.createMany(
      recipients.map((r) => ({ userId: r.id, type, entityType, entityId, message })),
    );
  },

  listForUser(actor: SessionUser, params: { skip?: number; take?: number } = {}) {
    return notificationRepository.listForUser(actor.id, params);
  },

  countUnread(actor: SessionUser) {
    return notificationRepository.countUnread(actor.id);
  },

  markRead(actor: SessionUser, notificationId: string) {
    return notificationRepository.markRead(notificationId, actor.id);
  },

  markAllRead(actor: SessionUser) {
    return notificationRepository.markAllRead(actor.id);
  },
};
