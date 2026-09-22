/**
 * Mirrors the Hoạt động platform's public activities into `PlatformActivity`
 * so the homepage's "Bản đồ phong trào" can list them under each province /
 * overseas association (clicking opens the activity's landing page on Hoạt
 * động). Hoạt động stays the source of truth: every run upserts what it
 * returns and — only after a COMPLETE read — deletes rows it no longer lists.
 *
 * Where an activity lands on the map is resolved from its organiser (hsv-id):
 *  - organiser's name = an overseas association's name → that association;
 *  - otherwise the organiser's locality name = a province's name → that province
 *    (a school or a provincial chapter both carry their province as locality);
 *  - central bodies ("Cơ quan Trung ương" …) resolve to neither — kept, but
 *    off the map.
 *
 * Run by the `refresher` sidecar (docker-compose.yml) every ~10 minutes:
 *   node --conditions=react-server --import tsx scripts/syncPlatformActivities.ts
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { fetchAllPublicActivities, placeKey } from "../src/server/integrations/hoatdongActivities";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const fetched = await fetchAllPublicActivities();
  if (!fetched) {
    console.warn("[activities] Hoạt động not configured or unreachable — nothing changed");
    return;
  }

  const [provinces, overseas] = await Promise.all([
    prisma.province.findMany({ select: { id: true, name: true } }),
    prisma.overseasOrganization.findMany({ select: { id: true, name: true } }),
  ]);
  const provinceByKey = new Map(provinces.map((p) => [placeKey(p.name), p.id]));
  const overseasByKey = new Map(overseas.map((o) => [placeKey(o.name), o.id]));

  const syncedAt = new Date();
  let onMap = 0;
  for (const a of fetched.items) {
    const overseasOrganizationId = overseasByKey.get(placeKey(a.organizationName)) ?? null;
    const provinceId = overseasOrganizationId ? null : a.localityName ? (provinceByKey.get(placeKey(a.localityName)) ?? null) : null;
    if (provinceId || overseasOrganizationId) onMap++;

    const data = {
      code: a.code,
      title: a.title,
      url: a.url,
      thumbnailUrl: a.thumbnailUrl,
      organizationName: a.organizationName,
      organizationType: a.organizationType,
      localityName: a.localityName,
      provinceId,
      overseasOrganizationId,
      status: a.status,
      tags: a.tags,
      participantCount: a.participantCount,
      startAt: a.startAt,
      endAt: a.endAt,
      syncedAt,
    };
    await prisma.platformActivity.upsert({ where: { id: a.id }, create: { id: a.id, ...data }, update: data });
  }

  let removed = 0;
  if (fetched.complete) {
    const result = await prisma.platformActivity.deleteMany({ where: { id: { notIn: fetched.items.map((a) => a.id) } } });
    removed = result.count;
  }
  console.log(
    `[activities] ${fetched.items.length} synced (${onMap} on the map), ${removed} removed${fetched.complete ? "" : " — partial read, nothing deleted"}`,
  );
}

main()
  .catch((err) => {
    console.error("[activities] sync failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
