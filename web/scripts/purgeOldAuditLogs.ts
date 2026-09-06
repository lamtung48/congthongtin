/**
 * Production readiness task, brief section 11: "AuditLog của Admin/Manager/
 * Contributor phải được giữ theo policy. Không cho Contributor sửa/xóa
 * audit." The second half is already true by construction — `auditLogRepository`
 * (`src/server/repositories/auditLogRepository.ts`) exposes exactly one
 * write method, `record()` (create-only); nothing in the entire app calls
 * `prisma.auditLog.update`/`.delete`, for any role, ever. Grep for
 * `auditLog.delete` / `auditLog.update` in `src/` to confirm — there is
 * nothing to find.
 *
 * The first half — a retention *policy* — needs something to actually
 * apply it, since "keep forever" is not a policy, it's an unbounded
 * table on a 200GB shared VPS (brief section 14). This script is that
 * something: a standalone, cron-only job, never reachable from any admin
 * route/Server Action/API — the only way to delete an AuditLog row in this
 * system is to run this script directly on the server, by an operator with
 * shell access, which is a deliberately higher bar than any in-app
 * permission (`auditlog.view.full` etc.) could gate.
 *
 * Retention window: `AUDIT_LOG_RETENTION_DAYS`, default 365 days — long
 * enough to cover a full annual review cycle, short enough that the table
 * doesn't grow without bound. Adjust per your organization's actual audit
 * policy; this default is a starting point, not a compliance claim.
 *
 * Run manually or via cron (see docs/OPERATIONS.md):
 *   npx tsx scripts/purgeOldAuditLogs.ts
 *   AUDIT_LOG_RETENTION_DAYS=730 npx tsx scripts/purgeOldAuditLogs.ts
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const retentionDays = Number(process.env.AUDIT_LOG_RETENTION_DAYS ?? 365);
  if (!Number.isFinite(retentionDays) || retentionDays < 30) {
    throw new Error("AUDIT_LOG_RETENTION_DAYS must be a number >= 30 (refusing an accidental near-zero retention window).");
  }

  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const result = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  console.log(`Purged ${result.count} AuditLog row(s) older than ${cutoff.toISOString()} (retention: ${retentionDays} days).`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
