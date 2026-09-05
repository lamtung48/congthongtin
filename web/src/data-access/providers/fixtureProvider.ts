import type { ContentProvider } from "../provider";
import type { Article, ArticleSummary } from "@/domain/article";
import type { Video } from "@/domain/video";
import type { Event } from "@/domain/event";
import type { Organization } from "@/domain/people";
import type { Platform } from "@/domain/platform";
import type { HomepageConfiguration } from "@/domain/homepage";
import type { SearchResultItem } from "@/domain/search";
import type { ActivityMapDataset, ActivityMapProvince, ProvinceActivityProfile } from "@/domain/activity";
import type { Gallery, MediaAsset } from "@/domain/media";
import type { Category, Topic } from "@/domain/taxonomy";
import type { Province, OverseasOrganization } from "@/domain/geo";
import type { AdjacentArticles, FeaturedNewsResult, LocalNewsEntry, LocalityProfile, StoryRailItem, UnitProfile } from "../types";
import { slugify } from "@/lib/slug";
import { matchesSearchQuery } from "@/lib/search";
import { withBasePath } from "@/lib/basePath";
import { categoryHref, eventHref, localityHref, unitHref } from "@/lib/routes";
import { ORGANIZATION_LEVEL_LABEL } from "@/lib/orgLevel";
import ACTIVITY_MAP_JSON from "../../../public/data/activity-map.json";

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
import { HERO, HERO_SLUG, SEARCH_CORPUS } from "../fixtures/homepage";
import {
  SITE_NAV,
  SITE_FOOTER_COLUMNS,
  SITE_FOOTER_SOCIALS,
  SITE_FOOTER_POLICIES,
  SITE_FOOTER_ORG_NAME,
  SITE_FOOTER_ORG_DESCRIPTION,
  SITE_FOOTER_ADDRESS,
  SITE_FOOTER_CONTACT_NOTE,
  SITE_FOOTER_COPYRIGHT_LINE,
  SITE_FOOTER_GOVERNING_BODY_LINE,
} from "@/lib/siteChrome";

/**
 * Same underlying file `getActivityMap()` fetches client-side, imported
 * directly here instead. A server component rendered at build time (every
 * `/dia-phuong/[slug]` page) has no running HTTP server to `fetch()` a
 * relative URL against — a plain JSON import is resolved at build time
 * instead, so `getLocalityBySlug` (a server-only code path — see
 * `docs/LOCALITY_PAGE.md`) can read the exact same per-province numbers
 * the map renders without duplicating them into a second hand-authored
 * fixture that could drift from the map's own data.
 */
const ACTIVITY_MAP_DATA = ACTIVITY_MAP_JSON as unknown as ActivityMapDataset;

/** Fallback category for local-news items resolved as standalone articles
 *  (`/tin-tuc/[slug]`) — `LocalNewsEntry` itself carries no category, since
 *  its own home is `/don-vi/[slug]`/`/dia-phuong/[slug]`, not `/chuyen-muc`. */
const LOCAL_NEWS_ARTICLE_CATEGORY: Category = { id: "tin-co-so", slug: "tin-co-so", name: "Tin từ cơ sở" };

/** A category and a topic that mean roughly the same editorial thing don't
 *  always share a slug (`nghien-cuu` the category vs. `nghien-cuu-khoa-hoc`
 *  the topic). Until every article carries explicit `Article.topics`
 *  tagging, `getArticlesByTopic` also counts an article whose category
 *  aliases to that topic — see `docs/LISTING_PAGES.md`. Topics with no
 *  matching category (e.g. `chuyen-doi-so`) simply get nothing from this
 *  side, which is correct: it's an honest gap, not a bug to paper over. */
const CATEGORY_TOPIC_ALIAS: Record<string, string> = {
  "nghien-cuu": "nghien-cuu-khoa-hoc",
  "hoi-nhap": "hoi-nhap-quoc-te",
};

function byDateDesc(a: { publishedAt: string }, b: { publishedAt: string }): number {
  return a.publishedAt < b.publishedAt ? 1 : -1;
}

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
 * Every searchable entity, projected into the one shared `SearchResultItem`
 * shape — the entire "index" `searchContent()` queries. Rebuilt on every
 * call (fixture data is small and synchronous); a real backend replaces
 * this whole function with one HTTP call and nothing downstream of
 * `ContentProvider.searchContent()` has to change. See
 * `docs/SEARCH_ARCHITECTURE.md`.
 */
