import { prisma } from "@/server/db/client";

const placementsInclude = {
  sections: {
    orderBy: { order: "asc" as const },
    include: { placements: { orderBy: { order: "asc" as const } } },
  },
};

export const homepageRepository = {
  findActiveConfiguration() {
    return prisma.homepageConfiguration.findFirst({
      where: { isActive: true },
      include: placementsInclude,
    });
  },

  /**
   * "give me something reasonable" queries `HomepageService.resolveSection`
   * falls back to when a section has no enabled/currently-active
   * `HomepagePlacement` rows — see brief section 11: "phải giữ fallback tự
   * động nếu CMS chưa cấu hình". Scoped to this file (not full
   * Video/Platform/Gallery repositories) because "most recent N" is the
   * only query the homepage fallback path needs from those models; a real
   * admin surface for them would earn its own repository.
   */
  fallback: {
    heroArticle() {
      return prisma.article.findFirst({
        where: { status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
        include: { category: true, author: true, coverMedia: true },
      });
    },
    featuredArticles(limit: number) {
      return prisma.article.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
        take: limit,
        include: { category: true, coverMedia: true },
      });
    },
    storyRailArticles(limit: number) {
      return prisma.article.findMany({
        where: { status: "PUBLISHED", provinceId: { not: null } },
        orderBy: { publishedAt: "desc" },
        take: limit,
        include: { category: true, province: true },
      });
    },
    latestVideo() {
      return prisma.video.findFirst({ orderBy: { publishedAt: "desc" }, include: { category: true, media: true } });
    },
    platforms(limit: number) {
      return prisma.platform.findMany({ orderBy: { createdAt: "desc" }, take: limit });
    },
    /**
     * Filters by `endAt >= now`, not the stored `status` column — the
     * stored value is only corrected opportunistically when a single event
     * is read via `EventService.getBySlug` (see that file's comment), so a
     * homepage fallback query trusting it directly could keep surfacing an
     * event whose `endAt` has already passed. Brief section 9: "Không được
     * giả realtime."
     */
    upcomingEvents(limit: number) {
      return prisma.event.findMany({
        where: { status: { not: "CANCELLED" }, endAt: { gte: new Date() } },
        orderBy: { startAt: "asc" },
        take: limit,
        include: { organization: true, coverMedia: true },
      });
    },
    latestGallery() {
      return prisma.gallery.findFirst({
        orderBy: { createdAt: "desc" },
        include: { items: { orderBy: { order: "asc" }, include: { media: true } } },
      });
    },
    localNewsArticles(limit: number) {
      return prisma.article.findMany({
        where: { status: "PUBLISHED", organizationId: { not: null } },
        orderBy: { publishedAt: "desc" },
        take: limit,
        include: { organization: true, category: true },
      });
    },
  },
};
