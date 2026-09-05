import { prisma } from "@/server/db/client";

/**
 * Read access for the Activity Map's two subjects — `Province` (domestic,
 * with full `ActivityStatistic` history) and `OverseasOrganization` (the
 * globe panel, a single running total per country — see that model's
 * comment in schema.prisma for why the two aren't symmetric).
 */
export const activityMapRepository = {
  listProvinces() {
    return prisma.province.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } });
  },

  findProvinceBySlug(slug: string) {
    return prisma.province.findUnique({ where: { slug } });
  },

  /** Every `ActivityStatistic` row for one period — `categoryId: null` rows
   *  are each province's aggregate; the rest are its category breakdown.
   *  One query for the whole map render, not one per province. */
  listStatisticsForPeriod(period: string) {
    return prisma.activityStatistic.findMany({
      where: { period },
      include: { category: true, latestArticle: { select: { title: true, publishedAt: true } } },
    });
  },

  latestPeriod(): Promise<string | null> {
    return prisma.activityStatistic
      .findFirst({ orderBy: { updatedAt: "desc" }, select: { period: true } })
      .then((r) => r?.period ?? null);
  },

  listOverseasOrganizations() {
    return prisma.overseasOrganization.findMany({ orderBy: { activityCount: "desc" } });
  },

  /**
   * `@@unique([provinceId, categoryId, period])` cannot be trusted to block
   * duplicate *aggregate* rows on its own: Postgres treats every NULL in a
   * unique index as distinct from every other NULL, so two aggregate rows
   * (`categoryId: null`) for the same province+period would NOT violate the
   * DB constraint. Prisma's generated compound-key `upsert` also can't
   * target a NULL component of that key directly. So the aggregate case
   * (`categoryId: null`) is upserted by an explicit `findFirst` lookup
   * instead of the compound-key shortcut, which is only safe (and used) for
   * an actual, non-null category row. See docs/DATABASE_SCHEMA.md,
   * "ACTIVITY-STAT SHAPE" for this same caveat.
   */
  async upsertStatistic(input: {
    provinceId: string;
    categoryId: string | null;
    period: string;
    activityCount: number | null;
    articleCount: number | null;
    organizationCount: number | null;
    participantCount: number | null;
    reported: boolean;
  }) {
    if (input.categoryId === null) {
      const existing = await prisma.activityStatistic.findFirst({
        where: { provinceId: input.provinceId, categoryId: null, period: input.period },
      });
      return existing
        ? prisma.activityStatistic.update({ where: { id: existing.id }, data: input })
        : prisma.activityStatistic.create({ data: input });
    }
    return prisma.activityStatistic.upsert({
      where: {
        provinceId_categoryId_period: {
          provinceId: input.provinceId,
          categoryId: input.categoryId,
          period: input.period,
        },
      },
      create: input,
      update: input,
    });
  },
};
