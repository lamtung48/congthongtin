import { prisma } from "@/server/db/client";

/**
 * `tokenHash` is the only thing ever queried by — the raw token lives only
 * in the browser's HttpOnly cookie and in memory for the instant it's
 * created; the database never sees it. See `src/server/auth/session.ts`.
 */
export const sessionRepository = {
  create(data: { userId: string; tokenHash: string; expiresAt: Date; ipAddress?: string | null; userAgent?: string | null }) {
    return prisma.session.create({ data });
  },

  findByTokenHashWithUser(tokenHash: string) {
    return prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
  },

  touchLastSeen(id: string) {
    return prisma.session.update({ where: { id }, data: { lastSeenAt: new Date() } }).catch(() => null);
  },

  deleteByTokenHash(tokenHash: string) {
    return prisma.session.deleteMany({ where: { tokenHash } });
  },

  deleteAllForUser(userId: string) {
    return prisma.session.deleteMany({ where: { userId } });
  },

  deleteExpired(now: Date) {
    return prisma.session.deleteMany({ where: { expiresAt: { lt: now } } });
  },
};
