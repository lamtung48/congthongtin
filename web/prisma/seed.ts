/**
 * Development seed — brief section 14: "Tạo seed development từ fixture
 * frontend hiện tại nếu hợp lý." Reads the exact same fixtures the frontend
 * already renders (`src/data-access/fixtures/*.ts`,
 * `public/data/activity-map.json`) instead of inventing new demo content,
 * so a fresh `migrate dev` + `db seed` gets a database that can produce
 * output equivalent to what `FixtureProvider` already serves — without
 * touching or deleting `FixtureProvider` itself (still the live data source
 * for the static export; see docs/BACKEND_ARCHITECTURE.md, "What this task
 * does not wire up").
 *
 * Scope boundary, stated up front rather than silently: the canonical
 * `Article` pool seeded here is the union of `FEATURED_ARTICLES`,
 * `LATEST_ARTICLES`, and the homepage's standalone `HERO` fixture (its own
 * slug isn't a member of either of the first two — easy to miss, and
 * missing it would silently drop the one article that exercises every
 * `ArticleBlock` type) — the same pool `docs/ARTICLE_DETAIL.md` already
 * calls "the one deduplicated pool every article method reads from" on the
 * frontend side. `StoryRail`/`LocalNews` fixture slugs that fall *outside*
 * that pool (`ngoi-nha-viet-praha`, `day-tieng-viet-khiem-thi`,
 * `y-te-sinh-vien-ha-giang`) are not seeded as their own `Article` rows —
 * doing so faithfully would mean inventing province/category linkage the
 * fixtures don't actually specify for them. Only the two articles with a
 * full body in `ARTICLE_CONTENT` (`dai-hoi-xii-khai-mac`,
 * `tuyen-duong-112-sv5t`) get `ArticleBlock` rows; every other seeded
 * article is published with no body, matching the frontend's own "chưa có
 * nội dung" empty state for the rest of the fixture pool today.
 *
 * Run explicitly — Prisma 7 no longer auto-seeds after `migrate dev`/`migrate
 * reset` (see docs/ENVIRONMENT.md):
 *   npx prisma db seed
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { CATEGORIES, TOPICS } from "../src/data-access/fixtures/taxonomy";
import { PROVINCES } from "../src/data-access/fixtures/provinces";
import { OVERSEAS_ORGANIZATIONS } from "../src/data-access/fixtures/overseasOrganizations";
import { FEATURED_ARTICLES } from "../src/data-access/fixtures/featuredArticles";
import { LATEST_ARTICLES } from "../src/data-access/fixtures/latestArticles";
import { ARTICLE_CONTENT } from "../src/data-access/fixtures/articleContent";
import { HERO, HERO_SLUG } from "../src/data-access/fixtures/homepage";
import { categoryBySlug } from "../src/data-access/fixtures/taxonomy";
import { EVENTS } from "../src/data-access/fixtures/events";
import { VIDEOS } from "../src/data-access/fixtures/videos";
import { HOMEPAGE_GALLERY } from "../src/data-access/fixtures/gallery";
import { PLATFORMS } from "../src/data-access/fixtures/platforms";
import { LOCAL_NEWS } from "../src/data-access/fixtures/localNews";
import type { ArticleBlock } from "../src/domain/articleContent";
import type { ArticleSummary } from "../src/domain/article";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

interface ActivityMapProvinceRow {
  province_id: string;
  province_name: string;
  slug: string;
  lat: number;
  lon: number;
  activity_count: number | null;
  article_count: number | null;
  unit_count: number | null;
  student_count: number | null;
  category_distribution: Record<string, number> | null;
  reported: boolean;
  period: string;
}

interface ActivityMapJson {
  provinces: ActivityMapProvinceRow[];
  overseas: { countries: { name: string; activity_count: number }[] };
  reporting_period: { label: string };
}

function loadActivityMap(): ActivityMapJson {
  const file = path.join(process.cwd(), "public/data/activity-map.json");
  return JSON.parse(readFileSync(file, "utf-8"));
}

/** "04:57" -> 297. "—" (no real duration yet) -> null. */
function parseDurationToSeconds(label: string): number | null {
  const m = /^(\d+):(\d{2})$/.exec(label);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * `activity-map.json`'s own `categories` field uses a different slug
 * convention than `taxonomy.ts`'s `CATEGORIES` (`sv5tot` vs
 * `sinh-vien-5-tot`, etc) even though the Vietnamese labels are the same
 * concept — a pre-existing inconsistency between the two fixture files, not
 * something introduced here. Bridged explicitly rather than silently
 * dropping every category-breakdown `ActivityStatistic` row that would
 * otherwise fail to resolve a `categoryId`.
 */
