import { prisma } from "@/server/db/client";
import type { ArticleStatus, Prisma } from "@/generated/prisma/client";

/**
 * Pure data access for `Article` and its owned rows (`ArticleBlock`,
 * `ArticleRevision`, tag/topic joins) — no business rules here (status
 * transitions, block validation, revision-snapshotting all live in
 * `ArticleService`). See docs/BACKEND_ARCHITECTURE.md, "Repository/Service
 * layer" for why the split exists.
 */

export const articleWithRelations = {
  category: true,
  author: true,
  organization: true,
  province: true,
  coverMedia: true,
  ogMedia: true,
  createdBy: { select: { id: true, displayName: true } },
  updatedBy: { select: { id: true, displayName: true } },
  blocks: { orderBy: { order: "asc" } },
  topics: { include: { topic: true } },
  tags: { include: { tag: true } },
} satisfies Prisma.ArticleInclude;

export type ArticleWithRelations = Prisma.ArticleGetPayload<{ include: typeof articleWithRelations }>;

export interface ArticleAdminFilter {
  status?: ArticleStatus;
  /** Review Queue (editorial workflow task, brief section 6): needs both
   *  IN_REVIEW (awaiting Approve/Return) and APPROVED (awaiting Publish/
   *  Schedule) rows in one list — a single `status` value can't express
   *  that, so this is a separate, independent filter rather than widening
   *  `status` itself to an array (every existing caller only ever passes
   *  one status, and keeping that the common case simpler was worth the
   *  one extra field). */
  statusIn?: ArticleStatus[];
  createdById?: string;
  categoryId?: string;
  topicId?: string;
  tagId?: string;
  authorId?: string;
  organizationId?: string;
  provinceId?: string;
  /** Both ends of "khoảng thời gian" (brief section 2), filtered against
   *  `createdAt` — the one date every article has regardless of status,
   *  unlike `publishedAt`/`scheduledAt` which are null for most rows. */
  createdFrom?: Date;
  createdTo?: Date;
  /** Contributor's "Bị trả lại" tab: DRAFT rows with a returnNote are a
   *  meaningfully different thing to a Contributor than a DRAFT they
   *  haven't submitted yet, even though both share `status: "DRAFT"` — see
   *  `/admin/articles/page.tsx`'s tab definitions. */
  hasReturnNote?: boolean;
  search?: string;
  sortBy?: "updatedAt" | "createdAt" | "title";
  sortDir?: "asc" | "desc";
  skip?: number;
  take?: number;
}

async function buildAdminWhere(params: ArticleAdminFilter): Promise<Prisma.ArticleWhereInput> {
  const where: Prisma.ArticleWhereInput = {
    status: params.status,
    ...(params.statusIn ? { status: { in: params.statusIn } } : {}),
    createdById: params.createdById,
    categoryId: params.categoryId,
    authorId: params.authorId,
    organizationId: params.organizationId,
    provinceId: params.provinceId,
    topics: params.topicId ? { some: { topicId: params.topicId } } : undefined,
    tags: params.tagId ? { some: { tagId: params.tagId } } : undefined,
  };
  if (params.createdFrom || params.createdTo) {
    where.createdAt = { gte: params.createdFrom, lte: params.createdTo };
  }
  if (params.hasReturnNote !== undefined) {
    where.returnNote = params.hasReturnNote ? { not: null } : null;
  }
  if (params.search) {
    const blockMatchIds = await findArticleIdsByBlockText(params.search);
    where.OR = [
      { title: { contains: params.search, mode: "insensitive" } },
      { slug: { contains: params.search, mode: "insensitive" } },
      { excerpt: { contains: params.search, mode: "insensitive" } },
      { id: { in: blockMatchIds } },
    ];
  }
  return where;
}

