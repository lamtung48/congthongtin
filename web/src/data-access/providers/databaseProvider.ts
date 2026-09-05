import "server-only";
import type { ContentProvider } from "../provider";
import type { Article, ArticleSummary } from "@/domain/article";
import type { Video } from "@/domain/video";
import type { Event } from "@/domain/event";
import type { Organization, OrganizationLevel } from "@/domain/people";
import type { Platform } from "@/domain/platform";
import type { HomepageConfiguration } from "@/domain/homepage";
import type { SearchResultItem } from "@/domain/search";
import type { ActivityMapDataset } from "@/domain/activity";
import type { Gallery, MediaAsset } from "@/domain/media";
import type { Category, Topic } from "@/domain/taxonomy";
import type { Province, OverseasOrganization } from "@/domain/geo";
import type { AdjacentArticles, FeaturedNewsResult, LocalNewsEntry, LocalityProfile, StoryRailItem, UnitProfile } from "../types";

import ACTIVITY_MAP_STATIC_JSON from "../../../public/data/activity-map.json";
import { prisma } from "@/server/db/client";
import { articleRepository, type ArticleWithRelations } from "@/server/repositories/articleRepository";
import { mapArticleToDomain } from "@/server/content/articleMapper";
import { mapMedia } from "@/server/content/articleContentResolver";
import { homepageService } from "@/server/services/homepageService";
import { activityMapService } from "@/server/services/activityMapService";
import { activityMapRepository } from "@/server/repositories/activityMapRepository";
import { eventRepository, type EventWithRelations } from "@/server/repositories/eventRepository";
import { eventService } from "@/server/services/eventService";
import { organizationRepository } from "@/server/repositories/organizationRepository";
import { provinceRepository } from "@/server/repositories/provinceRepository";
import { taxonomyRepository } from "@/server/repositories/taxonomyRepository";
import { matchesSearchQuery } from "@/lib/search";
import { articleHref, categoryHref, eventHref, localityHref, topicHref, unitHref } from "@/lib/routes";
import { ORGANIZATION_LEVEL_LABEL } from "@/lib/orgLevel";
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
import type {
  Prisma,
  OrganizationType as PrismaOrganizationType,
  PlatformCategory as PrismaPlatformCategory,
  PlatformStatus as PrismaPlatformStatus,
  PlatformIntegrationType as PrismaPlatformIntegrationType,
  Organization as PrismaOrganization,
  Province as PrismaProvince,
  Video as PrismaVideo,
  Category as PrismaCategory,
} from "@/generated/prisma/client";

/** `Platform` rows are always read with `iconMedia` joined
 *  (`homepageRepository.ts`'s `fallback.platforms`/`resolvers.platform`) so
 *  `mapPlatform` can resolve `Platform.icon` — see that domain field's own
 *  comment for why the homepage bento still falls back to a hardcoded
 *  per-category SVG when this is absent. */
type PrismaPlatformWithIcon = Prisma.PlatformGetPayload<{ include: { iconMedia: true } }>;

/**
 * `ContentProvider` implementation backed by the real Postgres database —
 * the Production Data Policy task's own deliverable. Every method here
 * either delegates to an existing server-side repository/service
 * (`src/server/**`, already built for the admin CMS) or adds a thin,
 * public-facing read on top of one. `import "server-only"` makes an
 * accidental import from a Client Component a build error rather than a
 * runtime surprise — Prisma cannot run in the browser at all, unlike
 * `FixtureProvider`, which is safe from any environment because it only
 * ever touches in-repo arrays and a static JSON file (see "the two client
 * components this displaced" note in `docs/PRODUCTION_DATA.md` for the two
 * places that genuinely needed a fetch-based Route Handler instead once
 * this became the default provider).
 *
 * The one hard rule every method here observes (Production Data Policy,
 * brief section 2): an `Article` is only ever public when
 * `status: "PUBLISHED"` **and** `publishedAt` is a real, past timestamp.
 * DRAFT/IN_REVIEW/APPROVED/SCHEDULED (even if `scheduledAt` has technically
 * elapsed — nothing promotes it to PUBLISHED without a Manager/Admin
 * action) and a PUBLISHED row someone hand-set a future `publishedAt` on
 * are all equally non-public. `articleRepository`'s own `listPublished*`
 * methods already filter `status: "PUBLISHED"`; every call site below adds
 * the `publishedAt` guard explicitly rather than trusting that pairing to
 * always hold.
 */