const MAP_CATEGORY_SLUG_TO_TAXONOMY_SLUG: Record<string, string> = {
  sv5tot: "sinh-vien-5-tot",
  tinhnguyen: "tinh-nguyen",
  nckh: "nghien-cuu",
  hoinhap: "hoi-nhap",
};

const PLACE_TO_PROVINCE_SLUG: Record<string, string> = {
  "Hà Nội": "ha-noi",
  "Đà Nẵng": "da-nang",
  "Cần Thơ": "can-tho",
  "TP. Hồ Chí Minh": "tp-ho-chi-minh",
  "Huế": "hue",
};

async function main() {
  const activityMap = loadActivityMap();

  console.log("Seeding roles...");
  const roleNames = ["admin", "editor", "author", "province_reporter", "viewer"];
  await prisma.role.createMany({ data: roleNames.map((name) => ({ name })), skipDuplicates: true });

  console.log("Seeding a default admin user + author profiles...");
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@hoisinhvien.vn" },
    create: { email: "admin@hoisinhvien.vn", displayName: "Quản trị hệ thống", status: "ACTIVE" },
    update: {},
  });
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "admin" } });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
    create: { userId: adminUser.id, roleId: adminRole.id },
    update: {},
  });

  const authorByFixtureId = new Map<string, string>(); // fixture author id -> AuthorProfile.id
  for (const [fixtureId, displayName, title] of [
    ["ban-bien-tap", "Ban Biên tập", "Cổng thông tin số Hội Sinh viên Việt Nam"],
    ["phong-thi-dua-khen-thuong", "Ban Thi đua – Khen thưởng Trung ương Hội", undefined],
  ] as const) {
    const author = await prisma.authorProfile.upsert({
      where: { id: fixtureId },
      create: { id: fixtureId, displayName, title },
      update: {},
    });
    authorByFixtureId.set(fixtureId, author.id);
  }

  console.log("Seeding categories...");
  const categoryIdBySlug = new Map<string, string>();
  for (const [index, c] of CATEGORIES.entries()) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, name: c.name, order: index },
      update: { name: c.name },
    });
    categoryIdBySlug.set(c.slug, row.id);
  }

  console.log("Seeding topics...");
  const topicIdBySlug = new Map<string, string>();
  for (const t of TOPICS) {
    const row = await prisma.topic.upsert({ where: { slug: t.slug }, create: { slug: t.slug, name: t.name }, update: { name: t.name } });
    topicIdBySlug.set(t.slug, row.id);
  }

  console.log("Seeding tags referenced by seeded article bodies...");
  const tagFixtures = Object.values(ARTICLE_CONTENT).flatMap((extra) => extra.tags ?? []);
  const tagIdBySlug = new Map<string, string>();
  for (const tag of tagFixtures) {
    const row = await prisma.tag.upsert({ where: { slug: tag.slug }, create: { slug: tag.slug, name: tag.name }, update: { name: tag.name } });
    tagIdBySlug.set(tag.slug, row.id);
  }

  console.log("Seeding provinces from the Activity Map dataset...");
  const provinceIdBySlug = new Map<string, string>();
  for (const p of activityMap.provinces) {
    const row = await prisma.province.upsert({
      where: { slug: p.slug },
      create: {
        slug: p.slug,
        name: p.province_name,
        // No separate official GSO code source in the current fixtures —
        // `code` mirrors `mapCode` until a real administrative-code list is
        // integrated. See docs/DATABASE_SCHEMA.md, "PROVINCE STATUS".
        code: p.province_id,
        mapCode: p.province_id,
        lat: p.lat,
        lon: p.lon,
      },
      update: { name: p.province_name, lat: p.lat, lon: p.lon },
    });
    provinceIdBySlug.set(p.slug, row.id);
  }
  // Provinces the static PROVINCES fixture lists but the Activity Map JSON
  // doesn't (there are none today — both sources list the same 34 — but
  // this keeps the seed correct if that ever drifts).
  for (const p of PROVINCES) {
    if (provinceIdBySlug.has(p.slug)) continue;
    const row = await prisma.province.upsert({
      where: { slug: p.slug },
      create: { slug: p.slug, name: p.name, code: p.id, mapCode: p.id, lat: p.lat, lon: p.lon },
      update: {},
    });
    provinceIdBySlug.set(p.slug, row.id);
  }

  console.log("Seeding overseas organizations...");
  const overseasIdByName = new Map<string, string>();
  for (const o of OVERSEAS_ORGANIZATIONS) {
    const fixtureStat = activityMap.overseas.countries.find((c) => c.name === o.name);
    const row = await prisma.overseasOrganization.upsert({
      where: { slug: o.id },
      create: { slug: o.id, name: o.name, countryCode: o.country, activityCount: fixtureStat?.activity_count ?? 0 },
      update: { activityCount: fixtureStat?.activity_count ?? 0 },
    });
    overseasIdByName.set(o.name, row.id);
  }

  console.log("Seeding a minimal organization set for the seeded local-news articles...");
  const centralOrg = await prisma.organization.upsert({
    where: { slug: "trung-uong-hoi" },
    create: { slug: "trung-uong-hoi", name: "Trung ương Hội Sinh viên Việt Nam", type: "CENTRAL" },
    update: {},
  });
  const orgSeeds: { slug: string; name: string; type: "PROVINCE" | "UNIVERSITY" | "OVERSEAS"; provinceSlug?: string; overseasName?: string }[] = [
    { slug: "hoi-sinh-vien-tp-ha-noi", name: "Hội Sinh viên TP. Hà Nội", type: "PROVINCE", provinceSlug: "ha-noi" },
    { slug: "hoi-sinh-vien-tp-da-nang", name: "Hội Sinh viên TP. Đà Nẵng", type: "PROVINCE", provinceSlug: "da-nang" },
    { slug: "hoi-sinh-vien-dai-hoc-bach-khoa-ha-noi", name: "Hội Sinh viên Đại học Bách khoa Hà Nội", type: "UNIVERSITY", provinceSlug: "ha-noi" },
    { slug: "hoi-sinh-vien-dai-hoc-can-tho", name: "Hội Sinh viên Đại học Cần Thơ", type: "UNIVERSITY", provinceSlug: "can-tho" },
    { slug: "hoi-sinh-vien-viet-nam-tai-nhat-ban", name: "Hội Sinh viên Việt Nam tại Nhật Bản", type: "OVERSEAS" },
    { slug: "hoi-sinh-vien-viet-nam-tai-phap", name: "Hội Sinh viên Việt Nam tại Pháp", type: "OVERSEAS", overseasName: "Hội Sinh viên Việt Nam tại Pháp" },
  ];
  const orgIdByName = new Map<string, string>([[centralOrg.name, centralOrg.id]]);
  for (const o of orgSeeds) {
    const row = await prisma.organization.upsert({
      where: { slug: o.slug },
      create: {
        slug: o.slug,
        name: o.name,
        type: o.type,
        parentId: centralOrg.id,
        provinceId: o.provinceSlug ? provinceIdBySlug.get(o.provinceSlug) : undefined,
      },
      update: {},
    });
    orgIdByName.set(o.name, row.id);
    if (o.overseasName && overseasIdByName.has(o.overseasName)) {
      await prisma.overseasOrganization.update({
        where: { id: overseasIdByName.get(o.overseasName)! },
        data: { organizationId: row.id },
      });
    }
  }

  console.log("Seeding the article pool (FEATURED_ARTICLES + LATEST_ARTICLES + HERO, deduplicated by slug)...");
  const localNewsBySlug = new Map(LOCAL_NEWS.map((n) => [n.slug, n]));
  const allSummaries = new Map<string, ArticleSummary>();
  for (const a of [FEATURED_ARTICLES.main, ...FEATURED_ARTICLES.secondary, ...LATEST_ARTICLES]) {
    allSummaries.set(a.slug, a);
  }
  // HERO isn't a member of either fixture above (it's authored separately
  // in `homepage.ts`) but is the one article exercising every
  // `ArticleBlock` type in `ARTICLE_CONTENT` — dropping it silently would
  // leave the richest seeded example out. `topicLabel` on `HeroContent` is
  // a display string, not a `Category` link, so its category is inferred
  // from its actual `ARTICLE_CONTENT` topic tag ("dai-hoi-xii") instead.
  if (!allSummaries.has(HERO_SLUG)) {
    allSummaries.set(HERO_SLUG, {
      id: HERO_SLUG,
      slug: HERO_SLUG,
      url: HERO.articleUrl,
      title: `${HERO.headline} ${HERO.headlineAccent ?? ""}`.trim(),
      lead: HERO.lead,
      category: categoryBySlug("dai-hoi-xii")!,
      publishedAt: HERO.publishedAt,
    });
  }

  for (const summary of allSummaries.values()) {
    const extra = ARTICLE_CONTENT[summary.slug];
    const localNews = localNewsBySlug.get(summary.slug);
    const provinceSlug = localNews ? PLACE_TO_PROVINCE_SLUG[localNews.place] : undefined;

    const article = await prisma.article.upsert({
      where: { slug: summary.slug },
      create: {
        slug: summary.slug,
        title: summary.title,
        excerpt: summary.lead,
        status: "PUBLISHED",
        publishedAt: new Date(summary.publishedAt),
        categoryId: categoryIdBySlug.get(summary.category.slug)!,
        authorId: extra?.author ? authorByFixtureId.get(extra.author.id) : undefined,
        organizationId: localNews ? orgIdByName.get(localNews.orgName) : undefined,
        provinceId: provinceSlug ? provinceIdBySlug.get(provinceSlug) : undefined,
        createdById: adminUser.id,
      },
      update: {
        title: summary.title,
        excerpt: summary.lead,
      },
    });

    for (const topic of extra?.topics ?? []) {
      const topicId = topicIdBySlug.get(topic.slug);
      if (!topicId) continue;
      await prisma.articleTopic.upsert({
        where: { articleId_topicId: { articleId: article.id, topicId } },
        create: { articleId: article.id, topicId },
        update: {},
      });
    }
    for (const tag of extra?.tags ?? []) {
      const tagId = tagIdBySlug.get(tag.slug);
      if (!tagId) continue;
      await prisma.articleTag.upsert({
        where: { articleId_tagId: { articleId: article.id, tagId } },
        create: { articleId: article.id, tagId },
        update: {},
      });
    }

    if (extra?.body) {
      await prisma.articleBlock.deleteMany({ where: { articleId: article.id } });
      await prisma.articleBlock.createMany({ data: blocksToRows(article.id, extra.body) });
    }
  }

  console.log("Seeding videos...");
  for (const v of VIDEOS) {
    // Re-running this script must not leak a fresh orphaned `MediaAsset` on
    // every pass: reuse the existing `Video`'s media row if it already
    // exists, only `create` one for a video seeded for the first time.
    const existingVideo = await prisma.video.findUnique({ where: { slug: v.id } });
    const mediaData = {
      provider: (v.media.provider === "youtube" ? "YOUTUBE" : "LOCAL_PLACEHOLDER") as "YOUTUBE" | "LOCAL_PLACEHOLDER",
      providerFileId: v.media.sourceId,
      type: "VIDEO" as const,
      alt: v.media.alt,
      status: (v.media.status === "ready" ? "READY" : "MISSING") as "READY" | "MISSING",
    };
    const mediaId = existingVideo
      ? (await prisma.mediaAsset.update({ where: { id: existingVideo.mediaId }, data: mediaData })).id
      : (await prisma.mediaAsset.create({ data: mediaData })).id;

    await prisma.video.upsert({
      where: { slug: v.id },
      create: {
        slug: v.id,
        title: v.title,
        description: v.description,
        categoryId: categoryIdBySlug.get(v.category.slug)!,
        durationSeconds: parseDurationToSeconds(v.durationLabel),
        mediaId,
        publishedAt: new Date(v.publishedAt),
      },
      update: { title: v.title, description: v.description },
    });
  }

  console.log("Seeding the homepage gallery...");
  const gallery = await prisma.gallery.upsert({
    where: { slug: HOMEPAGE_GALLERY.id },
    create: { slug: HOMEPAGE_GALLERY.id, title: HOMEPAGE_GALLERY.title, description: HOMEPAGE_GALLERY.description },
    update: {},
  });
  for (const [order, item] of HOMEPAGE_GALLERY.items.entries()) {
    // One `GalleryItem` per (galleryId, order) slot (see the `@@unique` on
    // that pair in schema.prisma) — reuse the slot's existing media row
    // instead of creating a new orphaned one on every re-run.
    const existingItem = await prisma.galleryItem.findUnique({ where: { galleryId_order: { galleryId: gallery.id, order } } });
    const mediaData = { provider: "GOOGLE_DRIVE" as const, type: "IMAGE" as const, caption: item.caption, status: "MISSING" as const };
    const mediaId = existingItem
      ? (await prisma.mediaAsset.update({ where: { id: existingItem.mediaId }, data: mediaData })).id
      : (await prisma.mediaAsset.create({ data: mediaData })).id;

    await prisma.galleryItem.upsert({
      where: { galleryId_order: { galleryId: gallery.id, order } },
      create: { galleryId: gallery.id, mediaId, order, caption: item.caption },
      update: { mediaId, caption: item.caption },
    });
  }
  // Any leftover slot from a shrunk fixture (fewer items than a previous
  // seed run) — drop items beyond the current fixture length.
  await prisma.galleryItem.deleteMany({ where: { galleryId: gallery.id, order: { gte: HOMEPAGE_GALLERY.items.length } } });

  console.log("Seeding events...");
  for (const e of EVENTS) {
    await prisma.event.upsert({
      where: { slug: e.slug },
      create: {
        slug: e.slug,
        title: e.title,
        location: e.place,
        startAt: new Date(e.startAt),
        endAt: new Date(e.endAt),
        externalUrl: e.url,
        participantCount: e.registered,
        organizationId: centralOrg.id,
        status: "UPCOMING",
      },
      update: {},
    });
  }

  console.log("Seeding platforms...");
  const platformCategoryMap: Record<string, "CONFERENCE" | "TRAINING" | "SV5TOT" | "VOLUNTEER" | "DATA"> = {
    conference: "CONFERENCE",
    training: "TRAINING",
    sv5tot: "SV5TOT",
    volunteer: "VOLUNTEER",
    data: "DATA",
  };
  const platformStatusMap: Record<string, "LIVE" | "ACTIVE" | "MAINTENANCE" | "OPEN" | "UNAVAILABLE" | "SOON"> = {
    live: "LIVE",
    active: "ACTIVE",
    maintenance: "MAINTENANCE",
    open: "OPEN",
    unavailable: "UNAVAILABLE",
    soon: "SOON",
  };
  for (const p of PLATFORMS) {
    await prisma.platform.upsert({
      where: { slug: p.slug },
      create: {
        slug: p.slug,
        name: p.name,
        url: p.url,
        description: p.description,
        category: platformCategoryMap[p.category],
        status: platformStatusMap[p.status],
        accessLevel: p.accessLevel,
        metric: p.metric,
        liveActivityNote: p.liveActivityNote,
      },
      update: {},
    });
  }

  console.log("Seeding Activity Map statistics for the current reporting period...");
  for (const p of activityMap.provinces) {
    const provinceId = provinceIdBySlug.get(p.slug);
    if (!provinceId) continue;
    await prisma.activityStatistic.upsert({
      where: { provinceId_categoryId_period: { provinceId, categoryId: null as unknown as string, period: p.period } },
      create: {
        provinceId,
        categoryId: null,
        period: p.period,
        activityCount: p.activity_count,
        articleCount: p.article_count,
        organizationCount: p.unit_count,
        participantCount: p.student_count,
        reported: p.reported,
      },
      update: {
        activityCount: p.activity_count,
        articleCount: p.article_count,
        organizationCount: p.unit_count,
        participantCount: p.student_count,
        reported: p.reported,
      },
    }).catch(async () => {
      // See ActivityMapRepository.upsertStatistic's comment: the compound
      // unique index can't reliably target a NULL categoryId, so fall back
      // to an explicit find-then-write for the aggregate row.
      const existing = await prisma.activityStatistic.findFirst({ where: { provinceId, categoryId: null, period: p.period } });
      const data = {
        provinceId,
        categoryId: null,
        period: p.period,
        activityCount: p.activity_count,
        articleCount: p.article_count,
        organizationCount: p.unit_count,
        participantCount: p.student_count,
        reported: p.reported,
      };
      if (existing) await prisma.activityStatistic.update({ where: { id: existing.id }, data });
      else await prisma.activityStatistic.create({ data });
    });

    for (const [categorySlug, count] of Object.entries(p.category_distribution ?? {})) {
      const categoryId = categoryIdBySlug.get(MAP_CATEGORY_SLUG_TO_TAXONOMY_SLUG[categorySlug] ?? categorySlug);
      if (!categoryId) continue;
      await prisma.activityStatistic.upsert({
        where: { provinceId_categoryId_period: { provinceId, categoryId, period: p.period } },
        create: { provinceId, categoryId, period: p.period, activityCount: count, articleCount: null, organizationCount: null, participantCount: null, reported: p.reported },
        update: { activityCount: count, reported: p.reported },
      });
    }
  }

  console.log("Seeding a default HomepageConfiguration (sections enabled, no placements — exercises the automatic fallback path)...");
  const config = await prisma.homepageConfiguration.upsert({
    where: { id: "default" },
    create: { id: "default", name: "default", isActive: true },
    update: { isActive: true },
  });
  const sectionKeys = ["HERO", "FEATURED_ARTICLES", "STORY_RAIL", "VIDEO_FEATURE", "PLATFORM_CARDS", "EVENTS", "GALLERY", "LOCAL_NEWS"] as const;
  for (const [order, key] of sectionKeys.entries()) {
    await prisma.homepageSection.upsert({
      where: { configurationId_key: { configurationId: config.id, key } },
      create: { configurationId: config.id, key, order, isEnabled: true },
      update: { order, isEnabled: true },
    });
  }

  console.log("Seed complete.");
}

