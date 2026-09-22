import { activityMapRepository } from "@/server/repositories/activityMapRepository";
import type { PlatformActivityItem } from "@/domain/activity";

/** How many Hoạt động activities each province / association carries in the map payload (the detail card shows these). */
const ACTIVITIES_PER_UNIT = 3;
const ACTIVITIES_LATEST = 4;

type MapActivityRow = Awaited<ReturnType<typeof activityMapRepository.platformActivitiesForMap>>[number];

function toItem(a: MapActivityRow, withPlace: boolean): PlatformActivityItem {
  return {
    id: a.id,
    title: a.title,
    url: a.url,
    thumbnail_url: a.thumbnailUrl,
    organization_name: a.organizationName,
    start_at: a.startAt.toISOString(),
    end_at: a.endAt.toISOString(),
    status: a.status,
    place: withPlace ? (a.province?.name ?? a.overseasOrganization?.name ?? null) : null,
  };
}

function groupBy(rows: MapActivityRow[], key: (a: MapActivityRow) => string | null) {
  const map = new Map<string, { count: number; items: PlatformActivityItem[] }>();
  for (const a of rows) {
    const k = key(a);
    if (!k) continue;
    const entry = map.get(k) ?? { count: 0, items: [] };
    entry.count += 1;
    if (entry.items.length < ACTIVITIES_PER_UNIT) entry.items.push(toItem(a, false));
    map.set(k, entry);
  }
  return map;
}

/**
 * Assembles the Activity Map's DB-backed subset — the per-province figures
 * and the overseas totals — in the wire shape `src/domain/activity.ts`
 * documents (`DatabaseProvider.getActivityMap()` merges it with the static
 * config for archipelago markers and dataset notes).
 *
 * The per-province numbers are derived straight from published content: a
 * province's figure is its count of live articles, either tied to it
 * directly (`Article.provinceId`) or through a reporting unit
 * (`Article.organization.provinceId`). There is no separately-entered
 * report table in the picture any more — every number the map shows traces
 * back to an actual published article, and "tin mới nhất" is that
 * province's newest one.
 *
 * Alongside the articles, each province / overseas association carries the
 * activities its units run on the Hoạt động platform (`PlatformActivity`,
 * mirrored by the refresher) — listed like articles, linking out to their
 * landing pages. Overseas associations' figure is real too: activities +
 * published articles of the linked unit (it used to be a seeded number).
 */
export const activityMapService = {
  async getActiveMapData() {
    const now = new Date();
    const [provinces, overseas, articles, activities, overseasArticleCounts] = await Promise.all([
      activityMapRepository.listProvinces(),
      activityMapRepository.listOverseasOrganizations(),
      activityMapRepository.publishedArticlesForProvinceMap(now),
      activityMapRepository.platformActivitiesForMap(),
      activityMapRepository.publishedArticleCountsForOverseas(now),
    ]);
    // Hoạt động activities (mirrored by scripts/syncPlatformActivities.ts), newest start first.
    const activitiesByProvince = groupBy(activities, (a) => a.provinceId);
    const activitiesByOverseas = groupBy(activities, (a) => a.overseasOrganizationId);
    const articlesByOrganization = new Map(overseasArticleCounts.map((r) => [r.organizationId, r._count._all]));

    // provinceId -> { count, latest } — `articles` is already newest-first,
    // so the first row seen for a province is its latest.
    const byProvince = new Map<string, { count: number; latest: { title: string; publishedAt: Date } | null }>();
    let newestOverall: Date | null = null;
    for (const a of articles) {
      const provinceId = a.provinceId ?? a.organization?.provinceId;
      if (!provinceId || !a.publishedAt) continue;
      const entry = byProvince.get(provinceId) ?? { count: 0, latest: null };
      entry.count += 1;
      if (!entry.latest) entry.latest = { title: a.title, publishedAt: a.publishedAt };
      byProvince.set(provinceId, entry);
      if (!newestOverall || a.publishedAt > newestOverall) newestOverall = a.publishedAt;
    }

    const provinceRows = provinces.map((province) => {
      const entry = byProvince.get(province.id);
      const count = entry?.count ?? 0;
      // null, not 0, when a province has no article yet — the map renders
      // that as a hollow "chưa có tin bài" marker rather than a real zero.
      const articleCount = count > 0 ? count : null;
      return {
        province_id: province.mapCode,
        province_name: province.name,
        slug: province.slug,
        lat: province.lat,
        lon: province.lon,
        // Kept equal to `article_count` for wire compatibility — nothing
        // renders a separate "hoạt động" figure for a province any more.
        activity_count: articleCount,
        article_count: articleCount,
        unit_count: null,
        student_count: null,
        reported: count > 0,
        latest_article: entry?.latest
          ? { title: entry.latest.title, published_at: entry.latest.publishedAt.toISOString() }
          : null,
        category_distribution: null,
        period: "",
        unit_url: `/don-vi/${province.slug}`,
        platform_activity_count: activitiesByProvince.get(province.id)?.count ?? 0,
        platform_activities: activitiesByProvince.get(province.id)?.items ?? [],
      };
    });

    const totalArticles = provinceRows.reduce((sum, p) => sum + (p.article_count ?? 0), 0);

    return {
      period: null as string | null,
      updatedAt: (newestOverall ?? now).toISOString(),
      provinces: provinceRows,
      // Real figures (was the seeded `activityCount`): its Hoạt động activities + published articles of its linked unit.
      overseas: overseas
        .map((o) => {
          const acts = activitiesByOverseas.get(o.id);
          const articleCount = o.organizationId ? (articlesByOrganization.get(o.organizationId) ?? 0) : 0;
          return {
            name: o.name,
            activity_count: (acts?.count ?? 0) + articleCount,
            article_count: articleCount,
            platform_activity_count: acts?.count ?? 0,
            platform_activities: acts?.items ?? [],
          };
        })
        .sort((a, b) => b.activity_count - a.activity_count || a.name.localeCompare(b.name, "vi")),
      platformActivitiesLatest: activities.slice(0, ACTIVITIES_LATEST).map((a) => toItem(a, true)),
      summary: {
        total_platform_activities: activities.length,
        total_activities: totalArticles,
        total_articles: totalArticles,
        participating_students: 0,
        provinces_total: provinceRows.length,
        provinces_reported: provinceRows.filter((p) => p.reported).length,
      },
    };
  },
};
