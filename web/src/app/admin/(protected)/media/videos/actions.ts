"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/server/auth/session";
import { youtubeService } from "@/server/services/youtubeService";
import { YoutubeNotConfiguredError, YoutubeNotConnectedError, YoutubeOperationError, type YoutubePrivacyStatus } from "@/server/integrations/youtube";
import { MediaInUseError } from "@/server/services/mediaService";
import { mediaService } from "@/server/services/mediaService";
import { externalIntegrationRateLimiter } from "@/server/security/rateLimit";
import { homepageService } from "@/server/services/homepageService";
import { videoRepository } from "@/server/repositories/videoRepository";

/**
 * Every action re-checks permission/role inside `youtubeService` itself
 * (`requireSession()` here only confirms *someone* is logged in) — same
 * discipline as `articles/actions.ts`/`media/actions.ts`.
 *
 * Brief section 9: "external integration endpoint" — every action here
 * except `unlinkVideoAction` (a local DB delete, same class as regular
 * media management) either calls the real YouTube Data API or manages the
 * OAuth connection credential itself, so each gets the same
 * `externalIntegrationRateLimiter` bucket `syncSourceAction`/the OAuth
 * callback route already use.
 */

const OAUTH_STATE_COOKIE = "yt_oauth_state"; // must match src/app/api/admin/youtube/oauth/callback/route.ts

/** Step 1 of the connect flow — Admin only (enforced inside
 *  `youtubeService.beginConnect`). Stores the CSRF nonce in a short-lived
 *  cookie, then redirects the Admin's browser straight to Google's consent
 *  screen. */
export async function startYoutubeConnectAction(): Promise<void> {
  const actor = await requireSession();
  const { url, state } = youtubeService.beginConnect(actor);
  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  redirect(url);
}

export async function disconnectYoutubeAction(): Promise<void> {
  const actor = await requireSession();
  if (!externalIntegrationRateLimiter.check(actor.id).allowed) {
    throw new Error("Bạn đang thao tác quá nhanh — vui lòng thử lại sau ít phút.");
  }
  externalIntegrationRateLimiter.record(actor.id);
  await youtubeService.disconnect(actor);
  revalidatePath("/admin/media/videos");
}

export interface VideoActionResult {
  ok: boolean;
  error?: string;
  usage?: { entityLabel: string; hardBlock: boolean }[];
}

/** What `VideoPicker` needs to immediately select and display a
 *  freshly-linked/imported/uploaded video without a full page reload —
 *  mirrors `MediaOption`'s role for images, but keyed on the raw YouTube
 *  `videoId` (needed to derive a thumbnail/embed URL client-side) instead
 *  of a precomputed delivery URL, since a YouTube thumbnail is always a
 *  public, directly-loadable URL with no server proxying involved. */
export interface VideoOption {
  id: string;
  label: string;
  videoId: string;
  visibility: "PUBLIC" | "UNLISTED" | "PRIVATE" | null;
}

export interface LinkVideoResult extends VideoActionResult {
  video?: VideoOption;
}

function toVideoOption(asset: { id: string; filename: string | null; providerFileId: string | null; visibility: string | null }): VideoOption | undefined {
  if (!asset.providerFileId) return undefined;
  return { id: asset.id, label: asset.filename || asset.providerFileId, videoId: asset.providerFileId, visibility: asset.visibility as VideoOption["visibility"] };
}

export async function linkVideoAction(formData: FormData): Promise<LinkVideoResult> {
  const actor = await requireSession();
  if (!externalIntegrationRateLimiter.check(actor.id).allowed) {
    return { ok: false, error: "Bạn đang thao tác quá nhanh — vui lòng thử lại sau ít phút." };
  }
  externalIntegrationRateLimiter.record(actor.id);
  const input = String(formData.get("input") ?? "").trim();
  if (!input) return { ok: false, error: "Vui lòng dán URL hoặc video ID." };
  try {
    const asset = await youtubeService.linkExistingVideo(actor, input);
    revalidatePath("/admin/media/videos");
    return { ok: true, video: toVideoOption(asset) };
  } catch (err) {
    return { ok: false, error: describeError(err) };
  }
}

export async function importChannelVideoAction(formData: FormData): Promise<LinkVideoResult> {
  const actor = await requireSession();
  if (!externalIntegrationRateLimiter.check(actor.id).allowed) {
    return { ok: false, error: "Bạn đang thao tác quá nhanh — vui lòng thử lại sau ít phút." };
  }
  externalIntegrationRateLimiter.record(actor.id);
  const videoId = String(formData.get("videoId") ?? "").trim();
  if (!videoId) return { ok: false, error: "Thiếu video ID." };
  try {
    const asset = await youtubeService.importChannelVideo(actor, videoId);
    revalidatePath("/admin/media/videos");
    return { ok: true, video: toVideoOption(asset) };
  } catch (err) {
    return { ok: false, error: describeError(err) };
  }
}