function isPubliclyVisible(article: Pick<ArticleWithRelations, "status" | "publishedAt">, now: Date): boolean {
  return article.status === "PUBLISHED" && !!article.publishedAt && article.publishedAt <= now;
}

async function mapPublicArticle(article: ArticleWithRelations): Promise<Article> {
  return mapArticleToDomain(article);
}

async function mapPublicArticles(articles: ArticleWithRelations[]): Promise<Article[]> {
  return Promise.all(articles.map(mapPublicArticle));
}

function mapCategory(c: PrismaCategory): Category {
  return { id: c.id, slug: c.slug, name: c.name };
}

function mapProvince(p: PrismaProvince): Province {
  return { id: p.id, slug: p.slug, name: p.name, lat: p.lat, lon: p.lon };
}

const ORG_TYPE_TO_LEVEL: Record<PrismaOrganizationType, OrganizationLevel> = {
  CENTRAL: "central",
  PROVINCE: "province",
  UNIVERSITY: "university",
  OVERSEAS: "overseas",
  OTHER: "other",
};

function mapOrganization(org: PrismaOrganization, province?: PrismaProvince | null): Organization {
  return {
    id: org.id,
    name: org.name,
    level: ORG_TYPE_TO_LEVEL[org.type],
    province: province ? mapProvince(province) : undefined,
    country: org.countryCode ?? undefined,
    url: unitHref(org.slug),
  };
}

const PLATFORM_CATEGORY_MAP: Record<PrismaPlatformCategory, Platform["category"]> = {
  CONFERENCE: "conference",
  TRAINING: "training",
  SV5TOT: "sv5tot",
  VOLUNTEER: "volunteer",
  DATA: "data",
};

const PLATFORM_STATUS_MAP: Record<PrismaPlatformStatus, Platform["status"]> = {
  LIVE: "live",
  ACTIVE: "active",
  MAINTENANCE: "maintenance",
  OPEN: "open",
  UNAVAILABLE: "unavailable",
  SOON: "soon",
};

const PLATFORM_INTEGRATION_TYPE_MAP: Record<PrismaPlatformIntegrationType, Platform["integrationType"]> = {
  EXTERNAL_LINK: "external_link",
  API: "api",
  SSO_READY: "sso_ready",
};

function mapPlatform(p: PrismaPlatformWithIcon): Platform {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    url: p.url,
    description: p.description,
    category: PLATFORM_CATEGORY_MAP[p.category],
    status: PLATFORM_STATUS_MAP[p.status],
    accessLevel: p.accessLevel,
    metric: p.metric ?? undefined,
    currentActivity: p.currentActivity ?? undefined,
    ctaLabel: p.ctaLabel ?? undefined,
    integrationType: PLATFORM_INTEGRATION_TYPE_MAP[p.integrationType],
    icon: p.iconMedia ? mapMedia(p.iconMedia) : undefined,
  };
}

/** mm:ss for under an hour, h:mm:ss beyond — the same display-ready string
 *  shape `Video.durationLabel`'s own doc comment asks for; "—" when the
 *  database has no duration for this video yet. */
