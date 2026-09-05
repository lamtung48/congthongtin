import { prisma } from "@/server/db/client";
import type { NotificationType } from "@/generated/prisma/client";

/**
 * Editorial workflow task, brief sections 9/10: pure data access for the
 * in-app notification feed. No business logic here — deciding *who* gets
 * notified for a given workflow transition is `notificationService`'s job
 * (it resolves recipients, e.g. "every active Manager/Admin", then calls
 * `create`/`createMany` here once per recipient).
 */
export const notificationRepository = {
  create(entry: { userId: string; type: NotificationType; entityType: string; entityId: string; message: string }) {
    return prisma.notification.create({ data: entry });
  },

  createMany(entries: { userId: string; type: NotificationType; entityType: string; entityId: string; message: string }[]) {
    if (entries.length === 0) return Promise.resolve({ count: 0 });
    return prisma.notification.createMany({ data: entries });
  },

  /** Newest first — brief section 10: "unread; read; entity link; time." */
  listForUser(userId: string, params: { skip?: number; take?: number } = {}) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: params.skip,
      take: params.take,
    });
  },

  countUnread(userId: string) {
    return prisma.notification.count({ where: { userId, isRead: false } });
  },

  /** Scoped by `userId` in the `where` clause itself (not just checked
   *  after the fact) — a user can only ever mark their own notification
   *  read, matched-zero-rows-updated is the same as "not found", both are
   *  silently fine here since the caller has nothing more useful to do
   *  either way. */
  markRead(id: string, userId: string) {
    return prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true } });
  },

  markAllRead(userId: string) {
    return prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
  },
};
