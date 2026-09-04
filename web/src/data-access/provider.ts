import type { Article, ArticleSummary } from "@/domain/article";
import type { Video } from "@/domain/video";
import type { Event } from "@/domain/event";
import type { Platform } from "@/domain/platform";
import type { HomepageConfiguration } from "@/domain/homepage";
import type { SearchResultItem } from "@/domain/search";
import type { ActivityMapDataset } from "@/domain/activity";
import type { Gallery } from "@/domain/media";
import type { Category, Topic } from "@/domain/taxonomy";
import type { Province, OverseasOrganization } from "@/domain/geo";
import type { AdjacentArticles, FeaturedNewsResult, LocalNewsEntry, LocalityProfile, StoryRailItem, UnitProfile } from "./types";

/**
 * The port every content data source implements — a fixture today,
 * `ApiProvider` / `DatabaseProvider` / `CmsProvider` later (see
 * `docs/DATA_ACCESS.md`). Every method is async so a synchronous fixture
 * lookup and a real network/DB round trip satisfy the same contract without
 * any caller-side change.
 *
 * The method list matches the app's actual data needs one-to-one — this is
 * intentionally not a generic CRUD/repository interface. Add a method here
 * only when a new page/section needs a new shape of data.
 */
export interface ContentProvider {
  getHomepage(): Promise<HomepageConfiguration>;
  getFeaturedArticles(): Promise<FeaturedNewsResult>;
  getLatestArticles(): Promise<ArticleSummary[]>;
  getStoryRail(): Promise<StoryRailItem[]>;
  getVideos(): Promise<Video[]>;
  getEvents(): Promise<Event[]>;
  getPlatforms(): Promise<Platform[]>;
  getActivityMap(): Promise<ActivityMapDataset>;
  getLocalNews(): Promise<LocalNewsEntry[]>;
  /** Beyond the minimum list — `Gallery` is one of the required domain
   *  entities and needs a data-access method to actually decouple the
   *  Gallery section from fixture data. */
  getGallery(): Promise<Gallery>;

  /* ---------- Route architecture — one method per dynamic route's lookup ---------- */

  /** `/tin-tuc/[slug]`. Searches the one deduplicated pool every article
   *  method reads from (see `docs/ARTICLE_DETAIL.md`). */
  getArticleBySlug(slug: string): Promise<Article | null>;
  /** Every slug `getArticleBySlug` can resolve — `generateStaticParams()`
   *  for `/tin-tuc/[slug]` needs the full list to pre-render at build time
   *  (static export has no per-request rendering; see `docs/DEPLOYMENT.md`). */
  getArticleSlugs(): Promise<string[]>;
  /** `/tin-tuc`'s main index — every article, most recent first. Distinct
   *  from `getLatestArticles()` (the homepage's own curated subset) — see
   *  `docs/LISTING_PAGES.md`. */
  getAllArticles(): Promise<ArticleSummary[]>;
  /** `/tin-tuc/[slug]`'s "related articles" rail — same category, most
   *  recent first, current article excluded. */
  getRelatedArticles(slug: string, limit?: number): Promise<ArticleSummary[]>;
  /** `/tin-tuc/[slug]`'s prev/next nav, ordered by `publishedAt`. */
  getAdjacentArticles(slug: string): Promise<AdjacentArticles>;
  /** `/tim-kiem` and the search overlay share this — same index, same
   *  matching/ranking rule, capped at `limit` (default 30). Covers every
   *  `SearchResultType` — see `docs/SEARCH_ARCHITECTURE.md`. */
  searchContent(query: string, limit?: number): Promise<SearchResultItem[]>;

  getCategories(): Promise<Category[]>;
  /** `/chuyen-muc/[slug]`. */
  getCategoryBySlug(slug: string): Promise<Category | null>;
  /** Every article in the category, most recent first. */
  getArticlesByCategory(slug: string): Promise<ArticleSummary[]>;

  getTopics(): Promise<Topic[]>;
  /** `/chu-de/[slug]`. */
  getTopicBySlug(slug: string): Promise<Topic | null>;
  /** `/chu-de/[slug]`'s article stream — an article belongs to a topic
   *  either by explicit `Article.topics` tagging or, until every article is
   *  tagged, by its category aliasing to that topic. See
   *  `docs/LISTING_PAGES.md` for why both count. */
  getArticlesByTopic(slug: string): Promise<ArticleSummary[]>;

  /** `/dia-phuong/[slug]` — geographic place, not reporting unit. */
  getLocalityBySlug(slug: string): Promise<LocalityProfile | null>;
  /** Every slug `getLocalityBySlug` can resolve — for `generateStaticParams()`. */
  getLocalitySlugs(): Promise<string[]>;
  /** `/don-vi/[slug]` — a specific reporting Hội unit. */
  getUnitBySlug(slug: string): Promise<UnitProfile | null>;
  /** Every slug `getUnitBySlug` can resolve — for `generateStaticParams()`. */
  getUnitSlugs(): Promise<string[]>;

  getProvinces(): Promise<Province[]>;
  getOverseasOrganizations(): Promise<OverseasOrganization[]>;

  /** `/su-kien/[slug]`. */
  getEventBySlug(slug: string): Promise<Event | null>;
}