function blocksToRows(articleId: string, blocks: ArticleBlock[]) {
  return blocks.map((block, order) => ({
    articleId,
    type: block.type.toUpperCase() as
      | "PARAGRAPH"
      | "HEADING"
      | "IMAGE"
      | "GALLERY"
      | "YOUTUBE"
      | "QUOTE"
      | "TABLE"
      | "EMBED",
    order,
    data: blockData(block),
  }));
}

/** Strips the frontend-only `id`/`type` fields, keeping only the payload
 *  `parseArticleBlockData()` (src/server/validation/articleBlocks.ts)
 *  actually validates — media blocks reference a placeholder `mediaId`
 *  since brief item 18 excludes real media upload from this task. */
function blockData(block: ArticleBlock): object {
  switch (block.type) {
    case "paragraph":
      return { runs: block.runs };
    case "heading":
      return { level: block.level, text: block.text };
    case "image":
      return { mediaId: `placeholder:${block.media.id}`, caption: block.caption };
    case "gallery":
      return { mediaIds: block.items.map((i) => `placeholder:${i.id}`), caption: block.caption };
    case "youtube":
      return { mediaId: `placeholder:${block.media.id}`, title: block.title };
    case "quote":
      return { text: block.text, cite: block.cite };
    case "table":
      return { caption: block.caption, headers: block.headers, rows: block.rows };
    case "embed":
      return { provider: block.provider, title: block.title, status: block.status, url: block.url, aspectRatio: block.aspectRatio };
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
