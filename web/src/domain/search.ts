import type { MediaAsset } from "./media";

/**
 * Every entity type search can return. Adding a new searchable entity means
 * adding a variant here plus one more source in the index the data-access
 * layer builds it from (`buildSearchIndex()` in `fixtureProvider.ts`) —
 * nothing about the UI changes. See `docs/SEARCH_ARCHITECTURE.md`.
 */
export type SearchResultType = "article" | "category" | "topic" | "organization" | "province" | "event";

/**
 * The one result shape every search surface renders — the header's
 * `SearchOverlay` and `/tim-kiem` both consume exactly this, regardless of
 * which `SearchResultType` a given item is. A real search backend
 * (Meilisearch, Postgres full-text, a hosted API) would return something
 * shaped close to this directly; `ApiProvider.searchContent()` would only
 * need to map its response into this contract, never touch a component.
 */
export interface SearchResultItem {
  id: string;
  type: SearchResultType;
  title: string;
  /** Display label for the result's category/type context — an article's
   *  `Category.name`, an org's level label, "Địa phương", "Sự kiện", etc.
   *  Always a plain string: the search index is a read model, not a place
   *  that resolves a full `Category`/`Topic` object. */
  category: string;
  image?: MediaAsset;
  excerpt?: string;
  /** Only present for dated content (`article`, `event`). */
  publishedAt?: string;
  url: string;
}
