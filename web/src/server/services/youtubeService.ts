import { randomBytes } from "node:crypto";
import { mediaRepository } from "@/server/repositories/mediaRepository";
import { youtubeConnectionRepository } from "@/server/repositories/youtubeConnectionRepository";
import { auditLogRepository } from "@/server/repositories/auditLogRepository";
import {
  buildYoutubeAuthUrl,
  exchangeCodeForTokens,
  encryptToken,
  isYoutubeConfigured,
  uploadVideoToYoutube,
  getVideoStatus,
  updateVideoMetadata as updateYoutubeVideoMetadata,
  listChannelUploads,
  type YoutubePrivacyStatus,
} from "@/server/integrations/youtube";
import { parseYoutubeVideoId } from "@/server/validation/youtubeUrl";
import { hasPermission } from "@/server/auth/permissions";
import type { SessionUser } from "@/server/auth/session";
import type { MediaAsset, MediaStatus, YoutubeVisibility } from "@/generated/prisma/client";

/**
 * YouTube integration task's business rules — the counterpart to
 * `mediaService.ts` for `provider: YOUTUBE` assets specifically. Every
 * mutation re-checks permission/policy independently of the calling route/
 * UI, same discipline as the rest of this codebase. `src/server/
 * integrations/youtube.ts` is the only module that talks to Google; this
 * file only ever passes it a video id or a buffer, or reads back what it
 * returns.
 *
 * Deleting a YOUTUBE-provider `MediaAsset` never deletes the underlying
 * YouTube video — `mediaService.remove()` only calls the provider's real
 * delete for `GOOGLE_DRIVE` (see its own code), so removing one from this
 * CMS's library is always just unlinking it, never touching the channel.
 * A channel's videos can outlive their presence in any one CMS's content.
 */

function assertIsAdmin(actor: SessionUser) {
  if (actor.role !== "ADMIN") {
    throw new Error("Chỉ Admin mới có thể quản lý cấu hình kết nối YouTube.");
  }
}

function assertCanManageAsset(actor: SessionUser, asset: { createdById: string | null }) {
  if (hasPermission(actor.role, "media.manage.any")) return;
  if (hasPermission(actor.role, "media.manage.own") && asset.createdById === actor.id) return;
  throw new Error("Không có quyền quản lý video này.");
}

/** Brief section 3: "CONTRIBUTOR nếu được upload... mặc định UNLISTED."
 *  Deployment-wide, not per-user — an Admin turning this on takes effect
 *  for every Contributor at once (env var, not a DB row — see
 *  docs/YOUTUBE_INTEGRATION.md, "Policy configuration" for why an env var
 *  was chosen over a live-editable setting). */
export function isContributorVideoUploadAllowed(): boolean {
  return process.env.YOUTUBE_ALLOW_CONTRIBUTOR_UPLOAD === "true";
}

/** Non-throwing form of the same check, for UI decisions (show/hide the
 *  upload option) — `assertCanUpload` below is the actual enforcement
 *  point; this must never be the only thing standing between a role and
 *  the upload route. */
export function canUploadVideo(actor: SessionUser): boolean {
  if (hasPermission(actor.role, "media.manage.any")) return true;
  if (!hasPermission(actor.role, "media.manage.own")) return false;
  return actor.role !== "CONTRIBUTOR" || isContributorVideoUploadAllowed();
}

function assertCanUpload(actor: SessionUser) {
  if (hasPermission(actor.role, "media.manage.any")) return;
  if (!hasPermission(actor.role, "media.manage.own")) {
    throw new Error("Không có quyền tải video lên.");
  }
  if (actor.role === "CONTRIBUTOR" && !isContributorVideoUploadAllowed()) {
    throw new Error("Tải video lên hiện chưa được bật cho Cộng tác viên. Vui lòng chọn video có sẵn hoặc dán URL/ID.");
  }
}

