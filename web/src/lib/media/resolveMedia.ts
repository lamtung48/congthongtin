import type { MediaAsset } from "@/domain/media";

/**
 * The ONLY place in the app allowed to know how a `MediaAsset.sourceId`
 * turns into a real, fetchable URL. Every `MediaImage`/`MediaVideo` call
 * site works with `MediaAsset` only — never a raw Drive or YouTube URL.
 *
 * `drive` now resolves to this app's own `/api/media/[mediaId]` delivery
 * route (Google Drive media task, brief section 8: never hand the browser a
 * raw Drive share URL) — that route is what actually knows the asset's
 * `providerFileId` and streams its bytes; this resolver only ever needs the
 * `MediaAsset.id`. `youtube` remains stubbed: it was out of scope for that
 * task and still has no resolver wired up. See `docs/MEDIA_ARCHITECTURE.md`
 * for the intended flow. `MediaImage`/`MediaVideo` already handle
 * "no URL resolved" as a normal, first-class state (falls back to
 * `MediaPlaceholder`), not an error.
 */

/** Resolves the URL `MediaImage` should load for one asset, or `undefined`
 *  to render `MediaPlaceholder` instead. */
export function resolveImageUrl(media: MediaAsset): string | undefined {
  if (media.status !== "ready" || !media.sourceId) return undefined;
  if (media.provider === "drive") return `/api/media/${media.id}`;
  // Future: `youtube` → e.g. `https://img.youtube.com/vi/${media.sourceId}/hqdefault.jpg`.
  return undefined;
}

export type VideoPlaybackSource = { url: string };

/** Resolves an embeddable playback URL for `MediaVideo`'s "playing" state,
 *  or `undefined` when nothing can be embedded (missing/removed source, or
 *  — once real integration exists — the owner disabled embedding). */
export function resolveVideoPlaybackSource(media: MediaAsset): VideoPlaybackSource | undefined {
  if (media.status !== "ready" || !media.sourceId) return undefined;
  // Future: `youtube` → `https://www.youtube-nocookie.com/embed/${media.sourceId}`.
  return undefined;
}
