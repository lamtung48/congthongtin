import { prisma } from "@/server/db/client";
import type { MediaStatus, MediaType, MediaUsageType, Prisma, YoutubeVisibility } from "@/generated/prisma/client";

/**
 * Metadata-only, per brief section 6: no binary ever passes through this
 * layer — `googleDrive.ts` is the only place that touches actual file
 * bytes. `MediaUsage` rows are how usage-tracking answers "what breaks if
 * this asset is deleted" for the one place a typed FK can't reach (an
 * image referenced from inside an `ArticleBlock.data` JSON block); every
 * other content type (Article cover/OG, Organization logo, Event cover,
 * Gallery item, Video, Author/User avatar, Topic cover) already has a real
 * foreign key, so `getUsageDetail` reads those directly instead of
 * duplicating them into `MediaUsage` too.
 */

export interface MediaAdminFilter {
  createdById?: string;
  type?: MediaType;
  status?: MediaStatus;
  /** `/admin/media/videos`'s visibility filter — meaningless for IMAGE
   *  rows (always `null`), so combining it with `type: "VIDEO"` is the
   *  caller's job, not enforced here. */
  visibility?: YoutubeVisibility;
  createdFrom?: Date;
  createdTo?: Date;
  skip?: number;
  take?: number;
}

function buildWhere(params: MediaAdminFilter): Prisma.MediaAssetWhereInput {
  const where: Prisma.MediaAssetWhereInput = {
    createdById: params.createdById,
    type: params.type,
    status: params.status,
    visibility: params.visibility,
  };
  if (params.createdFrom || params.createdTo) {
    where.createdAt = { gte: params.createdFrom, lte: params.createdTo };
  }
  return where;
}

/** One place a media asset is referenced. `hardBlock` distinguishes a
 *  required (`NOT NULL`) foreign key — `GalleryItem.mediaId`/`Video.mediaId`
 *  — which Postgres will refuse to null out, from every other kind of usage
 *  (an optional FK, or an `ArticleBlock` reference), which an Admin's
 *  force-delete can clear on the asset's way out. */
export interface MediaUsageDetail {
  usageType: MediaUsageType | "USER_AVATAR" | "AUTHOR_AVATAR" | "TOPIC_COVER" | "ARTICLE_COVER" | "ARTICLE_OG";
  hardBlock: boolean;
  entityId: string;
  entityLabel: string;
}

const usageDetailInclude = {
  usedAsUserAvatar: { select: { id: true, displayName: true } },
  usedAsAuthorAvatar: { select: { id: true, displayName: true } },
  usedAsOrgLogo: { select: { id: true, name: true } },
  usedAsTopicCover: { select: { id: true, name: true } },
  usedAsArticleCover: { select: { id: true, title: true } },
  usedAsArticleOg: { select: { id: true, title: true } },
  usedAsEventCover: { select: { id: true, title: true } },
  galleryItems: { include: { gallery: { select: { id: true, title: true } } } },
  videos: { select: { id: true, title: true } },
  usages: true,
} satisfies Prisma.MediaAssetInclude;

