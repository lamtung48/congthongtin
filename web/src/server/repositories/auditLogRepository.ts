import { prisma } from "@/server/db/client";
import type { AuditAction, Prisma } from "@/generated/prisma/client";

/**
 * Write-only from the application's perspective today — nothing reads
 * `AuditLog` back yet (no admin UI, brief item 18). Kept as its own tiny
 * repository rather than inline `prisma.auditLog.create()` calls scattered
 * across every service, so a future "show me the history of this record"
 * admin feature has one place to add read methods to.
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
};
