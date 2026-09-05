import { prisma } from "@/server/db/client";
import { articleWithRelations } from "@/server/repositories/articleRepository";

const eventWithRelationsInclude = {
  province: true,
  organization: true,
  coverMedia: true,
} as const;

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
        include: articleWithRelations,
      });
    },
    featuredArticles(limit: number) {
      return prisma.article.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
        take: limit,
        include: articleWithRelations,
      });
    },
    storyRailArticles(limit: number) {
      return prisma.article.findMany({
        where: { status: "PUBLISHED", provinceId: { not: null } },
        orderBy: { publishedAt: "desc" },
        take: limit,
        include: articleWithRelations,
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
        include: articleWithRelations,
      });
    },
  },

  /**
   * One lookup per `HomepageContentType` a `HomepagePlacement.contentId`
   * can point at — `HomepageService.resolveHomepage()`'s own join for the
   * "CMS has actually pinned something" path, the counterpart to `fallback`
   * above. `ARTICLE` is deliberately not resolved here: it goes through
   * `articleRepository.findById` instead (see the service), since that
   * already returns the exact `ArticleWithRelations` shape this app has
   * exactly one query for.
   */
  resolvers: {
    video(id: string) {
      return prisma.video.findUnique({ where: { id }, include: { category: true, media: true } });
    },
    event(id: string) {
      return prisma.event.findUnique({ where: { id }, include: eventWithRelationsInclude });
    },
    platform(id: string) {
      return prisma.platform.findUnique({ where: { id } });
    },
    gallery(id: string) {
      return prisma.gallery.findUnique({ where: { id }, include: { items: { orderBy: { order: "asc" }, include: { media: true } } } });
    },
  },
};
