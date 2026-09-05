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

  /**
   * `Article` has no `submittedAt` column (a "when was this last sent for
   * review" timestamp would only ever be read by this one listing column —
   * not worth a schema field when the audit trail already answers it). The
   * `/admin/articles` list column instead reads the most recent
   * `SUBMIT_REVIEW` entry per article, batched into one query for every row
   * on the current page rather than one query per row. Returns a plain
   * `Map` (only the latest entry per id) since that's all the caller needs.
   */
  async findLatestActionDates(action: AuditAction, entityType: string, entityIds: string[]): Promise<Map<string, Date>> {
    if (entityIds.length === 0) return new Map();
    const rows = await prisma.auditLog.findMany({
      where: { action, entityType, entityId: { in: entityIds } },
      orderBy: { createdAt: "desc" },
      select: { entityId: true, createdAt: true },
    });
    const latest = new Map<string, Date>();
    for (const row of rows) {
      if (!latest.has(row.entityId)) latest.set(row.entityId, row.createdAt);
    }
    return latest;
  },
};
