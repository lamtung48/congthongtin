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
import type { AdjacentArticles, FeaturedNewsResult, LocalNewsEntry, LocalityProfile, StoryRailItem, UnitProfile } from "../types";
import { slugify } from "@/lib/slug";
import { matchesQuery } from "@/lib/search";
import { withBasePath } from "@/lib/basePath";

import { CATEGORIES, TOPICS, categoryByName, categoryBySlug, topicBySlug } from "../fixtures/taxonomy";
import { LATEST_ARTICLES } from "../fixtures/latestArticles";
import { FEATURED_ARTICLES } from "../fixtures/featuredArticles";
import { STORY_RAIL } from "../fixtures/storyRail";
import { LOCAL_NEWS } from "../fixtures/localNews";
import { ARTICLE_CONTENT } from "../fixtures/articleContent";
import { VIDEOS } from "../fixtures/videos";
import { EVENTS } from "../fixtures/events";
import { PLATFORMS } from "../fixtures/platforms";
import { HOMEPAGE_GALLERY } from "../fixtures/gallery";
import { PROVINCES, provinceBySlug } from "../fixtures/provinces";
import { OVERSEAS_ORGANIZATIONS, overseasOrganizationBySlug } from "../fixtures/overseasOrganizations";
import {
  NAV,
  HERO,
  HERO_SLUG,
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

/** The homepage Hero is itself a linkable article — see `HERO_SLUG` in
 *  `fixtures/homepage.ts`. Sourced from `HERO` directly so the two never
 *  drift apart, the way a second hand-authored copy would risk. */
function heroToArticle(): Article {
  return {
    id: HERO_SLUG,
    slug: HERO_SLUG,
    url: HERO.articleUrl,
    title: [HERO.headline, HERO.headlineAccent].filter(Boolean).join(" "),
    lead: HERO.lead,
    category: categoryByName(HERO.eyebrow),
    publishedAt: HERO.publishedAt,
    coverImage: HERO.media,
    author: HERO.author,
    readingTimeMinutes: HERO.readingTimeMinutes,
    status: "published",
  };
}

/**
 * Every article the fixtures know about, deduped by slug — the single pool
 * `getArticleBySlug`, `getArticleSlugs`, `getRelatedArticles` and
 * `getAdjacentArticles` all read from, so they can never disagree about
 * which slugs exist (a real risk when each built its own list — see
 * `docs/ARTICLE_DETAIL.md`). Content authored in `ARTICLE_CONTENT` (body,
 * tags, topics, ...) is merged in per slug.
 */
function allArticles(): Article[] {
  const pool: Article[] = [
    heroToArticle(),
    ...LATEST_ARTICLES.map((a): Article => ({ ...a, status: "published" })),
    { ...FEATURED_ARTICLES.main, status: "published" },
    ...FEATURED_ARTICLES.secondary.map((a): Article => ({ ...a, status: "published" })),
    ...STORY_RAIL.map(storyToArticle),
    ...LOCAL_NEWS.map(localNewsToArticle),
  ];
  const seen = new Set<string>();
  return pool
    .filter((a) => (seen.has(a.slug) ? false : (seen.add(a.slug), true)))
    .map((a) => (ARTICLE_CONTENT[a.slug] ? { ...a, ...ARTICLE_CONTENT[a.slug] } : a));
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
    return allArticles().find((a) => a.slug === slug) ?? null;
  }

  async getArticleSlugs(): Promise<string[]> {
    return allArticles().map((a) => a.slug);
  }

  async getRelatedArticles(slug: string, limit = 4): Promise<ArticleSummary[]> {
    const all = allArticles();
    const current = all.find((a) => a.slug === slug);
    if (!current) return [];
    return all
      .filter((a) => a.slug !== slug && a.category.slug === current.category.slug)
      .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
      .slice(0, limit);
  }

  async getAdjacentArticles(slug: string): Promise<AdjacentArticles> {
    const ordered = allArticles().sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
    const i = ordered.findIndex((a) => a.slug === slug);
    if (i === -1) return { previous: null, next: null };
    // Sorted newest-first: an older article (published before this one) sits
    // at a later index; a newer one (published after) sits at an earlier index.
    return {
      previous: i < ordered.length - 1 ? ordered[i + 1] : null,
      next: i > 0 ? ordered[i - 1] : null,
    };
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
