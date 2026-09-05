import { mediaRepository, type MediaAdminFilter, type MediaUsageDetail } from "@/server/repositories/mediaRepository";
import { auditLogRepository } from "@/server/repositories/auditLogRepository";
import { deleteFileFromDrive } from "@/server/integrations/googleDrive";
import { hasPermission } from "@/server/auth/permissions";
import type { SessionUser } from "@/server/auth/session";
import type { MediaProvider, MediaType } from "@/generated/prisma/client";

/**
 * Media Library business rules (Google Drive integration brief). Every
 * mutation re-checks permission and, for delete, ownership + usage —
 * independently of whatever the calling route/UI already checked, same
 * discipline as `articleService`/`userService`. `googleDrive.ts` is the
 * only place that talks to Google; this file only ever passes it a
 * `providerFileId` to delete or reads back what it already has.
 */

/** Thrown by `remove()` when an Admin tries to delete a still-referenced
 *  asset without `force: true` — carries the usage list so the caller (the
 *  Server Action) can hand it to the UI to render as a confirmation
 *  warning instead of a dead-end error. */
export class MediaInUseError extends Error {
  usage: MediaUsageDetail[];
  constructor(usage: MediaUsageDetail[]) {
    super(`Media đang được sử dụng tại ${usage.length} nơi.`);
    this.name = "MediaInUseError";
    this.usage = usage;
  }
}

function assertCanManage(actor: SessionUser, asset: { createdById: string | null }) {
  if (hasPermission(actor.role, "media.manage.any")) return;
  if (hasPermission(actor.role, "media.manage.own") && asset.createdById === actor.id) return;
  throw new Error("Không có quyền quản lý media này.");
}