function buildSearchIndex(): SearchResultItem[] {
  const articles: SearchResultItem[] = allArticles().map((a) => ({
    id: `article:${a.slug}`,
    type: "article",
    title: a.title,
    category: a.category.name,
    image: a.coverImage,
    excerpt: a.lead,
    publishedAt: a.publishedAt,
    url: a.url,
  }));

  const categories: SearchResultItem[] = CATEGORIES.map((c) => ({
    id: `category:${c.slug}`,
    type: "category",
    title: c.name,
    category: "Chuyên mục",
    excerpt: `Tin tức thuộc chuyên mục ${c.name}`,
    url: categoryHref(c.slug),
  }));

  const topics: SearchResultItem[] = TOPICS.map((t) => ({
    id: `topic:${t.slug}`,
    type: "topic",
    title: t.name,
    category: "Chủ đề",
    excerpt: `${t.articleCount} bài viết`,
    url: t.url,
  }));

  // Same three sources `getUnitSlugs()` unions, so every organization here
  // resolves to a real `/don-vi/[slug]` page.
  const orgIndex = new Map<string, SearchResultItem>();
  for (const n of LOCAL_NEWS) {
    const id = slugify(n.orgName);
    if (!orgIndex.has(id)) {
      orgIndex.set(id, { id: `organization:${id}`, type: "organization", title: n.orgName, category: ORGANIZATION_LEVEL_LABEL[n.level], url: unitHref(id) });
    }
  }
  for (const p of PROVINCES) {
    if (!orgIndex.has(p.slug)) {
      orgIndex.set(p.slug, { id: `organization:${p.slug}`, type: "organization", title: p.name, category: ORGANIZATION_LEVEL_LABEL.province, url: unitHref(p.slug) });
    }
  }
  for (const o of OVERSEAS_ORGANIZATIONS) {
    if (!orgIndex.has(o.id)) {
      orgIndex.set(o.id, { id: `organization:${o.id}`, type: "organization", title: o.name, category: ORGANIZATION_LEVEL_LABEL.overseas, url: unitHref(o.id) });
    }
  }

  const provinces: SearchResultItem[] = PROVINCES.map((p) => ({
    id: `province:${p.slug}`,
    type: "province",
    title: p.name,
    category: "Địa phương",
    url: localityHref(p.slug),
  }));

  const events: SearchResultItem[] = EVENTS.map((e) => ({
    id: `event:${e.slug}`,
    type: "event",
    title: e.title,
    category: "Sự kiện",
    image: e.cover,
    excerpt: e.place,
    publishedAt: e.startAt,
    url: e.url || eventHref(e.slug),
  }));

  return [...articles, ...categories, ...topics, ...orgIndex.values(), ...provinces, ...events];
}

/** Distinct organizations (from `LocalNewsEntry.orgName`) that have
 *  published local news placed here — the closest thing the fixtures have
 *  to a roster of units operating in this locality. Each links to the same
 *  `/don-vi/[slug]` `getUnitBySlug` would resolve for that org name. Works
 *  for any locality, not only the 34 tracked provinces. */
function organizationsForPlace(localNews: LocalNewsEntry[]): Organization[] {
  const seen = new Map<string, Organization>();
  for (const n of localNews) {
    const id = slugify(n.orgName);
    if (!seen.has(id)) seen.set(id, { id, name: n.orgName, level: n.level, url: unitHref(id) });
  }
  return [...seen.values()];
}

/** Most recent `Event` held in this locality, independent of
 *  `latestArticle` (a news story). `Event.place` is a venue string ("Đại
 *  học Đà Nẵng"), not a bare place name, so this matches by substring
 *  rather than equality — unlike `LocalNewsEntry`/`StoryRailItem.place`,
 *  which already are bare names and match by exact `slugify()` equality
 *  elsewhere in this file. */
function latestActivityForPlace(placeName: string): Event | null {
  return (
    EVENTS.filter((e) => e.place.includes(placeName))
      .slice()
      .sort((a, b) => (a.startAt < b.startAt ? 1 : -1))[0] ?? null
  );
}

/**
 * Projects one `ActivityMapProvince` record (the map's own wire shape)
 * into the shared `ProvinceActivityProfile` contract. `null` fields stay
 * `null` — never coerced into a fake `0` or empty string.
 */
