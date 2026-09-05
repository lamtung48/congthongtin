import { activityMapRepository } from "@/server/repositories/activityMapRepository";

/**
 * Assembles the same shape `ActivityMapData` in `src/domain/activity.ts`
 * already documents a real backend producing — that file's own comment
 * says it plainly: "A real backend would assemble `ActivityMapData` by
 * joining `Province`/`OverseasOrganization` with `ActivityStatistic` rows
 * for the active period." This is that join, proving the schema in
 * `prisma/schema.prisma` actually carries the contract the frontend needs
 * — see brief section 8: "Database phải cung cấp được contract mà frontend
 * hiện yêu cầu."
 *
 * Not wired into `FixtureProvider`/`ContentProvider` in this task (brief
 * item 18 excludes the CMS/consumption wiring) — archipelago markers and
 * the dataset-level `note`/`source`/`geometry_source` fields stay static
 * config on the frontend side for now (see docs/DATABASE_SCHEMA.md,
 * "Scope exclusions"), so this returns the DB-backed subset only, ready for
 * a future `DatabaseProvider.getActivityMap()` to merge with that static
 * config into the exact wire shape.
 */
export const activityMapService = {
  async getActiveMapData() {
    const period = await activityMapRepository.latestPeriod();
    const [provinces, overseas, statistics] = await Promise.all([
      activityMapRepository.listProvinces(),
      activityMapRepository.listOverseasOrganizations(),
      period ? activityMapRepository.listStatisticsForPeriod(period) : Promise.resolve([]),
    ]);

    const provinceRows = provinces.map((province) => {
      const aggregate = statistics.find((s) => s.provinceId === province.id && s.categoryId === null);
      const breakdown = statistics.filter((s) => s.provinceId === province.id && s.categoryId !== null);

      return {
        province_id: province.mapCode,
        province_name: province.name,
        slug: province.slug,
        lat: province.lat,
        lon: province.lon,
        activity_count: aggregate?.activityCount ?? null,
        article_count: aggregate?.articleCount ?? null,
        unit_count: aggregate?.organizationCount ?? null,
        student_count: aggregate?.participantCount ?? null,
        reported: aggregate?.reported ?? false,
        latest_article: aggregate?.latestArticle
          ? { title: aggregate.latestArticle.title, published_at: aggregate.latestArticle.publishedAt?.toISOString() ?? "" }
          : null,
        category_distribution: breakdown.length
          ? (Object.fromEntries(
              breakdown.map((b): [string, number] => [b.category?.slug ?? b.categoryId ?? "", b.activityCount ?? 0]),
            ) as Record<string, number>)
          : null,
        period: aggregate?.period ?? period ?? "",
        unit_url: `/don-vi/${province.slug}`,
      };
    });

    const updatedAt = statistics.reduce<Date | null>(
      (latest, s) => (!latest || s.updatedAt > latest ? s.updatedAt : latest),
      null,
    );

    return {
      period,
      // The whole dataset's own "when was this compiled" — the latest of
      // every `ActivityStatistic.updatedAt` for the active period, not a
      // per-province value (the source report doesn't break it down
      // further than this — see `ProvinceActivityProfile.updatedAt`'s own
      // doc comment in `src/domain/activity.ts`). Falls back to "now" only
      // when the period has no statistics rows at all yet.
      updatedAt: (updatedAt ?? new Date()).toISOString(),
      provinces: provinceRows,
      overseas: overseas.map((o) => ({ name: o.name, activity_count: o.activityCount })),
      summary: {
        total_activities: provinceRows.reduce((sum, p) => sum + (p.activity_count ?? 0), 0),
        total_articles: provinceRows.reduce((sum, p) => sum + (p.article_count ?? 0), 0),
        participating_students: provinceRows.reduce((sum, p) => sum + (p.student_count ?? 0), 0),
        provinces_total: provinceRows.length,
        provinces_reported: provinceRows.filter((p) => p.reported).length,
      },
    };
  },
};
