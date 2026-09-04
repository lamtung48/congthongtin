import type { ContentProvider } from "../provider";
import type { Article, ArticleSummary } from "@/domain/article";
import type { Video } from "@/domain/video";
import type { Event } from "@/domain/event";
import type { Platform } from "@/domain/platform";
import type { HomepageConfiguration, SearchSuggestion } from "@/domain/homepage";
import type { ActivityMapDataset } from "@/domain/activity";
import type { Gallery } from "@/domain/media";
import type { Category, Topic } from "@/domain/taxonomy";
import type { Province, OverseasOrganization } from "@/domain/geo";
import type { FeaturedNewsResult, LocalNewsEntry, LocalityProfile, StoryRailItem, UnitProfile } from "../types";
import { slugify } from "@/lib/slug";
import { matchesQuery } from "@/lib/search";
import { withBasePath } from "@/lib/basePath";

import { CATEGORIES, TOPICS, categoryBySlug, topicBySlug } from "../fixtures/taxonomy";
import { LATEST_ARTICLES } from "../fixtures/latestArticles";
import { FEATURED_ARTICLES } from "../fixtures/featuredArticles";
import { STORY_RAIL } from "../fixtures/storyRail";
import { LOCAL_NEWS } from "../fixtures/localNews";
import { VIDEOS } from "../fixtures/videos";
import { EVENTS } from "../fixtures/events";
import { PLATFORMS } from "../fixtures/platforms";
import { HOMEPAGE_GALLERY } from "../fixtures/gallery";
import { PROVINCES, provinceBySlug } from "../fixtures/provinces";
import { OVERSEAS_ORGANIZATIONS, overseasOrganizationBySlug } from "../fixtures/overseasOrganizations";
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

/** Fallback category for local-news items resolved as standalone articles
 *  (`/tin-tuc/[slug]`) — `LocalNewsEntry` itself carries no category, since
 *  its own home is `/don-vi/[slug]`/`/dia-phuong/[slug]`, not `/chuyen-muc`. */
const LOCAL_NEWS_ARTICLE_CATEGORY: Category = { id: "tin-co-so", slug: "tin-co-so", name: "Tin từ cơ sở" };

function storyToArticle(s: StoryRailItem): Article {
  return { id: s.slug, slug: s.slug, url: s.url, title: s.headline, category: s.category, publishedAt: s.publishedAt, place: s.place, status: "published" };
}

function localNewsToArticle(n: LocalNewsEntry): Article {
  return { id: n.slug, slug: n.slug, url: n.url, title: n.title, category: LOCAL_NEWS_ARTICLE_CATEGORY, publishedAt: n.publishedAt, coverImage: n.media, place: n.place, status: "published" };
}

/**
 * `ContentProvider` implementation backed by the in-repo fixtures under
 * `src/data-access/fixtures/`. This is the ONLY module in the app allowed to
 * import those fixture files directly — everything else (services,
 * components, route pages) goes through `ContentProvider` /
 * `getContentProvider()`.
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
    const res = await fetch(withBasePath("/data/activity-map.json"));
    if (!res.ok) throw new Error(`activity-map fetch failed: ${res.status}`);
    return (await res.json()) as ActivityMapDataset;
  }

  /* ---------- Route architecture lookups ---------- */

  async getArticleBySlug(slug: string): Promise<Article | null> {
    const fromLatest = LATEST_ARTICLES.find((a) => a.slug === slug);
    if (fromLatest) return { ...fromLatest, status: "published" };
    const fromFeatured = FEATURED_ARTICLES.main.slug === slug ? FEATURED_ARTICLES.main : FEATURED_ARTICLES.secondary.find((a) => a.slug === slug);
    if (fromFeatured) return { ...fromFeatured, status: "published" };
    const fromStory = STORY_RAIL.find((s) => s.slug === slug);
    if (fromStory) return storyToArticle(fromStory);
    const fromLocal = LOCAL_NEWS.find((n) => n.slug === slug);
    if (fromLocal) return localNewsToArticle(fromLocal);
    return null;
  }

  async getArticleSlugs(): Promise<string[]> {
    const slugs = [
      ...LATEST_ARTICLES.map((a) => a.slug),
      FEATURED_ARTICLES.main.slug,
      ...FEATURED_ARTICLES.secondary.map((a) => a.slug),
      ...STORY_RAIL.map((s) => s.slug),
      ...LOCAL_NEWS.map((n) => n.slug),
    ];
    return [...new Set(slugs)];
  }

  async searchContent(query: string): Promise<SearchSuggestion[]> {
    return matchesQuery(SEARCH_CORPUS, query);
  }

  async getCategories(): Promise<Category[]> {
    return CATEGORIES;
  }

  async getCategoryBySlug(slug: string): Promise<Category | null> {
    return categoryBySlug(slug) ?? null;
  }

  async getArticlesByCategory(slug: string): Promise<ArticleSummary[]> {
    return LATEST_ARTICLES.filter((a) => a.category.slug === slug);
  }

  async getTopics(): Promise<Topic[]> {
    return TOPICS;
  }

  async getTopicBySlug(slug: string): Promise<Topic | null> {
    return topicBySlug(slug) ?? null;
  }

  async getLocalityBySlug(slug: string): Promise<LocalityProfile | null> {
    const province = provinceBySlug(slug);
    const localNews = LOCAL_NEWS.filter((n) => slugify(n.place) === slug);
    const stories = STORY_RAIL.filter((s) => slugify(s.place) === slug);
    if (!province && localNews.length === 0 && stories.length === 0) return null;
    const name = province?.name ?? localNews[0]?.place ?? stories[0]?.place ?? slug;
    return { slug, name, province, localNews, stories };
  }

  async getLocalitySlugs(): Promise<string[]> {
    const slugs = [
      ...PROVINCES.map((p) => p.slug),
      ...LOCAL_NEWS.map((n) => slugify(n.place)),
      ...STORY_RAIL.map((s) => slugify(s.place)),
    ];
    return [...new Set(slugs)];
  }

  async getUnitBySlug(slug: string): Promise<UnitProfile | null> {
    const byOrg = LOCAL_NEWS.filter((n) => slugify(n.orgName) === slug);
    if (byOrg.length > 0) {
      return { slug, name: byOrg[0].orgName, level: byOrg[0].level, localNews: byOrg, activityStats: null };
    }
    const province = provinceBySlug(slug);
    if (province) {
      return { slug, name: province.name, level: "province", localNews: [], activityStats: null };
    }
    const overseas = overseasOrganizationBySlug(slug);
    if (overseas) {
      return { slug, name: overseas.name, level: "overseas", localNews: [], activityStats: null };
    }
    return null;
  }

  async getUnitSlugs(): Promise<string[]> {
    const slugs = [
      ...LOCAL_NEWS.map((n) => slugify(n.orgName)),
      ...PROVINCES.map((p) => p.slug),
      ...OVERSEAS_ORGANIZATIONS.map((o) => o.id),
    ];
    return [...new Set(slugs)];
  }

  async getProvinces(): Promise<Province[]> {
    return PROVINCES;
  }

  async getOverseasOrganizations(): Promise<OverseasOrganization[]> {
    return OVERSEAS_ORGANIZATIONS;
  }

  async getEventBySlug(slug: string): Promise<Event | null> {
    return EVENTS.find((e) => e.slug === slug) ?? null;
  }
}