export const mediaRepository = {
  findById(id: string) {
    return prisma.mediaAsset.findUnique({ where: { id } });
  },

  /** Includes the uploader's display name — the "người upload" column on
   *  `/admin/media` needs it on every row, and fetching it per-row after the
   *  fact would be an N+1 query for no reason. */
  list(params: MediaAdminFilter = {}) {
    return prisma.mediaAsset.findMany({
      where: buildWhere(params),
      orderBy: { createdAt: "desc" },
      skip: params.skip,
      take: params.take,
      include: { createdBy: { select: { id: true, displayName: true } } },
    });
  },

  count(params: MediaAdminFilter = {}) {
    return prisma.mediaAsset.count({ where: buildWhere(params) });
  },

  create(data: Prisma.MediaAssetCreateInput) {
    return prisma.mediaAsset.create({ data });
  },

  updateMetadata(id: string, data: { alt?: string | null; caption?: string | null }) {
    return prisma.mediaAsset.update({ where: { id }, data });
  },

  /** The YOUTUBE-provider-specific fields `youtubeService.ts` writes after
   *  an upload/link/metadata-edit/status-refresh — `filename` doubles as
   *  the video's own YouTube title and `caption` as its description (see
   *  `MediaAsset.visibility`'s schema comment for why no dedicated `title`
   *  column exists). Kept separate from `updateMetadata` (image alt/caption
   *  edits) since the field sets barely overlap and mixing them would make
   *  either caller's intent less obvious at the call site. */
  updateVideoDetails(
    id: string,
    data: {
      filename?: string;
      caption?: string;
      visibility?: YoutubeVisibility | null;
      durationSeconds?: number | null;
      errorReason?: string | null;
      status?: MediaStatus;
    },
  ) {
    return prisma.mediaAsset.update({ where: { id }, data });
  },

  updateStatus(id: string, status: MediaStatus) {
    return prisma.mediaAsset.update({ where: { id }, data: { status } });
  },

  remove(id: string) {
    return prisma.mediaAsset.delete({ where: { id } });
  },

  recordUsage(mediaId: string, usageType: MediaUsageType, referenceId: string) {
    return prisma.mediaUsage.create({ data: { mediaId, usageType, referenceId } });
  },

  removeUsage(mediaId: string, usageType: MediaUsageType, referenceId: string) {
    return prisma.mediaUsage.deleteMany({ where: { mediaId, usageType, referenceId } });
  },

  /** Replaces every `ARTICLE_BLOCK` usage row for one article in one
   *  transaction — the same "whole list, not a diff" contract
   *  `articleRepository.replaceBlocks` already uses, so the two always
   *  move in lockstep (called right after `replaceBlocks` — see
   *  `articleService.ts`). */
  replaceArticleBlockUsages(articleId: string, mediaIds: string[]) {
    const unique = [...new Set(mediaIds)];
    return prisma.$transaction([
      prisma.mediaUsage.deleteMany({ where: { usageType: "ARTICLE_BLOCK", referenceId: articleId } }),
      ...unique.map((mediaId) => prisma.mediaUsage.create({ data: { mediaId, usageType: "ARTICLE_BLOCK", referenceId: articleId } })),
    ]);
  },

  listUsages(mediaId: string) {
    return prisma.mediaUsage.findMany({ where: { mediaId } });
  },

  /** Every place this asset is referenced, direct-FK and `MediaUsage` rows
   *  combined — brief section 7's full list (Article cover/block, Gallery,
   *  Homepage, Organization logo, Event) plus the avatar/topic-cover FKs
   *  the schema also has. "Homepage" isn't its own row here: a homepage
   *  placement points at an Article/Gallery/Event/Platform, never at a
   *  `MediaAsset` directly (see docs/GOOGLE_DRIVE_MEDIA.md, "Usage
   *  tracking"), so it surfaces transitively through that Article/Gallery/
   *  Event's own usage row. `Platform` has no media field in this schema at
   *  all, so it never appears here either — not an oversight, see the same
   *  doc section. */
  async getUsageDetail(mediaId: string): Promise<MediaUsageDetail[]> {
    const asset = await prisma.mediaAsset.findUnique({ where: { id: mediaId }, include: usageDetailInclude });
    if (!asset) return [];
    const detail: MediaUsageDetail[] = [];
    for (const u of asset.usedAsUserAvatar) detail.push({ usageType: "USER_AVATAR", hardBlock: false, entityId: u.id, entityLabel: `Ảnh đại diện tài khoản: ${u.displayName}` });
    for (const a of asset.usedAsAuthorAvatar) detail.push({ usageType: "AUTHOR_AVATAR", hardBlock: false, entityId: a.id, entityLabel: `Ảnh đại diện tác giả: ${a.displayName}` });
    for (const o of asset.usedAsOrgLogo) detail.push({ usageType: "ORGANIZATION_LOGO", hardBlock: false, entityId: o.id, entityLabel: `Logo đơn vị: ${o.name}` });
    for (const t of asset.usedAsTopicCover) detail.push({ usageType: "TOPIC_COVER", hardBlock: false, entityId: t.id, entityLabel: `Ảnh bìa chủ đề: ${t.name}` });
    for (const a of asset.usedAsArticleCover) detail.push({ usageType: "ARTICLE_COVER", hardBlock: false, entityId: a.id, entityLabel: `Ảnh bìa bài viết: ${a.title}` });
    for (const a of asset.usedAsArticleOg) detail.push({ usageType: "ARTICLE_OG", hardBlock: false, entityId: a.id, entityLabel: `Ảnh chia sẻ (OG) bài viết: ${a.title}` });
    for (const e of asset.usedAsEventCover) detail.push({ usageType: "EVENT_COVER", hardBlock: false, entityId: e.id, entityLabel: `Ảnh bìa sự kiện: ${e.title}` });
    for (const gi of asset.galleryItems) detail.push({ usageType: "GALLERY_ITEM", hardBlock: true, entityId: gi.galleryId, entityLabel: `Ảnh trong bộ sưu tập: ${gi.gallery.title}` });
    for (const v of asset.videos) detail.push({ usageType: "VIDEO_SOURCE", hardBlock: true, entityId: v.id, entityLabel: `Nguồn video: ${v.title}` });
    for (const u of asset.usages) detail.push({ usageType: u.usageType, hardBlock: false, entityId: u.referenceId, entityLabel: `Dùng trong nội dung bài viết (khối nội dung)` });
    return detail;
  },

  /** Nulls out every *optional* FK pointing at this asset — used only by an
   *  Admin's force-delete, and only after `getUsageDetail` has confirmed no
   *  `hardBlock` usage exists (a required FK can't be nulled; the caller
   *  must refuse first). `MediaUsage` rows aren't touched here — deleting
   *  the `MediaAsset` row itself cascades those away (`onDelete: Cascade`
   *  in schema.prisma). */
  clearOptionalReferences(mediaId: string) {
    return prisma.$transaction([
      prisma.user.updateMany({ where: { avatarMediaId: mediaId }, data: { avatarMediaId: null } }),
      prisma.authorProfile.updateMany({ where: { avatarMediaId: mediaId }, data: { avatarMediaId: null } }),
      prisma.organization.updateMany({ where: { logoMediaId: mediaId }, data: { logoMediaId: null } }),
      prisma.topic.updateMany({ where: { coverMediaId: mediaId }, data: { coverMediaId: null } }),
      prisma.article.updateMany({ where: { coverMediaId: mediaId }, data: { coverMediaId: null } }),
      prisma.article.updateMany({ where: { ogMediaId: mediaId }, data: { ogMediaId: null } }),
      prisma.event.updateMany({ where: { coverMediaId: mediaId }, data: { coverMediaId: null } }),
    ]);
  },
};
