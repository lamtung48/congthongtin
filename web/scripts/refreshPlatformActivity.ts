/**
 * Pulls live activity from every `integrationType: API` ecosystem platform
 * and writes it back to `Platform.currentActivity` / `currentActivityUpdatedAt`
 * (and `status`, if the adapter reports one). The homepage's ISR then
 * surfaces it within its 60s revalidate window — so no `revalidatePath` and
 * no external call ever happens on a public request (docs/ECOSYSTEM_INTEGRATION.md,
 * "Failure isolation").
 *
 * Run on a short interval by the `refresher` sidecar in docker-compose.yml:
 *   node --conditions=react-server --import tsx scripts/refreshPlatformActivity.ts
 *
 * `--conditions=react-server` neutralises the `import "server-only"` guard in
 * the adapter chain (same trick as the `test` script) — those modules pull
 * no React, so nothing else changes.
 *
 * Mirrors `platformService.refreshActivity()` but without the Next.js
 * request-context bits (`revalidatePath`, the `SessionUser` actor/permission
 * check) that a plain script can't and shouldn't carry.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getAdapterForCategory } from "../src/server/integrations/platformAdapters/registry";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const platforms = await prisma.platform.findMany({
    where: { integrationType: "API", isEnabled: true },
  });
  if (platforms.length === 0) {
    console.log("[refresh] no enabled API-integration platforms — nothing to do");
    return;
  }

  for (const p of platforms) {
    const adapter = getAdapterForCategory(p.category);
    if (!adapter) {
      console.log(`[refresh] ${p.slug}: no adapter for category ${p.category} — skipped`);
      continue;
    }

    let result;
    try {
      result = await adapter.fetchActivity({ apiBaseUrl: p.apiBaseUrl });
    } catch (err) {
      console.error(`[refresh] ${p.slug}: adapter threw —`, err instanceof Error ? err.message : err);
      continue;
    }

    if (!result.ok) {
      // Leave currentActivity exactly as it was — a failed poll never
      // degrades what the homepage already shows.
      console.warn(`[refresh] ${p.slug}: ${result.reason} — ${result.message}`);
      continue;
    }

    await prisma.platform.update({
      where: { id: p.id },
      data: {
        currentActivity: result.currentActivity,
        currentActivityUpdatedAt: new Date(),
        ...(result.status ? { status: result.status } : {}),
      },
    });
    console.log(`[refresh] ${p.slug}: "${result.currentActivity}"${result.status ? ` [status=${result.status}]` : ""}`);
  }
}

main()
  .catch((err) => {
    console.error("[refresh] fatal:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
