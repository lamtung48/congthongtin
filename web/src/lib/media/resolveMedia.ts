import type { MediaAsset } from "@/domain/media";

/**
 * The ONLY place in the app allowed to know how a `MediaAsset.sourceId`
 * turns into a real, fetchable URL. Every `MediaImage`/`MediaVideo` call
 * site works with `MediaAsset` only — never a raw Drive or YouTube URL.
 *
 * Both resolvers are intentionally stubbed to always return "not resolved"
 * for this task: no Google Drive API or YouTube API integration was in
 * scope, and no media proxy/CDN service exists yet to front Drive files. See
 * `docs/MEDIA_ARCHITECTURE.md` for the intended flow. Wiring a resolver up
 * later — the Media Service’s cached/CDN URL for `drive`, `img.youtube.com`
 * or a signed embed URL for `youtube` — requires no change anywhere except
 * inside these two functions: `MediaImage`/`MediaVideo` already handle
 * "no URL resolved" as a normal, first-class state (falls back to
 * `MediaPlaceholder`), not an error.
 */

/** Resolves the URL `MediaImage` should load for one asset, or `undefined`
 *  to render `MediaPlaceholder` instead. */
export function resolveImageUrl(media: MediaAsset): string | undefined {
  if (media.status !== "ready" || !media.sourceId) return undefined;
  // Future: `drive` → Media Service cache/CDN URL derived from sourceId;
  // `youtube` → e.g. `https://img.youtube.com/vi/${media.sourceId}/hqdefault.jpg`.
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