function findArticleIdsByBlockText(search: string): Promise<string[]> {
  return prisma.$queryRaw<{ articleId: string }[]>`
    SELECT DISTINCT "articleId" FROM "ArticleBlock" WHERE data::text ILIKE ${`%${search}%`}
  `.then((rows) => rows.map((r) => r.articleId));
}

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

  /**
   * The admin `/admin/articles` listing — any status, with the full set of
   * CMS-brief filters (section 2: "Filter: trạng thái; chuyên mục; chủ đề;
   * tác giả; đơn vị; địa phương; khoảng thời gian") plus a `createdById`
   * scope (a Contributor only ever sees their own — enforced by the
   * caller, `articleService.listForAdmin`, not optional here). Distinct
   * from `listPublished*` below, which is the public-site-facing,
   * PUBLISHED-only read path.
   *
   * `search` matches title/slug/excerpt directly, and — "nội dung cơ bản
   * nếu architecture cho phép" — also article IDs found by a raw
   * `ArticleBlock.data::text ILIKE` scan (`findArticleIdsBySearch` below);
   * Prisma's JSON filtering on Postgres has no "search any text field
   * inside this JSON blob regardless of shape" operator, and the block
   * union has too many different text-bearing shapes (`runs[].text`,
   * `headers`/`rows`, plain `text`, ...) for a `path`-based filter to cover
   * them all, so a raw scan is the pragmatic middle ground — parameterized
   * via `$queryRaw`'s tagged template, never string-concatenated.
   */
  async listForAdmin(params: ArticleAdminFilter = {}) {
    const where = await buildAdminWhere(params);
    return prisma.article.findMany({
      where,
      orderBy: { [params.sortBy ?? "updatedAt"]: params.sortDir ?? "desc" },
      include: articleWithRelations,
      skip: params.skip,
      take: params.take,
    });
  },

  async countForAdmin(params: ArticleAdminFilter = {}) {
    const where = await buildAdminWhere(params);
    return prisma.article.count({ where });
  },

  /** Kept for the dashboard's per-status stat tiles (brief-1 section 11),
   *  which only ever need one status's count, not the full filter set. */
  countByStatus(status?: ArticleStatus, createdById?: string) {
    return prisma.article.count({ where: { status, createdById } });
  },

  /** Dashboard task, brief section 5: Manager's "bài xuất bản hôm nay" — a
   *  day boundary computed in Asia/Ho_Chi_Minh wall-clock time (UTC+7, no
   *  DST), the same fixed-offset convention `articles/actions.ts`'s
   *  `parseScheduledAtVietnamTime` already uses, so "today" means the same
   *  calendar day an editor sitting in Vietnam would expect regardless of
   *  what timezone this Node process itself happens to run in. */
  countPublishedToday() {
    const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
    const nowVn = new Date(Date.now() + VN_OFFSET_MS);
    const startOfTodayVn = Date.UTC(nowVn.getUTCFullYear(), nowVn.getUTCMonth(), nowVn.getUTCDate());
    const startUtc = new Date(startOfTodayVn - VN_OFFSET_MS);
    const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);
    return prisma.article.count({ where: { status: "PUBLISHED", publishedAt: { gte: startUtc, lt: endUtc } } });
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

  /** `/don-vi/[slug]`'s own local-news list — the counterpart to
   *  `listPublishedByProvince` above, added for the Production Data Policy
   *  task so that page can query by `organizationId` directly instead of
   *  scanning every published article client-side. */
  listPublishedByOrganization(organizationId: string) {
    return prisma.article.findMany({
      where: { status: "PUBLISHED", organizationId },
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

  /** Unchecked create/update (scalar FKs — `categoryId`, `authorId`, ... —
   *  settable directly) rather than the checked variant's nested
   *  `{ connect: { id } }` shape: `articleService` deals in a plain field
   *  DTO from CMS form input, and every one of those fields is a scalar
   *  foreign key, not a relation object to connect/disconnect. */
  create(data: Prisma.ArticleUncheckedCreateInput) {
    return prisma.article.create({ data, include: articleWithRelations });
  },

  update(id: string, data: Prisma.ArticleUncheckedUpdateInput) {
    return prisma.article.update({ where: { id }, data, include: articleWithRelations });
  },

  updateStatus(id: string, status: ArticleStatus, extra: Prisma.ArticleUncheckedUpdateInput = {}) {
    return prisma.article.update({ where: { id }, data: { status, ...extra } });
  },

  remove(id: string) {
    return prisma.article.delete({ where: { id } });
  },

  replaceBlocks(articleId: string, blocks: { type: Prisma.ArticleBlockCreateManyInput["type"]; order: number; data: Prisma.InputJsonValue }[]) {
    return prisma.$transaction([
      prisma.articleBlock.deleteMany({ where: { articleId } }),
      prisma.articleBlock.createMany({
        data: blocks.map((b) => ({ articleId, type: b.type, order: b.order, data: b.data })),
      }),
    ]);
  },

  replaceTopics(articleId: string, topicIds: string[]) {
    return prisma.$transaction([
      prisma.articleTopic.deleteMany({ where: { articleId } }),
      prisma.articleTopic.createMany({ data: topicIds.map((topicId) => ({ articleId, topicId })) }),
    ]);
  },

  replaceTags(articleId: string, tagIds: string[]) {
    return prisma.$transaction([
      prisma.articleTag.deleteMany({ where: { articleId } }),
      prisma.articleTag.createMany({ data: tagIds.map((tagId) => ({ articleId, tagId })) }),
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

  /** Brief section 13: "Hiển thị: version; người sửa; thời gian; trạng
   *  thái" — the article's current `status` isn't stored per-revision (a
   *  revision is a content snapshot, not a status snapshot; `snapshot.status`
   *  already answers "what was the status at the time this was taken" for
   *  whoever needs that), so the caller reads it off the live `Article` row
   *  once and reuses it for every revision in the list. */
  listRevisions(articleId: string) {
    return prisma.articleRevision.findMany({
      where: { articleId },
      orderBy: { version: "desc" },
      include: { changedBy: { select: { id: true, displayName: true } } },
    });
  },

  findRevision(articleId: string, version: number) {
    return prisma.articleRevision.findUnique({ where: { articleId_version: { articleId, version } } });
  },

  /** Slug uniqueness excluding the article being edited — a bare
   *  `findUnique({ where: { slug } })` would always "find" the article's
   *  own current slug and reject re-saving it unchanged. */
  findBySlugExcludingId(slug: string, excludeId: string) {
    return prisma.article.findFirst({ where: { slug, id: { not: excludeId } } });
  },

  createSlugHistory(articleId: string, slug: string) {
    return prisma.articleSlugHistory.create({ data: { articleId, slug } });
  },

  /** Looks up a slug this article used to have; the public `/tin-tuc/[slug]`
   *  route uses this to 301 an old bookmarked/indexed URL to the current
   *  one instead of 404ing (brief section 12). */
  findByOldSlug(slug: string) {
    return prisma.articleSlugHistory.findUnique({
      where: { slug },
      include: { article: { select: { slug: true } } },
    });
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
