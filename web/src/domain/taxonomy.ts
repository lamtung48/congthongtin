import type { ID, Slug } from "./common";

/** Primary classification of an article — one per article (e.g. "Tình nguyện"). */
export interface Category {
  id: ID;
  slug: Slug;
  name: string;
}

/** Curated editorial theme with its own landing page (e.g. "Đại hội XII"). */
export interface Topic {
  id: ID;
  slug: Slug;
  name: string;
  articleCount: number;
  url: string;
}

/** Freeform keyword, many per article, with no dedicated landing page. */
export interface Tag {
  id: ID;
  slug: Slug;
  name: string;
}
