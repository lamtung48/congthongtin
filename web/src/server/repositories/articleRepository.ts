import { prisma } from "@/server/db/client";
import type { ArticleStatus, Prisma } from "@/generated/prisma/client";

/**
 * Pure data access for `Article` and its owned rows (`ArticleBlock`,
 * `ArticleRevision`, tag/topic joins) — no business rules here (status
 * transitions, block validation, revision-snapshotting all live in
 * `ArticleService`). See docs/BACKEND_ARCHITECTURE.md, "Repository/Service
 * layer" for why the split exists.
 */

const articleWithRelations = {
  category: true,
  author: true,
  organization: true,
  province: true,
  coverMedia: true,
  ogMedia: true,
  blocks: { orderBy: { order: "asc" } },
  topics: { include: { topic: true } },
  tags: { include: { tag: true } },
} satisfies Prisma.ArticleInclude;

export type ArticleWithRelations = Prisma.ArticleGetPayload<{ include: typeof articleWithRelations }>;

export const articleRepository = {
  findBySlug(slug: string): Promise<ArticleWithRelations | null> {
    return prisma.article.findUnique({ where: { slug }, include: articleWithRelations });
  },

  findById(id: string): Promise<ArticleWithRelations | null> {
    return prisma.article.findUnique({ where: { id }, include: articleWithRelations });
  },

  listSlugs(): Promise<string[]> {
    return prisma.article.findMany({ select: { slug: true } }).then((rows) => rows.map((r) => r.slug));
  },

  listPublished(params: { skip?: number; take?: number } = {}) {
    return prisma.article.findMany({
      where: { status: "PUBLISHED", publishedAt: { not: null } },
      orderBy: { publishedAt: "desc" },
      include: articleWithRelations,
      skip: params.skip,
      take: params.take,
    });
  },

  listPublishedByCategory(categorySlug: string) {
    return prisma.article.findMany({
      where: { status: "PUBLISHED", category: { slug: categorySlug } },
      orderBy: { publishedAt: "desc" },
      include: articleWithRelations,
    });
  },

  listPublishedByTopic(topicSlug: string) {
    return prisma.article.findMany({
      where: { status: "PUBLISHED", topics: { some: { topic: { slug: topicSlug } } } },
      orderBy: { publishedAt: "desc" },
      include: articleWithRelations,
    });
  },

  listPublishedByProvince(provinceId: string) {
    return prisma.article.findMany({
      where: { status: "PUBLISHED", provinceId },
      orderBy: { publishedAt: "desc" },
      include: articleWithRelations,
    });
  },

  /** Rows scheduled to go live — a worker/cron flips these to PUBLISHED once
   *  `scheduledAt` has passed. No scheduler is wired up in this task (see
   *  brief item 18's exclusions); this exists so that job has a query to
   *  call on day one. */
  listDuePublication(now: Date) {
    return prisma.article.findMany({
      where: { status: "SCHEDULED", scheduledAt: { lte: now } },
    });
  },

  create(data: Prisma.ArticleCreateInput) {
    return prisma.article.create({ data, include: articleWithRelations });
  },

  update(id: string, data: Prisma.ArticleUpdateInput) {
    return prisma.article.update({ where: { id }, data, include: articleWithRelations });
  },

  updateStatus(id: string, status: ArticleStatus, extra: Prisma.ArticleUpdateInput = {}) {
    return prisma.article.update({ where: { id }, data: { status, ...extra } });
  },

  replaceBlocks(articleId: string, blocks: { type: Prisma.ArticleBlockCreateManyInput["type"]; order: number; data: Prisma.InputJsonValue }[]) {
    return prisma.$transaction([
      prisma.articleBlock.deleteMany({ where: { articleId } }),
      prisma.articleBlock.createMany({
        data: blocks.map((b) => ({ articleId, type: b.type, order: b.order, data: b.data })),
      }),
    ]);
  },

  nextRevisionVersion(articleId: string): Promise<number> {
    return prisma.articleRevision
      .aggregate({ where: { articleId }, _max: { version: true } })
      .then((r) => (r._max.version ?? 0) + 1);
  },

  createRevision(data: Prisma.ArticleRevisionCreateInput) {
    return prisma.articleRevision.create({ data });
  },

  findAdjacent(publishedAt: Date, excludeId: string) {
    return Promise.all([
      prisma.article.findFirst({
        where: { status: "PUBLISHED", publishedAt: { lt: publishedAt }, id: { not: excludeId } },
        orderBy: { publishedAt: "desc" },
      }),
      prisma.article.findFirst({
        where: { status: "PUBLISHED", publishedAt: { gt: publishedAt }, id: { not: excludeId } },
        orderBy: { publishedAt: "asc" },
      }),
    ]);
  },
};
