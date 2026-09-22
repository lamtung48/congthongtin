/**
 * Scheduled collector: syncs every enabled RSS/WEBSITE `Source` whose
 * `lastSyncedAt + syncEveryMinutes` has passed, dropping new items into the
 * Social Inbox (PENDING_REVIEW). Nothing is ever auto-published — a human
 * reviews and converts each item (docs/SOCIAL_COLLECTOR.md).
 *
 * Run by the `collector` sidecar (docker-compose.yml):
 *   node --conditions=react-server --import tsx scripts/runDueSourceSyncs.ts
 * `--conditions=react-server` neutralises the `import "server-only"` guards
 * in the source-collector adapter chain (same as the other cron scripts).
 */
import "dotenv/config";
import { sourceRepository } from "../src/server/repositories/sourceRepository";
import { syncSourceCore } from "../src/server/services/sourceService";
import { prisma } from "../src/server/db/client";

async function main() {
  const now = new Date();
  const due = await sourceRepository.listDueForAutoSync(now);
  if (due.length === 0) {
    console.log(`[collector] ${now.toISOString()} — no sources due`);
    return;
  }
  for (const s of due) {
    try {
      const r = await syncSourceCore(s, null);
      if (r.ok) {
        console.log(`[collector] ${s.name}: ok — ${r.stored} mới / ${r.fetched} lấy về`);
      } else {
        console.warn(`[collector] ${s.name}: THẤT BẠI (${r.reason}) — ${r.message}`);
      }
    } catch (err) {
      console.error(`[collector] ${s.name}: lỗi ngoài dự kiến —`, err instanceof Error ? err.message : err);
    }
  }
}

main()
  .catch((err) => {
    console.error("[collector] fatal:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