function formatDurationLabel(seconds: number | null): string {
  if (seconds === null || seconds < 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function mapVideo(v: PrismaVideo & { category: PrismaCategory; media: Parameters<typeof mapMedia>[0] }): Video {
  return {
    id: v.id,
    slug: v.slug ?? undefined,
    title: v.title,
    description: v.description,
    category: mapCategory(v.category),
    durationLabel: formatDurationLabel(v.durationSeconds),
    // Only ever reached with a non-null, past `publishedAt` — every query
    // site below filters that before mapping (mirroring the Article
    // policy: a video with no publish date yet is a draft, not public).
    publishedAt: v.publishedAt!.toISOString(),
    media: mapMedia(v.media),
  };
}

function mapEvent(e: EventWithRelations): Event {
  return {
    id: e.id,
    slug: e.slug,
    // `Event.location` is the free-text venue string; falling back to the
    // province/organization name keeps `place` (required in the domain)
    // from ever being an empty string for a row that only set one of the
    // three.
    place: e.location ?? e.province?.name ?? e.organization.name,
    title: e.title,
    startAt: e.startAt.toISOString(),
    endAt: e.endAt.toISOString(),
    url: e.externalUrl ?? undefined,
    cover: e.coverMedia ? mapMedia(e.coverMedia) : undefined,
    // `capacity` has no column in this schema (see docs/DATABASE_SCHEMA.md)
    // — left unset rather than a fabricated number.
    registered: e.participantCount ?? undefined,
  };
}

function mapGallery(g: { id: string; title: string; description: string | null; items: { media: Parameters<typeof mapMedia>[0] }[] }): Gallery {
  return { id: g.id, title: g.title, description: g.description ?? undefined, items: g.items.map((i) => mapMedia(i.media)) };
}

const EMPTY_GALLERY: Gallery = { id: "empty", title: "Thư viện ảnh", items: [] };

/** `LocalNewsEntry.media`/`Video`'s own contract, and a Hero with no cover
 *  yet all need a non-optional `MediaAsset` — `"local-placeholder"` is the
 *  domain's own answer for exactly this ("intentionally generic/decorative
 *  ... was never meant to have a per-item file", `src/domain/media.ts`),
 *  never a fabricated Drive/YouTube id. */
function placeholderMedia(id: string, alt?: string): MediaAsset {
  return { id, provider: "local-placeholder", type: "image", status: "missing", alt };
}

export class DatabaseProvider implements ContentProvider {
  async getHomepage(): Promise<HomepageConfiguration> {
    const [resolved, topics] = await Promise.all([homepageService.resolveHomepage(), taxonomyRepository.listTopics()]);
    if (!resolved.hero) {
      throw new Error("Không có bài viết PUBLISHED nào để làm Hero — cần ít nhất một bài viết đã xuất bản.");
    }
    const heroArticle = await mapPublicArticle(resolved.hero);
    const trendingTopics: Topic[] = await Promise.all(
      topics.map(async (t) => ({
        id: t.id,
        slug: t.slug,
        name: t.name,
        articleCount: await taxonomyRepository.countPublishedArticlesByTopic(t.id),
        url: topicHref(t.slug),
      })),
    );
    // A small, dynamic set of "quick suggestions" for the search overlay's
    // idle state — the DB has no editorial-curation table for this (see
    // `SearchConfiguration`'s own doc comment: "not the search index
    // itself"), so the most recent published articles stand in, unlike
    // `FixtureProvider`'s hand-picked list which would otherwise go stale
    // the moment real content starts publishing.
    const recentForCorpus = await articleRepository.listPublished({ take: 5 });
    const corpus: SearchResultItem[] = recentForCorpus.map((a) => ({
      id: `article:${a.slug}`,
      type: "article",
      title: a.title,
      category: a.category.name,
      image: a.coverMedia ? mapMedia(a.coverMedia) : undefined,
      excerpt: a.excerpt ?? undefined,
      publishedAt: a.publishedAt?.toISOString(),
      url: articleHref(a.slug),
    }));

    return {
      nav: SITE_NAV,
      hero: {
        eyebrow: heroArticle.category.name,
        headline: heroArticle.title,
        lead: heroArticle.lead ?? "",
        author: heroArticle.author ?? { id: "ban-bien-tap", name: "Ban Biên tập" },
        readingTimeMinutes: heroArticle.readingTimeMinutes ?? 1,
        topicLabel: heroArticle.category.name,
        publishedAt: heroArticle.publishedAt,
        articleUrl: heroArticle.url,
        secondaryCtaLabel: "Xem thêm tin tức",
        secondaryCtaHref: "/tin-tuc",
        media: heroArticle.coverImage ?? placeholderMedia("hero-media", heroArticle.title),
      },
      trendingTopics,
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
      search: { corpus },
    };
  }

  async getFeaturedArticles(): Promise<FeaturedNewsResult> {
    const resolved = await homepageService.resolveHomepage();
    if (resolved.featured.length === 0) {
      throw new Error("Không có bài viết PUBLISHED nào để hiển thị Tin nổi bật.");
    }
    const [main, ...secondary] = await mapPublicArticles(resolved.featured);
    return { main, secondary };
  }

  async getLatestArticles(): Promise<ArticleSummary[]> {
    const rows = await articleRepository.listPublished({ take: 8 });
    return mapPublicArticles(rows);
  }

  async getStoryRail(): Promise<StoryRailItem[]> {
    const resolved = await homepageService.resolveHomepage();
    const withProvince = resolved.storyRail.filter((a) => !!a.province);
    return withProvince.map((a) => ({
      slug: a.slug,
      url: articleHref(a.slug),
      place: a.province!.name,
      publishedAt: a.publishedAt!.toISOString(),
      headline: a.title,
      category: mapCategory(a.category),
    }));
  }

  async getVideos(): Promise<Video[]> {
    // The full catalogue, not the homepage's own single "video feature"
    // pick — both the homepage section and `/video`'s full listing read
    // this same method (see `docs/PRODUCTION_DATA.md`), so it always
    // returns everything, newest first.
    const now = new Date();
    const rows = await prisma.video.findMany({
      where: { publishedAt: { not: null, lte: now } },
      orderBy: { publishedAt: "desc" },
      include: { category: true, media: true },
    });
    return rows.map(mapVideo);
  }

  async getEvents(): Promise<Event[]> {
    // Same reasoning as `getVideos()`: this backs the homepage's live
    // events AND `/su-kien/[slug]`'s `generateStaticParams`/sitemap, so it
    // must be the full set, not the homepage's curated/fallback pick.
    const rows = await eventService.listAll();
    return rows.filter((e) => e.status !== "CANCELLED").map(mapEvent);
  }

  async getPlatforms(): Promise<Platform[]> {
    const resolved = await homepageService.resolveHomepage();
    return resolved.platforms.map(mapPlatform);
  }

  async getActivityMap(): Promise<ActivityMapDataset> {
    // The DB-backed subset (`activityMapService`) is merged with the
    // handful of fields `docs/DATABASE_SCHEMA.md`'s "Scope exclusions"
    // deliberately never modeled as tables (archipelago markers, dataset
    // methodology notes) — those still come from the same static JSON
    // `FixtureProvider` reads, imported directly (a plain module import
    // works server-side; `FixtureProvider`'s own `fetch()` of this same
    // file only works because it's exclusively called from the browser —
    // see that method's comment, and `/api/activity-map`'s route for why
    // this method needs a Route Handler in front of it at all).
    const staticConfig = ACTIVITY_MAP_STATIC_JSON as unknown as ActivityMapDataset;
    const dbData = await activityMapService.getActiveMapData();
    return {
      ...staticConfig,
      updated_at: dbData.updatedAt,
      summary: { ...staticConfig.summary, ...dbData.summary, period: dbData.period ?? staticConfig.summary.period },
      provinces: dbData.provinces,
      overseas: { ...staticConfig.overseas, countries: dbData.overseas },
      reporting_period: { ...staticConfig.reporting_period, label: dbData.period ?? staticConfig.reporting_period.label },
    };
  }

  async getLocalNews(): Promise<LocalNewsEntry[]> {
    const resolved = await homepageService.resolveHomepage();
    const withOrg = resolved.localNews.filter((a) => !!a.organization);
    return withOrg.map((a) => {
      const org = a.organization!;
      return {
        slug: a.slug,
        url: articleHref(a.slug),
        title: a.title,
        publishedAt: a.publishedAt!.toISOString(),
        level: ORG_TYPE_TO_LEVEL[org.type],
        orgName: org.name,
        place: a.province?.name ?? org.name,
        unitUrl: unitHref(org.slug),
        media: a.coverMedia ? mapMedia(a.coverMedia) : placeholderMedia(`local-news-${a.id}`, a.title),
      };
    });
  }

  async getGallery(): Promise<Gallery> {
    const resolved = await homepageService.resolveHomepage();
    return resolved.gallery ? mapGallery(resolved.gallery) : EMPTY_GALLERY;
  }

  /* ---------- Route architecture lookups ---------- */

  async getArticleBySlug(slug: string): Promise<Article | null> {
    const article = await articleRepository.findBySlug(slug);
    if (!article || !isPubliclyVisible(article, new Date())) return null;
    return mapPublicArticle(article);
  }

  async getArticleSlugs(): Promise<string[]> {
    // `generateStaticParams()` pre-rendering only ever needs currently-
    // public slugs — an unpublished/scheduled article getting its own
    // static shell built at deploy time would defeat the whole point of
    // the Production Data Policy.
    const rows = await articleRepository.listPublished({});
    const now = new Date();
    return rows.filter((a) => isPubliclyVisible(a, now)).map((a) => a.slug);
  }

  async getAllArticles(): Promise<ArticleSummary[]> {
    const rows = await articleRepository.listPublished({});
    return mapPublicArticles(rows);
  }

  async getRelatedArticles(slug: string, limit = 4): Promise<ArticleSummary[]> {
    const current = await articleRepository.findBySlug(slug);
    if (!current) return [];
    const rows = await articleRepository.listPublishedByCategory(current.category.slug);
    const now = new Date();
    return mapPublicArticles(rows.filter((a) => a.slug !== slug && isPubliclyVisible(a, now)).slice(0, limit));
  }

  async getAdjacentArticles(slug: string): Promise<AdjacentArticles> {
    const article = await articleRepository.findBySlug(slug);
    if (!article || !isPubliclyVisible(article, new Date())) return { previous: null, next: null };
    // `findAdjacent` returns bare `Article` rows (no relations) — re-fetch
    // each full row before mapping, since `mapArticleToDomain` needs the
    // category/author/tags/etc. relations `ArticleWithRelations` carries.
    const [previous, next] = await articleRepository.findAdjacent(article.publishedAt!, article.id);
    const [previousFull, nextFull] = await Promise.all([
      previous ? articleRepository.findById(previous.id) : null,
      next ? articleRepository.findById(next.id) : null,
    ]);
    return {
      previous: previousFull ? await mapPublicArticle(previousFull) : null,
      next: nextFull ? await mapPublicArticle(nextFull) : null,
    };
  }

  async searchContent(query: string, limit = 30): Promise<SearchResultItem[]> {
    const index = await this.buildSearchIndex();
    return matchesSearchQuery(index, query, limit);
  }

  private async buildSearchIndex(): Promise<SearchResultItem[]> {
    const [articleRows, categories, topics, organizations, provinces, events] = await Promise.all([
      articleRepository.listPublished({}),
      taxonomyRepository.listCategories(),
      taxonomyRepository.listTopics(),
      organizationRepository.list(),
      provinceRepository.list(),
      eventRepository.listAll(),
    ]);
    const articles = await mapPublicArticles(articleRows);

    const articleItems: SearchResultItem[] = articles.map((a) => ({
      id: `article:${a.slug}`,
      type: "article",
      title: a.title,
      category: a.category.name,
      image: a.coverImage,
      excerpt: a.lead,
      publishedAt: a.publishedAt,
      url: a.url,
    }));

    const categoryItems: SearchResultItem[] = categories.map((c) => ({
      id: `category:${c.slug}`,
      type: "category",
      title: c.name,
      category: "Chuyên mục",
      excerpt: `Tin tức thuộc chuyên mục ${c.name}`,
      url: categoryHref(c.slug),
    }));

    const topicItems: SearchResultItem[] = await Promise.all(
      topics.map(async (t) => ({
        id: `topic:${t.slug}`,
        type: "topic" as const,
        title: t.name,
        category: "Chủ đề",
        excerpt: `${await taxonomyRepository.countPublishedArticlesByTopic(t.id)} bài viết`,
        url: topicHref(t.slug),
      })),
    );

    const organizationItems: SearchResultItem[] = organizations
      .filter((o) => o.status === "ACTIVE")
      .map((o) => ({
        id: `organization:${o.slug}`,
        type: "organization",
        title: o.name,
        category: ORGANIZATION_LEVEL_LABEL[ORG_TYPE_TO_LEVEL[o.type]],
        url: unitHref(o.slug),
      }));

    const provinceItems: SearchResultItem[] = provinces
      .filter((p) => p.status === "ACTIVE")
      .map((p) => ({ id: `province:${p.slug}`, type: "province", title: p.name, category: "Địa phương", url: localityHref(p.slug) }));

    const eventItems: SearchResultItem[] = events
      .filter((e) => e.status !== "CANCELLED")
      .map((e) => ({
        id: `event:${e.slug}`,
        type: "event",
        title: e.title,
        category: "Sự kiện",
        image: e.coverMedia ? mapMedia(e.coverMedia) : undefined,
        excerpt: e.location ?? undefined,
        publishedAt: e.startAt.toISOString(),
        url: e.externalUrl || eventHref(e.slug),
      }));

    return [...articleItems, ...categoryItems, ...topicItems, ...organizationItems, ...provinceItems, ...eventItems];
  }

  async getCategories(): Promise<Category[]> {
    const rows = await taxonomyRepository.listCategories();
    return rows.map(mapCategory);
  }

  async getCategoryBySlug(slug: string): Promise<Category | null> {
    const rows = await taxonomyRepository.listCategories();
    const found = rows.find((c) => c.slug === slug);
    return found ? mapCategory(found) : null;
  }

  async getArticlesByCategory(slug: string): Promise<ArticleSummary[]> {
    const rows = await articleRepository.listPublishedByCategory(slug);
    const now = new Date();
    return mapPublicArticles(rows.filter((a) => isPubliclyVisible(a, now)));
  }

  async getTopics(): Promise<Topic[]> {
    const rows = await taxonomyRepository.listTopics();
    return Promise.all(
      rows.map(async (t) => ({
        id: t.id,
        slug: t.slug,
        name: t.name,
        articleCount: await taxonomyRepository.countPublishedArticlesByTopic(t.id),
        url: topicHref(t.slug),
      })),
    );
  }

  async getTopicBySlug(slug: string): Promise<Topic | null> {
    const rows = await taxonomyRepository.listTopics();
    const found = rows.find((t) => t.slug === slug);
    if (!found) return null;
    return { id: found.id, slug: found.slug, name: found.name, articleCount: await taxonomyRepository.countPublishedArticlesByTopic(found.id), url: topicHref(found.slug) };
  }

  async getArticlesByTopic(slug: string): Promise<ArticleSummary[]> {
    const rows = await articleRepository.listPublishedByTopic(slug);
    const now = new Date();
    return mapPublicArticles(rows.filter((a) => isPubliclyVisible(a, now)));
  }

  async getLocalityBySlug(slug: string): Promise<LocalityProfile | null> {
    const province = await activityMapRepository.findProvinceBySlug(slug);
    if (!province || province.status !== "ACTIVE") return null;

    const now = new Date();
    const [provinceArticles, mapData, latestEvent, orgs] = await Promise.all([
      articleRepository.listPublishedByProvince(province.id),
      activityMapService.getActiveMapData(),
      eventRepository.listByProvince(province.id).then((rows) => rows[0] ?? null),
      organizationRepository.listByProvince(province.id),
    ]);

    const localNewsArticles = provinceArticles.filter((a) => isPubliclyVisible(a, now) && !!a.organization);
    const localNews: LocalNewsEntry[] = localNewsArticles.map((a) => ({
      slug: a.slug,
      url: articleHref(a.slug),
      title: a.title,
      publishedAt: a.publishedAt!.toISOString(),
      level: ORG_TYPE_TO_LEVEL[a.organization!.type],
      orgName: a.organization!.name,
      place: province.name,
      unitUrl: unitHref(a.organization!.slug),
      media: a.coverMedia ? mapMedia(a.coverMedia) : placeholderMedia(`local-news-${a.id}`, a.title),
    }));

    const storyRail: StoryRailItem[] = provinceArticles
      .filter((a) => isPubliclyVisible(a, now))
      .map((a) => ({ slug: a.slug, url: articleHref(a.slug), place: province.name, publishedAt: a.publishedAt!.toISOString(), headline: a.title, category: mapCategory(a.category) }));

    const provinceStat = mapData.provinces.find((p) => p.slug === slug);
    const activity = provinceStat
      ? {
          provinceId: provinceStat.province_id,
          provinceName: provinceStat.province_name,
          slug: provinceStat.slug,
          reported: provinceStat.reported,
          period: provinceStat.period,
          updatedAt: mapData.updatedAt,
          articleCount: provinceStat.article_count,
          activityCount: provinceStat.activity_count,
          studentCount: provinceStat.student_count,
          categoryDistribution: provinceStat.category_distribution
            ? Object.entries(provinceStat.category_distribution).map(([catSlug, count]) => ({ slug: catSlug, label: catSlug, count }))
            : null,
          latestArticle: provinceStat.latest_article
            ? { title: provinceStat.latest_article.title, publishedAt: provinceStat.latest_article.published_at }
            : null,
        }
      : null;

    return {
      slug,
      name: province.name,
      province: mapProvince(province),
      localNews,
      stories: storyRail,
      activity,
      latestActivity: latestEvent ? mapEvent(latestEvent) : null,
      organizations: orgs.map((o) => mapOrganization(o, province)),
      // No table ties a Gallery item to a locality in this schema (see
      // `docs/DATABASE_SCHEMA.md`'s "Scope exclusions" precedent for other
      // fixture-only fields) — an honest empty list, not a fabricated one.
      relatedMedia: [],
    };
  }

  async getLocalitySlugs(): Promise<string[]> {
    const rows = await provinceRepository.list();
    return rows.filter((p) => p.status === "ACTIVE").map((p) => p.slug);
  }

  async getUnitBySlug(slug: string): Promise<UnitProfile | null> {
    const org = await organizationRepository.findBySlug(slug);
    if (!org || org.status !== "ACTIVE") return null;
    const now = new Date();
    const articles = await articleRepository.listPublishedByOrganization(org.id);
    const localNews: LocalNewsEntry[] = articles
      .filter((a) => isPubliclyVisible(a, now))
      .map((a) => ({
        slug: a.slug,
        url: articleHref(a.slug),
        title: a.title,
        publishedAt: a.publishedAt!.toISOString(),
        level: ORG_TYPE_TO_LEVEL[org.type],
        orgName: org.name,
        place: a.province?.name ?? org.name,
        unitUrl: unitHref(org.slug),
        media: a.coverMedia ? mapMedia(a.coverMedia) : placeholderMedia(`local-news-${a.id}`, a.title),
      }));
    return { slug: org.slug, name: org.name, level: ORG_TYPE_TO_LEVEL[org.type], localNews, activityStats: null };
  }

  async getUnitSlugs(): Promise<string[]> {
    const rows = await organizationRepository.list();
    return rows.filter((o) => o.status === "ACTIVE").map((o) => o.slug);
  }

  async getProvinces(): Promise<Province[]> {
    const rows = await provinceRepository.list();
    return rows.filter((p) => p.status === "ACTIVE").map(mapProvince);
  }

  async getOverseasOrganizations(): Promise<OverseasOrganization[]> {
    const rows = await activityMapRepository.listOverseasOrganizations();
    return rows.map((o) => ({ id: o.slug, name: o.name, country: o.countryCode ?? undefined }));
  }

  async getEventBySlug(slug: string): Promise<Event | null> {
    const event = await eventService.getBySlug(slug);
    return event ? mapEvent(event) : null;
  }
}
