import { prisma } from "@/server/db/client";
import type { MediaUsageType, Prisma } from "@/generated/prisma/client";

/**
 * Metadata-only, per brief section 10 — no binary ever passes through this
 * layer. `MediaUsage` rows are how `MediaService.findUsages()` answers "what
 * breaks if this asset is deleted/replaced" across every content type,
 * including the ones a typed foreign key can't reach (an image referenced
 * from inside an `ArticleBlock.data` JSON gallery block).
 */
export const mediaRepository = {
  findById(id: string) {
    return prisma.mediaAsset.findUnique({ where: { id } });
  },

  list(params: { skip?: number; take?: number; createdById?: string } = {}) {
    return prisma.mediaAsset.findMany({
      where: params.createdById ? { createdById: params.createdById } : undefined,
      orderBy: { createdAt: "desc" },
      skip: params.skip,
      take: params.take,
    });
  },

  count(createdById?: string) {
    return prisma.mediaAsset.count({ where: createdById ? { createdById } : undefined });
  },

  create(data: Prisma.MediaAssetCreateInput) {
    return prisma.mediaAsset.create({ data });
  },

  updateStatus(id: string, status: Prisma.MediaAssetUpdateInput["status"]) {
    return prisma.mediaAsset.update({ where: { id }, data: { status } });
  },

  recordUsage(mediaId: string, usageType: MediaUsageType, referenceId: string) {
    return prisma.mediaUsage.create({ data: { mediaId, usageType, referenceId } });
  },

  removeUsage(mediaId: string, usageType: MediaUsageType, referenceId: string) {
    return prisma.mediaUsage.deleteMany({ where: { mediaId, usageType, referenceId } });
  },

  listUsages(mediaId: string) {
    return prisma.mediaUsage.findMany({ where: { mediaId } });
  },
};
