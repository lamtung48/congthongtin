import type { MediaAsset } from "@/domain/media";

/**
 * The ONLY place in the app allowed to know how a `MediaAsset.sourceId`
 * turns into a real, fetchable URL. Every `MediaImage`/`MediaVideo` call
 * site works with `MediaAsset` only — never a raw Drive or YouTube URL.
 *
 * `drive` resolves to this app's own `/api/media/[mediaId]` delivery route
 * (Google Drive media task, brief section 8: never hand the browser a raw
 * Drive share URL) — that route is what actually knows the asset's
 * `providerFileId` and streams its bytes; this resolver only ever needs the
 * `MediaAsset.id`. `youtube` resolves to YouTube's own public, directly-
 * loadable thumbnail/embed URLs (a video's `sourceId` — its YouTube video
 * ID — is never secret, unlike a Drive file), gated by
 * `resolveVideoUnavailableReason` below for the handful of ways a video can
 * be `"ready"` in this CMS yet still unplayable for a visitor (YouTube
 * integration task, brief section 7). See `docs/MEDIA_ARCHITECTURE.md` and
 * `docs/YOUTUBE_INTEGRATION.md` for the full flow. `MediaImage`/`MediaVideo`
 * already handle "no URL resolved" as a normal, first-class state (falls
 * back to `MediaPlaceholder`), not an error.
 */

/** Resolves the URL `MediaImage` should load for one asset, or `undefined`
 *  to render `MediaPlaceholder` instead. */
export function resolveImageUrl(media: MediaAsset): string | undefined {
  if (media.status !== "ready" || !media.sourceId) return undefined;
  if (media.provider === "drive") return `/api/media/${media.id}`;
  if (media.provider === "youtube") return `https://img.youtube.com/vi/${media.sourceId}/hqdefault.jpg`;
  return undefined;
}

export type VideoPlaybackSource = { url: string };

/** The reasons `MediaVideo` can't offer real playback for an asset —
 *  `"missing"`/`"removed"`/`"processing"` come from `MediaAsset.status`
 *  itself; the rest are `youtube`-specific (`MediaAsset.errorReason`,
 *  mirroring the real video's YouTube state — see its own doc comment). */
export type VideoUnavailableReason = "missing" | "removed" | "processing" | "private" | "embed_disabled" | "upload_failed" | "quota_exceeded";

const BLOCKING_ERROR_REASONS: ReadonlySet<string> = new Set(["private", "embed_disabled", "upload_failed", "quota_exceeded"]);

/** Why `resolveVideoPlaybackSource` returned `undefined` for this asset, or
 *  `undefined` when it's actually playable — `MediaVideo` uses this to show
 *  a specific message instead of one generic "unavailable" label. */
export function resolveVideoUnavailableReason(media: MediaAsset): VideoUnavailableReason | undefined {
  if (media.status === "removed") return "removed";
  if (media.status === "processing") return "processing";
  if (media.status !== "ready" || !media.sourceId) return "missing";
  if (media.errorReason && BLOCKING_ERROR_REASONS.has(media.errorReason)) return media.errorReason as VideoUnavailableReason;
  return undefined;
}

/** Resolves an embeddable playback URL for `MediaVideo`'s "playing" state,
 *  or `undefined` when nothing can be embedded (missing/removed source, or
 *  one of the `youtube`-specific reasons above). `youtube-nocookie.com` is
 *  YouTube's own privacy-enhanced embed domain — it doesn't set cookies
 *  until the visitor actually presses play inside the iframe, which
 *  `MediaVideo` only renders once `playing` is already true. */
export function resolveVideoPlaybackSource(media: MediaAsset): VideoPlaybackSource | undefined {
  if (resolveVideoUnavailableReason(media)) return undefined;
  if (media.provider === "youtube" && media.sourceId) {
    return { url: `https://www.youtube-nocookie.com/embed/${media.sourceId}?rel=0` };
  }
  return undefined;
}
