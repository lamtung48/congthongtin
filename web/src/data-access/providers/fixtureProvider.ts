import type { ContentProvider } from "../provider";
import type { ArticleSummary } from "@/domain/article";
import type { Video } from "@/domain/video";
import type { Event } from "@/domain/event";
import type { Platform } from "@/domain/platform";
import type { HomepageConfiguration } from "@/domain/homepage";
import type { ActivityMapDataset } from "@/domain/activity";
import type { Gallery } from "@/domain/media";
import type { FeaturedNewsResult, LocalNewsEntry, StoryRailItem } from "../types";

import { TOPICS } from "../fixtures/taxonomy";
import { LATEST_ARTICLES } from "../fixtures/latestArticles";
import { FEATURED_ARTICLES } from "../fixtures/featuredArticles";
import { STORY_RAIL } from "../fixtures/storyRail";
import { LOCAL_NEWS } from "../fixtures/localNews";
import { VIDEOS } from "../fixtures/videos";
import { EVENTS } from "../fixtures/events";
import { PLATFORMS } from "../fixtures/platforms";
import { HOMEPAGE_GALLERY } from "../fixtures/gallery";
import {
  NAV,
  HERO,
  FOOTER_COLUMNS,
  FOOTER_SOCIALS,
  FOOTER_POLICIES,
  FOOTER_ORG_NAME,
  FOOTER_ORG_DESCRIPTION,
  FOOTER_ADDRESS,
  FOOTER_CONTACT_NOTE,
  FOOTER_COPYRIGHT_LINE,
  FOOTER_GOVERNING_BODY_LINE,
  SEARCH_CORPUS,
} from "../fixtures/homepage";

/**
 * `ContentProvider` implementation backed by the in-repo fixtures under
 * `src/data-access/fixtures/`. This is the ONLY module in the app allowed to
 * import those fixture files directly — everything else (services,
 * components) goes through `ContentProvider` / `getContentProvider()`.
 *
 * Every method returns a `Promise` even though the fixture reads are
 * synchronous, so this class is interchangeable with a future
 * `ApiProvider`/`DatabaseProvider`/`CmsProvider` without changing a single
 * caller. See `docs/DATA_ACCESS.md`.
 */
export class FixtureProvider implements ContentProvider {
  async getHomepage(): Promise<HomepageConfiguration> {
    return {
      nav: NAV,
      hero: HERO,
      trendingTopics: TOPICS,
      footer: {
        columns: FOOTER_COLUMNS,
        socials: FOOTER_SOCIALS,
        policies: FOOTER_POLICIES,
        orgName: FOOTER_ORG_NAME,
        orgDescription: FOOTER_ORG_DESCRIPTION,
        address: FOOTER_ADDRESS,
        contactNote: FOOTER_CONTACT_NOTE,
        copyrightLine: FOOTER_COPYRIGHT_LINE,
        governingBodyLine: FOOTER_GOVERNING_BODY_LINE,
      },
      search: { corpus: SEARCH_CORPUS },
    };
  }

  async getFeaturedArticles(): Promise<FeaturedNewsResult> {
    return FEATURED_ARTICLES;
  }

  async getLatestArticles(): Promise<ArticleSummary[]> {
    return LATEST_ARTICLES;
  }

  async getStoryRail(): Promise<StoryRailItem[]> {
    return STORY_RAIL;
  }

  async getVideos(): Promise<Video[]> {
    return VIDEOS;
  }

  async getEvents(): Promise<Event[]> {
    return EVENTS;
  }

  async getPlatforms(): Promise<Platform[]> {
    return PLATFORMS;
  }

  async getLocalNews(): Promise<LocalNewsEntry[]> {
    return LOCAL_NEWS;
  }

  async getGallery(): Promise<Gallery> {
    return HOMEPAGE_GALLERY;
  }

  /**
   * The only method that doesn't read from an in-repo array: the activity
   * map dataset was already served as static JSON (`public/data/activity-map.json`)
   * rather than a TS fixture, because the map hook fetches it client-side.
   * Kept as a `fetch` here for exactly the same reason — swapping this one
   * line for a real endpoint is the entire migration to `ApiProvider`.
   */
  async getActivityMap(): Promise<ActivityMapDataset> {
    const res = await fetch("/data/activity-map.json");
    if (!res.ok) throw new Error(`activity-map fetch failed: ${res.status}`);
    return (await res.json()) as ActivityMapDataset;
  }
}