/** Forces a Contributor's upload to `unlisted` server-side regardless of
 *  what the form submitted — the UI (`VideoUploader`) shouldn't even offer
 *  the choice, but this is the actual enforcement point, not that omission. */
function resolvePrivacyForUpload(actor: SessionUser, requested: YoutubePrivacyStatus): YoutubePrivacyStatus {
  if (hasPermission(actor.role, "media.manage.any")) return requested;
  return "unlisted";
}

function mapUploadStatusToMedia(uploadStatus: string, privacyStatus: YoutubePrivacyStatus, embeddable: boolean): { status: MediaStatus; errorReason: string | null } {
  if (uploadStatus === "failed" || uploadStatus === "rejected") return { status: "REMOVED", errorReason: "upload_failed" };
  if (uploadStatus === "deleted") return { status: "REMOVED", errorReason: "removed" };
  if (uploadStatus !== "processed") return { status: "PROCESSING", errorReason: null };
  if (privacyStatus === "private") return { status: "READY", errorReason: "private" };
  if (!embeddable) return { status: "READY", errorReason: "embed_disabled" };
  return { status: "READY", errorReason: null };
}

function toYoutubeVisibility(privacyStatus: YoutubePrivacyStatus): YoutubeVisibility {
  return privacyStatus.toUpperCase() as YoutubeVisibility;
}

