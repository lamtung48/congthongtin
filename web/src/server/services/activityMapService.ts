import { activityMapRepository } from "@/server/repositories/activityMapRepository";

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
 */
export const activityMapService = {
  async getActiveMapData() {
    const now = new Date();
    const [provinces, overseas, articles] = await Promise.all([
      activityMapRepository.listProvinces(),
      activityMapRepository.listOverseasOrganizations(),
      activityMapRepository.publishedArticlesForProvinceMap(now),
    ]);

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
      };
    });

    const totalArticles = provinceRows.reduce((sum, p) => sum + (p.article_count ?? 0), 0);

    return {
      period: null as string | null,
      updatedAt: (newestOverall ?? now).toISOString(),
      provinces: provinceRows,
      overseas: overseas.map((o) => ({ name: o.name, activity_count: o.activityCount })),
      summary: {
        total_activities: totalArticles,
        total_articles: totalArticles,
        participating_students: 0,
        provinces_total: provinceRows.length,
        provinces_reported: provinceRows.filter((p) => p.reported).length,
      },
    };
  },
};
