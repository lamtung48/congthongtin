import type { ID, ISODateTime, Slug } from "./common";
import type { Category, Tag, Topic } from "./taxonomy";
import type { Author, Organization } from "./people";
import type { MediaAsset } from "./media";
import type { Province } from "./geo";
import type { ArticleBlock } from "./articleContent";

export type ArticleStatus = "draft" | "published" | "archived";

/**
 * Lightweight projection of an Article used by every listing/rail on the
 * homepage (featured, latest, story rail, local news). `place` and
 * `organization` are optional because most listings don't need them — they
 * exist for the sections that key off locality (story rail, local news).
 */
export interface ArticleSummary {
  id: ID;
  slug: Slug;
  url: string;
  title: string;
  lead?: string;
  category: Category;
  publishedAt: ISODateTime;
  coverImage?: MediaAsset;
  isTextOnly?: boolean;
  place?: string;
  organization?: Organization;
}

/** Full article — the shape a detail page (`/tin/[slug]`, not yet built) would render. */
export interface Article extends ArticleSummary {
  status: ArticleStatus;
  /** Absent (not `[]`) means "no body authored yet" — the detail page
   *  renders an editing-in-progress empty state, distinct from an
   *  intentionally short article (which would have a short but present
   *  `body` array). See `docs/ARTICLE_DETAIL.md`. */
  body?: ArticleBlock[];
  topics?: Topic[];
  tags?: Tag[];
  author?: Author;
  province?: Province;
  updatedAt?: ISODateTime;
  readingTimeMinutes?: number;
}