function toProvinceActivityProfile(p: ActivityMapProvince): ProvinceActivityProfile {
  const categoryLabel = new Map(ACTIVITY_MAP_DATA.categories.map((c) => [c.slug, c.label]));
  const categoryDistribution = p.category_distribution
    ? Object.entries(p.category_distribution).map(([slug, count]) => ({ slug, label: categoryLabel.get(slug) ?? slug, count }))
    : null;

  return {
    provinceId: p.province_id,
    provinceName: p.province_name,
    slug: p.slug,
    reported: p.reported,
    period: p.period,
    updatedAt: ACTIVITY_MAP_DATA.updated_at,
    articleCount: p.article_count,
    activityCount: p.activity_count,
    studentCount: p.student_count,
    categoryDistribution,
    latestArticle: p.latest_article ? { title: p.latest_article.title, publishedAt: p.latest_article.published_at } : null,
  };
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
      nav: SITE_NAV,
      hero: HERO,
      trendingTopics: TOPICS,
      footer: {
        columns: SITE_FOOTER_COLUMNS,
        socials: SITE_FOOTER_SOCIALS,
        policies: SITE_FOOTER_POLICIES,
        orgName: SITE_FOOTER_ORG_NAME,
        orgDescription: SITE_FOOTER_ORG_DESCRIPTION,
        address: SITE_FOOTER_ADDRESS,
        contactNote: SITE_FOOTER_CONTACT_NOTE,
        copyrightLine: SITE_FOOTER_COPYRIGHT_LINE,
        governingBodyLine: SITE_FOOTER_GOVERNING_BODY_LINE,
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

  async getAllArticles(): Promise<ArticleSummary[]> {
    return allArticles().sort(byDateDesc);
  }

  async getRelatedArticles(slug: string, limit = 4): Promise<ArticleSummary[]> {
    const all = allArticles();
    const current = all.find((a) => a.slug === slug);
    if (!current) return [];
    return all
      .filter((a) => a.slug !== slug && a.category.slug === current.category.slug)
      .sort(byDateDesc)
      .slice(0, limit);
  }

  async getAdjacentArticles(slug: string): Promise<AdjacentArticles> {
    const ordered = allArticles().sort(byDateDesc);
    const i = ordered.findIndex((a) => a.slug === slug);
    if (i === -1) return { previous: null, next: null };
    // Sorted newest-first: an older article (published before this one) sits
    // at a later index; a newer one (published after) sits at an earlier index.
    return {
      previous: i < ordered.length - 1 ? ordered[i + 1] : null,
      next: i > 0 ? ordered[i - 1] : null,
    };
  }

  async searchContent(query: string, limit = 30): Promise<SearchResultItem[]> {
    return matchesSearchQuery(buildSearchIndex(), query, limit);
  }

  async getCategories(): Promise<Category[]> {
    return CATEGORIES;
  }

  async getCategoryBySlug(slug: string): Promise<Category | null> {
    return categoryBySlug(slug) ?? null;
  }

  async getArticlesByCategory(slug: string): Promise<ArticleSummary[]> {
    return allArticles().filter((a) => a.category.slug === slug).sort(byDateDesc);
  }

  async getTopics(): Promise<Topic[]> {
    return TOPICS;
  }

  async getTopicBySlug(slug: string): Promise<Topic | null> {
    return topicBySlug(slug) ?? null;
  }

  async getArticlesByTopic(slug: string): Promise<ArticleSummary[]> {
    return allArticles()
      .filter((a) => a.topics?.some((t) => t.slug === slug) || (CATEGORY_TOPIC_ALIAS[a.category.slug] ?? a.category.slug) === slug)
      .sort(byDateDesc);
  }

  async getLocalityBySlug(slug: string): Promise<LocalityProfile | null> {
    const province = provinceBySlug(slug);
    const localNews = LOCAL_NEWS.filter((n) => slugify(n.place) === slug);
    const stories = STORY_RAIL.filter((s) => slugify(s.place) === slug);
    if (!province && localNews.length === 0 && stories.length === 0) return null;
    const name = province?.name ?? localNews[0]?.place ?? stories[0]?.place ?? slug;

    // Only one of the 34 reporting provinces has a `ProvinceActivityProfile`
    // at all — a place reached only through `LocalNewsEntry`/`StoryRailItem`
    // (e.g. an overseas city) isn't a province, so `activity` stays `null`
    // rather than a record of all-null numbers. See `docs/LOCALITY_PAGE.md`.
    const mapEntry = province ? ACTIVITY_MAP_DATA.provinces.find((p) => p.slug === slug) : undefined;
    const activity = mapEntry ? toProvinceActivityProfile(mapEntry) : null;

    const relatedMedia: MediaAsset[] = province
      ? HOMEPAGE_GALLERY.items.filter((m) => m.metadata?.locationLabel === province.name)
      : [];

    return {
      slug,
      name,
      province,
      localNews,
      stories,
      activity,
      latestActivity: latestActivityForPlace(name),
      organizations: organizationsForPlace(localNews),
      relatedMedia,
    };
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
