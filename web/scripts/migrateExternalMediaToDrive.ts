import "dotenv/config";
import { prisma } from "@/server/db/client";
import { fetchRemoteImage } from "@/server/media/fetchRemoteImage";
import { processImageForStorage, transcodeToWebp } from "@/server/media/processImage";
import { inferImageFilename } from "@/server/media/storeImage";
import { validateImageUpload, buildStorageFilename, sniffImageFormat } from "@/server/validation/mediaUpload";
import { uploadFileToDrive } from "@/server/integrations/googleDrive";
import { slugify } from "@/lib/slug";
import { randomUUID } from "node:crypto";

/**
 * One-off backfill for articles converted before images were copied into
 * Drive: pulls every `EXTERNAL` (hot-linked) asset's bytes down and rewrites
 * the SAME `MediaAsset` row to a `GOOGLE_DRIVE` one, so nothing that already
 * references the asset (article blocks, covers, `MediaUsage`) needs
 * rewiring. Also drops the "Nội dung tổng hợp từ nguồn bên ngoài…" quote the
 * old convert step appended, and gives any converted article still missing a
 * cover its first body image.
 *
 * Safe to re-run: rows already migrated are no longer `EXTERNAL`, and the
 * quote/cover passes are both idempotent.
 */

async function migrateOneAsset(id: string, url: string, alt: string | null): Promise<boolean> {
  const fetched = await fetchRemoteImage(url, alt ?? undefined);
  if (!fetched.ok) {
    console.warn(`  ! ${id} fetch failed: ${fetched.error}`);
    return false;
  }

  let bytes = fetched.buffer;
  if (!sniffImageFormat(bytes)) {
    const webp = await transcodeToWebp(bytes);
    if (!webp) {
      console.warn(`  ! ${id} unsupported image format`);
      return false;
    }
    bytes = webp;
  }

  const base = slugify(alt ?? fetched.nameHint).slice(0, 60).replace(/-+$/, "") || "anh";
  const validation = validateImageUpload(bytes, inferImageFilename(bytes, base));
  if (!validation.ok) {
    console.warn(`  ! ${id} invalid: ${validation.error}`);
    return false;
  }

  const { format, mimeType, dimensions } = validation.value;
  const processed = await processImageForStorage(bytes, format);
  const uploaded = await uploadFileToDrive(processed.buffer, buildStorageFilename(randomUUID(), format, base), mimeType);

  await prisma.mediaAsset.update({
    where: { id },
    data: {
      provider: "GOOGLE_DRIVE",
      providerFileId: uploaded.fileId,
      status: "READY",
      filename: `${base}.${format.toLowerCase()}`,
      mimeType,
      size: uploaded.size,
      width: processed.width ?? dimensions?.width,
      height: processed.height ?? dimensions?.height,
    },
  });
  return true;
}

async function main() {
  const externals = await prisma.mediaAsset.findMany({
    where: { provider: "EXTERNAL" },
    select: { id: true, providerFileId: true, alt: true },
  });
  console.log(`[migrate] ${externals.length} EXTERNAL asset(s) to copy into Drive`);

  let moved = 0;
  for (const asset of externals) {
    if (!asset.providerFileId) continue;
    const ok = await migrateOneAsset(asset.id, asset.providerFileId, asset.alt);
    if (ok) moved++;
    await new Promise((r) => setTimeout(r, 300)); // be polite to the source CDN
  }
  console.log(`[migrate] ${moved}/${externals.length} moved to Drive`);

  // Drop the old convert step's source-warning quote and close the gap it
  // leaves in each article's block order.
  const quotes = await prisma.articleBlock.findMany({
    where: { type: "QUOTE" },
    select: { id: true, articleId: true, data: true },
  });
  const warningIds = quotes
    .filter((q) => {
      const text = (q.data as { text?: unknown } | null)?.text;
      return typeof text === "string" && text.startsWith("Nội dung tổng hợp từ nguồn bên ngoài");
    })
    .map((q) => ({ id: q.id, articleId: q.articleId }));

  if (warningIds.length > 0) {
    await prisma.articleBlock.deleteMany({ where: { id: { in: warningIds.map((w) => w.id) } } });
    for (const articleId of new Set(warningIds.map((w) => w.articleId))) {
      const remaining = await prisma.articleBlock.findMany({
        where: { articleId },
        orderBy: { order: "asc" },
        select: { id: true },
      });
      for (const [index, block] of remaining.entries()) {
        await prisma.articleBlock.update({ where: { id: block.id }, data: { order: index } });
      }
    }
  }
  console.log(`[migrate] removed ${warningIds.length} source-warning quote block(s)`);

  // Any article still without a cover takes its first body image.
  const uncovered = await prisma.article.findMany({
    where: { coverMediaId: null },
    select: { id: true, blocks: { where: { type: "IMAGE" }, orderBy: { order: "asc" }, take: 1, select: { data: true } } },
  });
  let covered = 0;
  for (const article of uncovered) {
    const mediaId = (article.blocks[0]?.data as { mediaId?: unknown } | undefined)?.mediaId;
    if (typeof mediaId !== "string") continue;
    await prisma.article.update({ where: { id: article.id }, data: { coverMediaId: mediaId } });
    covered++;
  }
  console.log(`[migrate] set cover from first body image on ${covered} article(s)`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
