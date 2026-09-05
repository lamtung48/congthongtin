import { mediaRepository } from "@/server/repositories/mediaRepository";
import { auditLogRepository } from "@/server/repositories/auditLogRepository";
import type { MediaUsageType, Prisma } from "@/generated/prisma/client";

/**
 * Real Drive/YouTube upload integration is explicitly out of scope for this
 * task (brief item 18) — this service only manages the metadata row and its
 * usage graph, exactly like the frontend's `resolveMedia.ts` stub only ever
 * dealt with metadata (`docs/MEDIA_ARCHITECTURE.md`). A future upload
 * pipeline calls `registerAsset` once the provider file actually exists.
 */
export const mediaService = {
  getById: mediaRepository.findById,
  list: mediaRepository.list,
  count: mediaRepository.count,

  registerAsset(data: Prisma.MediaAssetCreateInput, actorId: string | null) {
    return mediaRepository.create(data).then(async (asset) => {
      await auditLogRepository.record({ actorId, action: "CREATE", entityType: "MediaAsset", entityId: asset.id });
      return asset;
    });
  },

  attachUsage(mediaId: string, usageType: MediaUsageType, referenceId: string) {
    return mediaRepository.recordUsage(mediaId, usageType, referenceId);
  },

  detachUsage(mediaId: string, usageType: MediaUsageType, referenceId: string) {
    return mediaRepository.removeUsage(mediaId, usageType, referenceId);
  },

  /** What would break if this asset were deleted right now. */
  findUsages: mediaRepository.listUsages,
};
