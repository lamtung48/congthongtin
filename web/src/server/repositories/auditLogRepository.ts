import { prisma } from "@/server/db/client";
import type { AuditAction, Prisma } from "@/generated/prisma/client";

/**
 * `record()` is called from every write path across the services in this
 * project. `listRecent()` now has a real caller too — the Admin dashboard
 * (brief section 11: "audit gần đây") — kept as its own tiny repository
 * rather than inline `prisma.auditLog.*` calls scattered across callers.
 */
export const auditLogRepository = {
  record(entry: {
    actorId?: string | null;
    action: AuditAction;
    entityType: string;
    entityId: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return prisma.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        metadata: entry.metadata,
      },
    });
  },

  /** Admin-only per brief's permission table ("Xem Audit Log đầy đủ" —
   *  Admin only) — the route/page calling this must have already checked
   *  `auditlog.view.full` via `requirePermission()`. */
  listRecent(limit: number) {
    return prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { actor: { select: { displayName: true, email: true } } },
    });
  },
};
