import type { ID } from "./common";

/**
 * Where the underlying file lives (or will live). `drive` and `youtube` are
 * real future sources — the frontend never talks to either API directly (see
 * `docs/MEDIA_ARCHITECTURE.md`); `local-placeholder` marks an asset that is
 * intentionally generic/decorative and was never meant to have a per-item
 * file (e.g. a card's generic "Ảnh bài viết" slot), as opposed to a `drive`
 * asset with `status: "missing"`, which has real per-item metadata already
 * and is genuinely waiting on a file upload.
 */
export type MediaProvider = "drive" | "youtube" | "local-placeholder";

export type MediaType = "image" | "video";

/**
 * Lifecycle of the asset as known by the content layer — not to be confused
 * with a component's runtime load state (loading/loaded/error), which is a
 * property of one render attempt, not of the data.
 */
export type MediaStatus = "ready" | "missing" | "removed" | "processing";

/**
 * The one media contract every image/video in the app is described by.
 * Nothing outside `src/lib/media/resolveMedia.ts` ever turns `sourceId` into
 * an actual URL — components render `MediaAsset` as-is and never see a raw
 * Drive or YouTube URL.
 */
export interface MediaAsset {
  id: string;
  provider: MediaProvider;
  type: MediaType;
  /** Drive file id or YouTube video id. Absent when `provider` is
   *  `local-placeholder`, or when a real asset hasn't been uploaded yet. */
  sourceId?: string;
  alt?: string;
  caption?: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
  mimeType?: string;
  /** Shown by `MediaImage`/`MediaVideo` whenever no real source resolves. */
  placeholder?: string;
  status: MediaStatus;
  /** A short machine-readable code for *why* a `"ready"` (or `"removed"`)
   *  `youtube` asset still can't actually be embedded for a visitor —
   *  `"private"`, `"embed_disabled"`, `"removed"`, `"upload_failed"`, or
   *  `"quota_exceeded"`. Absent for every other provider. See
   *  `resolveVideoPlaybackSource`/`resolveVideoUnavailableReason` in
   *  `resolveMedia.ts`, the only place this is read. */
  errorReason?: string;
  /** Provider-specific extras (e.g. capture location/date) that don't
   *  warrant their own top-level field. */
  metadata?: Record<string, string | number>;
}

/** A curated, ordered collection of media assets — the homepage photo wall. */
export interface Gallery {
  id: ID;
  title: string;
  description?: string;
  items: MediaAsset[];
}