export interface BrowseChannelResult {
  ok: boolean;
  error?: string;
  items?: { videoId: string; title: string; thumbnailUrl: string | undefined; publishedAt: string | undefined }[];
  nextPageToken?: string;
}

/** "Chọn video đã có trên kênh" (Admin/Manager only, enforced inside
 *  `youtubeService.listChannelUploadsForPicker`) — a read, so it returns
 *  data directly rather than the `{ok,error}`-only shape the mutations
 *  above use. */
export async function browseChannelVideosAction(pageToken?: string): Promise<BrowseChannelResult> {
  const actor = await requireSession();
  if (!externalIntegrationRateLimiter.check(actor.id).allowed) {
    return { ok: false, error: "Bạn đang thao tác quá nhanh — vui lòng thử lại sau ít phút." };
  }
  externalIntegrationRateLimiter.record(actor.id);
  try {
    const page = await youtubeService.listChannelUploadsForPicker(actor, pageToken);
    return { ok: true, items: page.items, nextPageToken: page.nextPageToken };
  } catch (err) {
    return { ok: false, error: describeError(err) };
  }
}

export async function updateVideoMetadataAction(formData: FormData): Promise<VideoActionResult> {
  const actor = await requireSession();
  if (!externalIntegrationRateLimiter.check(actor.id).allowed) {
    return { ok: false, error: "Bạn đang thao tác quá nhanh — vui lòng thử lại sau ít phút." };
  }
  externalIntegrationRateLimiter.record(actor.id);
  const mediaId = String(formData.get("mediaId") ?? "");
  const title = String(formData.get("title") ?? "").trim() || undefined;
  const description = String(formData.get("description") ?? "").trim() || undefined;
  const rawVisibility = String(formData.get("visibility") ?? "");
  const visibility = (["public", "unlisted", "private"] as string[]).includes(rawVisibility) ? (rawVisibility as YoutubePrivacyStatus) : undefined;
  try {
    await youtubeService.updateVideoMetadata(actor, mediaId, { title, description, visibility });
    revalidatePath("/admin/media/videos");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: describeError(err) };
  }
}

export async function refreshVideoStatusAction(formData: FormData): Promise<VideoActionResult> {
  const actor = await requireSession();
  if (!externalIntegrationRateLimiter.check(actor.id).allowed) {
    return { ok: false, error: "Bạn đang thao tác quá nhanh — vui lòng thử lại sau ít phút." };
  }
  externalIntegrationRateLimiter.record(actor.id);
  const mediaId = String(formData.get("mediaId") ?? "");
  try {
    await youtubeService.refreshStatus(actor, mediaId);
    revalidatePath("/admin/media/videos");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: describeError(err) };
  }
}

/** Unlinking (brief: deleting from this CMS never deletes the actual
 *  YouTube video) — reuses `mediaService.remove()`'s usage/ownership policy
 *  unchanged, since a video's delete rules are identical to an image's. */
export async function unlinkVideoAction(formData: FormData): Promise<VideoActionResult> {
  const actor = await requireSession();
  const mediaId = String(formData.get("mediaId") ?? "");
  const force = formData.get("force") === "true";
  try {
    await mediaService.remove(actor, mediaId, { force });
    revalidatePath("/admin/media/videos");
    return { ok: true };
  } catch (err) {
    if (err instanceof MediaInUseError) {
      return { ok: false, error: err.message, usage: err.usage.map((u) => ({ entityLabel: u.entityLabel, hardBlock: u.hardBlock })) };
    }
    return { ok: false, error: describeError(err) };
  }
}

function describeError(err: unknown): string {
  if (err instanceof YoutubeNotConfiguredError || err instanceof YoutubeNotConnectedError || err instanceof YoutubeOperationError) return err.message;
  return err instanceof Error ? err.message : "Đã xảy ra lỗi không xác định.";
}

/**
 * Pin/unpin one video on the homepage's "Video và phóng sự" section.
 * Addressed by `mediaId` because that is what the video list has a row for;
 * the placement itself is on the `Video` record, which is what the public
 * section actually reads. A media asset that was never published as a video
 * has nothing to pin — the button is not rendered for it, and this is the
 * server-side half of that check.
 */
export async function toggleVideoHomepagePinAction(formData: FormData): Promise<VideoActionResult> {
  try {
    const actor = await requireSession();
    const mediaId = String(formData.get("mediaId"));
    const pinned = String(formData.get("pinned")) === "true";
    const video = await videoRepository.findByMediaId(mediaId);
    if (!video) {
      return { ok: false, error: "Video này chưa được đăng lên trang công khai nên chưa ghim được." };
    }
    await homepageService.setVideoPinned(actor, video.id, pinned);
    revalidatePath("/admin/media/videos");
    // The pin decides which video leads the homepage section and /video.
    revalidatePath("/", "layout");
    revalidatePath("/video");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Không đổi được trạng thái ghim." };
  }
}
