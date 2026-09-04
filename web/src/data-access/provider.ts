import type { Article, ArticleSummary } from "@/domain/article";
import type { Video } from "@/domain/video";
import type { Event } from "@/domain/event";
import type { Platform } from "@/domain/platform";
import type { HomepageConfiguration, SearchSuggestion } from "@/domain/homepage";
import type { ActivityMapDataset } from "@/domain/activity";
import type { Gallery } from "@/domain/media";
import type { Category, Topic } from "@/domain/taxonomy";
import type { Province, OverseasOrganization } from "@/domain/geo";
import type { FeaturedNewsResult, LocalNewsEntry, LocalityProfile, StoryRailItem, UnitProfile } from "./types";

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

  /** `/tin-tuc/[slug]`. Searches every known article pool (latest, featured,
   *  story rail, local news) since there is no single "all articles" index
   *  yet — see `docs/ROUTES.md`. */
  getArticleBySlug(slug: string): Promise<Article | null>;
  /** `/tim-kiem` and the search overlay share this — same corpus, same rule. */
  searchContent(query: string): Promise<SearchSuggestion[]>;

  getCategories(): Promise<Category[]>;
  /** `/chuyen-muc/[slug]`. */
  getCategoryBySlug(slug: string): Promise<Category | null>;
  getArticlesByCategory(slug: string): Promise<ArticleSummary[]>;

  getTopics(): Promise<Topic[]>;
  /** `/chu-de/[slug]`. */
  getTopicBySlug(slug: string): Promise<Topic | null>;

  /** `/dia-phuong/[slug]` — geographic place, not reporting unit. */
  getLocalityBySlug(slug: string): Promise<LocalityProfile | null>;
  /** `/don-vi/[slug]` — a specific reporting Hội unit. */
  getUnitBySlug(slug: string): Promise<UnitProfile | null>;

  getProvinces(): Promise<Province[]>;
  getOverseasOrganizations(): Promise<OverseasOrganization[]>;

  /** `/su-kien/[slug]`. */
  getEventBySlug(slug: string): Promise<Event | null>;
}
