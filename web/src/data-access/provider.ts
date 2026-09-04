import type { ArticleSummary } from "@/domain/article";
import type { Video } from "@/domain/video";
import type { Event } from "@/domain/event";
import type { Platform } from "@/domain/platform";
import type { HomepageConfiguration } from "@/domain/homepage";
import type { ActivityMapDataset } from "@/domain/activity";
import type { Gallery } from "@/domain/media";
import type { FeaturedNewsResult, LocalNewsEntry, StoryRailItem } from "./types";

/**
 * The port every homepage data source implements — a fixture today,
 * `ApiProvider` / `DatabaseProvider` / `CmsProvider` later (see
 * `docs/DATA_ACCESS.md`). Every method is async so a synchronous fixture
 * lookup and a real network/DB round trip satisfy the same contract without
 * any caller-side change.
 *
 * The method list matches the homepage's actual data needs one-to-one — this
 * is intentionally not a generic CRUD/repository interface. Add a method
 * here only when a new homepage section needs a new shape of data.
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
}