export const youtubeService = {
  isConfigured: isYoutubeConfigured,
  isContributorUploadAllowed: isContributorVideoUploadAllowed,
  canUploadVideo,

  /** Connection status any admin-area page can show — never the token. */
  async getConnectionStatus(actor: SessionUser) {
    assertIsAdmin(actor);
    const connection = await youtubeConnectionRepository.get();
    if (!connection) return { connected: false as const };
    return { connected: true as const, channelId: connection.channelId, channelTitle: connection.channelTitle, connectedAt: connection.connectedAt };
  },

  /** Step 1 of the OAuth consent flow — Admin only. `state` is a random
   *  nonce the caller (the Server Action) stores in a short-lived, signed
   *  cookie and compares against the callback's `state` query param, so a
   *  third party can't trick an Admin's browser into completing a
   *  connection with attacker-controlled tokens (a standard OAuth CSRF
   *  mitigation). */
  beginConnect(actor: SessionUser): { url: string; state: string } {
    assertIsAdmin(actor);
    const state = randomBytes(16).toString("hex");
    return { url: buildYoutubeAuthUrl(state), state };
  },

  /** Step 2 — called by the OAuth callback route after it has already
   *  verified `state` matches. */
  async completeConnect(actor: SessionUser, code: string) {
    assertIsAdmin(actor);
    const { refreshToken, channelId, channelTitle } = await exchangeCodeForTokens(code);
    const connection = await youtubeConnectionRepository.upsert({
      channelId,
      channelTitle,
      encryptedRefreshToken: encryptToken(refreshToken),
      scope: "https://www.googleapis.com/auth/youtube",
      connectedById: actor.id,
    });
    await auditLogRepository.record({
      actorId: actor.id,
      action: "CONNECT_YOUTUBE",
      entityType: "YoutubeConnection",
      entityId: connection.id,
      metadata: { channelId, channelTitle },
    });
    return connection;
  },

  async disconnect(actor: SessionUser) {
    assertIsAdmin(actor);
    const connection = await youtubeConnectionRepository.get();
    await youtubeConnectionRepository.disconnect();
    if (connection) {
      await auditLogRepository.record({
        actorId: actor.id,
        action: "DISCONNECT_YOUTUBE",
        entityType: "YoutubeConnection",
        entityId: connection.id,
        metadata: { channelId: connection.channelId, channelTitle: connection.channelTitle },
      });
    }
  },

  /** Brief section 3: real YouTube upload with title/description/
   *  visibility. Creates a `MediaAsset` only after the upload itself
   *  succeeds — never a placeholder for one that might fail. */
  async uploadVideo(
    actor: SessionUser,
    data: { buffer: Buffer; mimeType: string; title: string; description: string; visibility: YoutubePrivacyStatus },
  ): Promise<MediaAsset> {
    assertCanUpload(actor);
    const privacyStatus = resolvePrivacyForUpload(actor, data.visibility);
    const { videoId } = await uploadVideoToYoutube(data.buffer, data.mimeType, { title: data.title, description: data.description, privacyStatus });

    // Best-effort immediate status read — duration/embeddable are often not
    // ready yet (YouTube is still processing), so this can legitimately
    // come back mostly empty; `PROCESSING` covers that case and the row is
    // refreshed later (see `refreshStatus`).
    const status = await getVideoStatus(videoId).catch(() => null);
    const mapped = status ? mapUploadStatusToMedia(status.uploadStatus, status.privacyStatus, status.embeddable) : { status: "PROCESSING" as const, errorReason: null };

    const asset = await mediaRepository.create({
      provider: "YOUTUBE",
      providerFileId: videoId,
      type: "VIDEO",
      filename: data.title,
      caption: data.description || undefined,
      visibility: toYoutubeVisibility(privacyStatus),
      durationSeconds: status?.durationSeconds,
      status: mapped.status,
      errorReason: mapped.errorReason,
      createdBy: { connect: { id: actor.id } },
    });
    await auditLogRepository.record({
      actorId: actor.id,
      action: "UPLOAD_VIDEO",
      entityType: "MediaAsset",
      entityId: asset.id,
      metadata: { videoId, title: data.title, visibility: privacyStatus },
    });
    return asset;
  },

  /** Brief section 2: "Dán URL/Video ID" — open to any role that can
   *  manage its own media (Contributor included), unlike browsing the raw
   *  channel. Verifies the id against the real API before creating
   *  anything (never trusts a client-typed id/title the way the old manual-
   *  link form used to for YOUTUBE assets). */
  async linkExistingVideo(actor: SessionUser, input: string): Promise<MediaAsset> {
    if (!hasPermission(actor.role, "media.manage.own") && !hasPermission(actor.role, "media.manage.any")) {
      throw new Error("Không có quyền thêm video.");
    }
    const videoId = parseYoutubeVideoId(input);
    if (!videoId) {
      throw new Error("Không nhận diện được URL hoặc video ID YouTube hợp lệ.");
    }
    return importChannelVideoById(actor, videoId, "LINK_VIDEO");
  },

  /** Brief section 2: "Chọn video đã có trên kênh" — browsing the raw
   *  connected channel is an Admin/Manager curation capability, not
   *  something Contributor's "chọn video đã có" (their own library) reaches. */
  async listChannelUploadsForPicker(actor: SessionUser, pageToken?: string) {
    if (!hasPermission(actor.role, "media.manage.any")) {
      throw new Error("Chỉ Admin/Quản trị viên mới có thể duyệt video trên kênh YouTube.");
    }
    return listChannelUploads(pageToken);
  },

  /** Imports one specific video chosen from `listChannelUploadsForPicker`'s
   *  results — same underlying import as `linkExistingVideo`, just sourced
   *  from a channel-browse click instead of a pasted URL, so it gets the
   *  same audit action (`LINK_VIDEO` — both are "attach an existing video",
   *  not a new upload). */
  async importChannelVideo(actor: SessionUser, videoId: string): Promise<MediaAsset> {
    if (!hasPermission(actor.role, "media.manage.any")) {
      throw new Error("Chỉ Admin/Quản trị viên mới có thể chọn video từ kênh YouTube.");
    }
    return importChannelVideoById(actor, videoId, "LINK_VIDEO");
  },

  /** Pushes the change to the real YouTube video (title/description/
   *  visibility), then mirrors it locally. A Contributor may only touch
   *  their own upload and can never move it to `public` (same "không tự
   *  public" rule as upload) or to `private` (would silently break every
   *  article already embedding it, and this CMS has no per-Contributor
   *  notion of "safe to make private"). */
  async updateVideoMetadata(actor: SessionUser, mediaId: string, changes: { title?: string; description?: string; visibility?: YoutubePrivacyStatus }) {
    const asset = await mediaRepository.findById(mediaId);
    if (!asset) throw new Error("Không tìm thấy video.");
    assertCanManageAsset(actor, asset);
    if (!asset.providerFileId || asset.provider !== "YOUTUBE") {
      throw new Error("Media này không phải video YouTube.");
    }
    const visibility = changes.visibility;
    if (visibility && !hasPermission(actor.role, "media.manage.any")) {
      if (visibility !== "unlisted") {
        throw new Error("Bạn chỉ có thể đặt video ở trạng thái Không công khai (unlisted).");
      }
    }
    await updateYoutubeVideoMetadata(asset.providerFileId, { title: changes.title, description: changes.description, privacyStatus: visibility });
    const updated = await mediaRepository.updateVideoDetails(mediaId, {
      filename: changes.title,
      caption: changes.description,
      visibility: visibility ? toYoutubeVisibility(visibility) : undefined,
    });
    await auditLogRepository.record({ actorId: actor.id, action: "UPDATE_VIDEO", entityType: "MediaAsset", entityId: mediaId });
    return updated;
  },

  /** Re-reads the video's current state from YouTube and updates the
   *  cached fields (`status`/`errorReason`/`visibility`/`durationSeconds`)
   *  — the "Kiểm tra trạng thái" action on `/admin/media/videos`. Not
   *  audited: a read-triggered cache refresh isn't itself a content
   *  change worth its own log entry (mirrors why a Drive file's status
   *  check wasn't audited either). */
  async refreshStatus(actor: SessionUser, mediaId: string) {
    const asset = await mediaRepository.findById(mediaId);
    if (!asset) throw new Error("Không tìm thấy video.");
    assertCanManageAsset(actor, asset);
    if (!asset.providerFileId || asset.provider !== "YOUTUBE") {
      throw new Error("Media này không phải video YouTube.");
    }
    const status = await getVideoStatus(asset.providerFileId);
    if (!status) {
      return mediaRepository.updateVideoDetails(mediaId, { status: "REMOVED", errorReason: "removed" });
    }
    const mapped = mapUploadStatusToMedia(status.uploadStatus, status.privacyStatus, status.embeddable);
    return mediaRepository.updateVideoDetails(mediaId, {
      filename: status.title || asset.filename || undefined,
      caption: status.description || undefined,
      visibility: toYoutubeVisibility(status.privacyStatus),
      durationSeconds: status.durationSeconds,
      status: mapped.status,
      errorReason: mapped.errorReason,
    });
  },
};

async function importChannelVideoById(actor: SessionUser, videoId: string, auditAction: "LINK_VIDEO"): Promise<MediaAsset> {
  const status = await getVideoStatus(videoId);
  if (!status) {
    throw new Error("Không tìm thấy video này trên YouTube (có thể riêng tư, đã bị xoá, hoặc ID không đúng).");
  }
  const mapped = mapUploadStatusToMedia(status.uploadStatus, status.privacyStatus, status.embeddable);
  const asset = await mediaRepository.create({
    provider: "YOUTUBE",
    providerFileId: videoId,
    type: "VIDEO",
    filename: status.title || videoId,
    caption: status.description || undefined,
    visibility: toYoutubeVisibility(status.privacyStatus),
    durationSeconds: status.durationSeconds,
    status: mapped.status,
    errorReason: mapped.errorReason,
    createdBy: { connect: { id: actor.id } },
  });
  await auditLogRepository.record({
    actorId: actor.id,
    action: auditAction,
    entityType: "MediaAsset",
    entityId: asset.id,
    metadata: { videoId, title: status.title },
  });
  return asset;
}
