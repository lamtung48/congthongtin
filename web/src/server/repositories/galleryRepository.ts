import { prisma } from "@/server/db/client";

/**
 * "Ảnh hoạt động" — the homepage photo set. A `Gallery` is an ordered list
 * of `MediaAsset`s with per-photo captions; the public site reads whichever
 * gallery the CMS pinned, falling back to the most recent
 * (`homepageRepository.fallback.latestGallery`).
 *
 * `GalleryItem.order` is unique per gallery, so every write that changes
 * ordering renumbers the whole list in one transaction rather than patching
 * individual rows — the same "whole list, not a diff" contract
 * `articleRepository.replaceBlocks` uses, and the only way to avoid
 * transient unique-constraint collisions while items move past each other.
 */
const withItems = {
  items: { orderBy: { order: "asc" as const }, include: { media: true } },
} as const;

/** Renumbers to a gap-free 0..n-1 using a two-phase shift: the first pass
 *  parks every row at a negative order so the second pass can assign the
 *  real ones without ever colliding with a row that has not moved yet. */
async function renumber(galleryId: string, orderedIds: string[]): Promise<void> {
  await prisma.$transaction([
    ...orderedIds.map((id, i) =>
      prisma.galleryItem.update({ where: { id }, data: { order: -(i + 1) } }),
    ),
    ...orderedIds.map((id, i) =>
      prisma.galleryItem.update({ where: { id }, data: { order: i } }),
    ),
  ]);
}

export const galleryRepository = {
  list() {
    return prisma.gallery.findMany({ orderBy: { createdAt: "desc" }, include: withItems });
  },

  findById(id: string) {
    return prisma.gallery.findUnique({ where: { id }, include: withItems });
  },

  create(data: { title: string; slug: string | null; description: string | null }) {
    return prisma.gallery.create({ data, include: withItems });
  },

  update(id: string, data: { title?: string; slug?: string | null; description?: string | null }) {
    return prisma.gallery.update({ where: { id }, data, include: withItems });
  },

  remove(id: string) {
    // `GalleryItem` cascades on gallery delete; the `MediaAsset`s themselves
    // are left alone — they are library entries that may be used elsewhere.
    return prisma.gallery.delete({ where: { id } });
  },

  /** Appends photos to the end of the gallery, skipping any already in it. */
  async addMedia(galleryId: string, mediaIds: string[]): Promise<number> {
    const existing = await prisma.galleryItem.findMany({ where: { galleryId }, select: { mediaId: true, order: true } });
    const already = new Set(existing.map((i) => i.mediaId));
    const fresh = mediaIds.filter((id) => !already.has(id));
    if (fresh.length === 0) return 0;
    let next = existing.reduce((max, i) => Math.max(max, i.order), -1) + 1;
    await prisma.galleryItem.createMany({
      data: fresh.map((mediaId) => ({ galleryId, mediaId, order: next++ })),
    });
    return fresh.length;
  },

  async removeItem(itemId: string): Promise<void> {
    const item = await prisma.galleryItem.findUnique({ where: { id: itemId }, select: { galleryId: true } });
    if (!item) return;
    await prisma.galleryItem.delete({ where: { id: itemId } });
    const rest = await prisma.galleryItem.findMany({
      where: { galleryId: item.galleryId },
      orderBy: { order: "asc" },
      select: { id: true },
    });
    await renumber(item.galleryId, rest.map((r) => r.id));
  },

  setItemCaption(itemId: string, caption: string | null) {
    return prisma.galleryItem.update({ where: { id: itemId }, data: { caption } });
  },

  /** Moves one photo one slot toward the start (`-1`) or end (`+1`). */
  async moveItem(itemId: string, direction: -1 | 1): Promise<void> {
    const item = await prisma.galleryItem.findUnique({ where: { id: itemId }, select: { galleryId: true } });
    if (!item) return;
    const items = await prisma.galleryItem.findMany({
      where: { galleryId: item.galleryId },
      orderBy: { order: "asc" },
      select: { id: true },
    });
    const from = items.findIndex((i) => i.id === itemId);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= items.length) return;
    const ids = items.map((i) => i.id);
    [ids[from], ids[to]] = [ids[to], ids[from]];
    await renumber(item.galleryId, ids);
  },
};
