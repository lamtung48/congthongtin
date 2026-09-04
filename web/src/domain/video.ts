import type { ID, ISODateTime, Slug } from "./common";
import type { Category } from "./taxonomy";
import type { MediaAsset } from "./media";

/**
 * `durationLabel` is a display-ready string ("04:57", or "—" when unknown)
 * rather than `durationSeconds` — the fixture data was already authored this
 * way and no UI needs the raw seconds, so this avoids inventing a conversion
 * that has no current caller. Revisit if a real video backend supplies seconds.
 *
 * `media` (type `"video"`) is the single source of truth for both
 * playability and thumbnail: whether the video has a real source
 * (`status`/`sourceId`) and what to show while it isn't playing are both
 * `MediaAsset` concerns, rendered via `<MediaVideo media={video.media} />`.
 */
export interface Video {
  id: ID;
  slug?: Slug;
  title: string;
  description: string;
  category: Category;
  durationLabel: string;
  publishedAt: ISODateTime;
  media: MediaAsset;
}