export const mediaService = {
  getById: mediaRepository.findById,
  list: mediaRepository.list,
  count: mediaRepository.count,
  getUsageDetail: mediaRepository.getUsageDetail,

  /**
   * Deliberately does NOT scope by `actor` — brief section 5: "CONTRIBUTOR
   * ... có thể xem toàn thư viện để tái sử dụng ... nhưng chỉ quản lý media
   * của mình." Viewing (to reuse someone else's photo in a new article) and
   * managing (edit/delete) are different permissions here — unlike
   * `articleService.listForAdmin`, which does scope by actor because an
   * article draft is content, not a shared asset library. `params.createdById`
   * stays available as an opt-in filter (the "người upload" filter on
   * `/admin/media`, or a Contributor choosing to see just their own) — never
   * forced. Per-item manage actions (edit metadata, delete) still go through
   * `assertCanManage`/`remove`'s own ownership check regardless of what this
   * list returns.
   */
  listForAdmin(_actor: SessionUser, params: MediaAdminFilter = {}) {
    return mediaRepository.list(params);
  },

  countForAdmin(_actor: SessionUser, params: MediaAdminFilter = {}) {
    return mediaRepository.count(params);
  },

  /** Called once `googleDrive.uploadFileToDrive` has already succeeded (see
   *  `/api/admin/media/upload`) — this only ever registers metadata for a
   *  file that demonstrably exists, never a placeholder for one that
   *  might. Any role holding at least `media.manage.own` may register their
   *  own upload — Contributor included, per brief section 5. */
  async registerUpload(
    actor: SessionUser,
    data: { providerFileId: string; type: MediaType; filename: string; mimeType: string; size: number; width?: number; height?: number; alt?: string },
  ) {
    if (!hasPermission(actor.role, "media.manage.own") && !hasPermission(actor.role, "media.manage.any")) {
      throw new Error("Không có quyền tải lên media.");
    }
    const asset = await mediaRepository.create({
      provider: "GOOGLE_DRIVE",
      providerFileId: data.providerFileId,
      type: data.type,
      mimeType: data.mimeType,
      filename: data.filename,
      size: data.size,
      width: data.width,
      height: data.height,
      alt: data.alt,
      status: "READY",
      createdBy: { connect: { id: actor.id } },
    });
    await auditLogRepository.record({
      actorId: actor.id,
      action: "UPLOAD_MEDIA",
      entityType: "MediaAsset",
      entityId: asset.id,
      metadata: { filename: data.filename, size: data.size, mimeType: data.mimeType },
    });
    return asset;
  },

  /**
   * The advanced "liên kết file có sẵn" fallback (see `mediaActions.ts`),
   * for the two things a real Drive upload doesn't cover: a YouTube video id
   * (nothing to "upload" — it already lives on YouTube), and an Admin/
   * Manager manually pointing at a Drive file id created outside this app's
   * own upload flow. Restricted to `media.manage.any` for IMAGE specifically
   * — a Contributor must go through `MediaUploader`/`registerUpload`, which
   * actually verifies the file (brief section 9's validation) rather than
   * trusting whatever id a form field claims. VIDEO has no such upload path
   * to fall back to, so it stays open to anyone holding `media.manage.own`.
   */
  async registerManualLink(
    actor: SessionUser,
    data: { provider: MediaProvider; type: MediaType; providerFileId?: string; alt?: string; caption?: string },
  ) {
    const hasAny = hasPermission(actor.role, "media.manage.any");
    const hasOwn = hasPermission(actor.role, "media.manage.own");
    if (!hasOwn && !hasAny) {
      throw new Error("Không có quyền thêm media.");
    }
    if (data.type === "IMAGE" && !hasAny) {
      throw new Error("Chỉ Admin/Quản trị viên mới có thể liên kết ảnh thủ công — vui lòng dùng chức năng tải ảnh lên.");
    }
    const asset = await mediaRepository.create({
      provider: data.provider,
      providerFileId: data.providerFileId,
      type: data.type,
      alt: data.alt,
      caption: data.caption,
      status: data.providerFileId ? "READY" : "MISSING",
      createdBy: { connect: { id: actor.id } },
    });
    await auditLogRepository.record({
      actorId: actor.id,
      action: "UPLOAD_MEDIA",
      entityType: "MediaAsset",
      entityId: asset.id,
      metadata: { manual: true, provider: data.provider },
    });
    return asset;
  },

  /** Brief: Admin/Manager may edit any asset's alt/caption; Contributor
   *  only their own ("nếu policy cho phép" — the policy here is exactly
   *  "own uploads only", the same boundary `media.manage.own` already
   *  draws everywhere else). */
  async updateMetadata(actor: SessionUser, mediaId: string, input: { alt?: string | null; caption?: string | null }) {
    const asset = await mediaRepository.findById(mediaId);
    if (!asset) throw new Error("Không tìm thấy media.");
    assertCanManage(actor, asset);
    const updated = await mediaRepository.updateMetadata(mediaId, input);
    await auditLogRepository.record({ actorId: actor.id, action: "UPDATE_MEDIA", entityType: "MediaAsset", entityId: mediaId });
    return updated;
  },

  /**
   * Brief section 1's delete policy, by role:
   * - CONTRIBUTOR: only their own upload, and only if it has zero usage
   *   anywhere (brief: "Không được xóa media đang được nhiều bài sử dụng").
   * - MANAGER: any asset, but same zero-usage rule — "xóa nếu không vi
   *   phạm usage policy" reads as an unconditional block, not merely a
   *   warning, for this role.
   * - ADMIN: a `hardBlock` usage (`GalleryItem`/`Video`'s required FK)
   *   always refuses — Postgres can't null out a `NOT NULL` column, and
   *   auto-deleting the parent Gallery/Video the caller never asked to
   *   touch would be a surprising side effect. A `soft` usage (every
   *   optional FK, or an `ArticleBlock` reference) is refused UNLESS
   *   `force: true`, in which case every optional FK pointing at this
   *   asset is nulled out first (`MediaUsage` rows are cascade-deleted by
   *   the DB when the asset itself goes) — brief section 7: "bắt buộc
   *   cảnh báo/block theo policy," satisfied by requiring an explicit
   *   second call instead of silently succeeding on the first.
   */
  async remove(actor: SessionUser, mediaId: string, options: { force?: boolean } = {}) {
    const asset = await mediaRepository.findById(mediaId);
    if (!asset) throw new Error("Không tìm thấy media.");

    if (actor.role === "CONTRIBUTOR" && asset.createdById !== actor.id) {
      throw new Error("Bạn chỉ có thể xoá media do mình tải lên.");
    }

    const usage = await mediaRepository.getUsageDetail(mediaId);
    const hardBlockers = usage.filter((u) => u.hardBlock);
    if (hardBlockers.length > 0) {
      throw new Error(
        `Không thể xoá — media là nội dung bắt buộc của: ${hardBlockers.map((b) => b.entityLabel).join("; ")}. Vui lòng gỡ khỏi đó trước.`,
      );
    }

    if (usage.length > 0) {
      if (actor.role !== "ADMIN") {
        throw new Error(`Media đang được sử dụng tại ${usage.length} nơi — không thể xoá. Gỡ khỏi các nơi đó trước.`);
      }
      if (!options.force) {
        throw new MediaInUseError(usage);
      }
      await mediaRepository.clearOptionalReferences(mediaId);
    }

    if (asset.provider === "GOOGLE_DRIVE" && asset.providerFileId) {
      // Best-effort-but-blocking: if Drive refuses the delete, the DB row
      // is kept too, so the system never "forgets" a file that still
      // physically exists on Drive (brief section 10: no silent
      // inconsistency between the two).
      await deleteFileFromDrive(asset.providerFileId);
    }

    await mediaRepository.remove(mediaId);
    await auditLogRepository.record({ actorId: actor.id, action: "DELETE_MEDIA", entityType: "MediaAsset", entityId: mediaId });
  },
};
