import type { ID } from "./common";

export type MediaAssetKind = "image" | "video" | "illustration";

/**
 * A single visual asset. `url` is absent whenever the real file hasn't been
 * supplied yet — the UI then renders `placeholderNote` instead (see
 * `MediaPlaceholder`). Both fields are optional independently so a caller can
 * model "asset exists, no alt text yet" as well as "no asset yet".
 */
export interface MediaAsset {
  id?: ID;
  kind: MediaAssetKind;
  url?: string;
  alt?: string;
  width?: number;
  height?: number;
  caption?: string;
  locationLabel?: string;
  capturedAt?: string;
  placeholderNote?: string;
}

/** A curated, ordered collection of media assets (e.g. the homepage photo wall). */
export interface Gallery {
  id: ID;
  title: string;
  description?: string;
  items: MediaAsset[];
}
