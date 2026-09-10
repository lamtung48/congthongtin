import { prisma } from "@/server/db/client";

/**
 * `Video` is the *published* record the public site reads — the homepage's
 * "Video và phóng sự" section and `/video` both list these, never raw
 * `MediaAsset` rows. Attaching a YouTube link creates the `MediaAsset`
 * (so it can be embedded in an article body); this is what additionally
 * puts it on the public site.
 *
 * The section it lands in is the "Video và phóng sự" category when that
 * exists, falling back to whichever category sorts first so a video is never
 * rejected purely for taxonomy reasons.
 */
const PREFERRED_CATEGORY_SLUG = "video-phong-su";

async function resolveCategoryId(): Promise<string | null> {
  const preferred = await prisma.category.findUnique({ where: { slug: PREFERRED_CATEGORY_SLUG }, select: { id: true } });
  if (preferred) return preferred.id;
  const first = await prisma.category.findFirst({ orderBy: { order: "asc" }, select: { id: true } });
  return first?.id ?? null;
}

export const videoRepository = {
  findByMediaId(mediaId: string) {
    return prisma.video.findFirst({ where: { mediaId } });
  },

  /** Idempotent: a media asset already published as a video is left alone,
   *  so re-linking or re-running a backfill never duplicates a row. */
  async publishFromMedia(input: {
    mediaId: string;
    title: string;
    description: string;
    durationSeconds: number | null;
    slug: string;
  }) {
    const existing = await this.findByMediaId(input.mediaId);
    if (existing) return existing;
    const categoryId = await resolveCategoryId();
    if (!categoryId) return null;
    return prisma.video.create({
      data: {
        slug: input.slug,
        title: input.title,
        description: input.description,
        categoryId,
        durationSeconds: input.durationSeconds,
        mediaId: input.mediaId,
        publishedAt: new Date(),
      },
    });
  },

  removeByMediaId(mediaId: string) {
    return prisma.video.deleteMany({ where: { mediaId } });
  },
};
