import { articleRepository, type ArticleWithRelations } from "@/server/repositories/articleRepository";
import { auditLogRepository } from "@/server/repositories/auditLogRepository";
import { parseArticleBlockData, type ArticleBlockType } from "@/server/validation/articleBlocks";
import type { ArticleStatus, Prisma } from "@/generated/prisma/client";

/**
 * Business rules around `Article` that the route layer should never
 * reimplement itself: which status transitions are legal, that every block
 * write is validated per-type first, and that every production edit leaves
 * both a revision snapshot and an audit log entry. `ArticleRepository`
 * (below this) does no validation and enforces no rules — see
 * docs/BACKEND_ARCHITECTURE.md, "Repository/Service layer".
 */

export interface ArticleBlockInput {
  type: ArticleBlockType;
  order: number;
  data: unknown;
}

/** DRAFT and IN_REVIEW can move to most other states; PUBLISHED/ARCHIVED are
 *  terminal-ish (still reachable from each other for unpublish/republish,
 *  but never silently reachable from DRAFT without passing through review —
 *  see docs/DATABASE_SCHEMA.md, "ARTICLE STATUS" for the full table this
 *  encodes). Not exported: only `ArticleService.transitionStatus` should
 *  consult it, so the rule has exactly one enforcement point. */
const ALLOWED_TRANSITIONS: Record<ArticleStatus, ArticleStatus[]> = {
  DRAFT: ["IN_REVIEW", "ARCHIVED"],
  IN_REVIEW: ["DRAFT", "APPROVED", "ARCHIVED"],
  APPROVED: ["SCHEDULED", "PUBLISHED", "IN_REVIEW", "ARCHIVED"],
  SCHEDULED: ["PUBLISHED", "APPROVED", "ARCHIVED"],
  PUBLISHED: ["ARCHIVED"],
  ARCHIVED: ["DRAFT"],
};

function assertTransitionAllowed(from: ArticleStatus, to: ArticleStatus) {
  if (from === to) return;
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new Error(`Illegal Article status transition: ${from} -> ${to}`);
  }
}

function validateBlocks(blocks: ArticleBlockInput[]) {
  return blocks.map((b) => ({ ...b, data: parseArticleBlockData(b.type, b.data) }));
}

async function snapshotRevision(article: ArticleWithRelations, changedById: string | null, note?: string) {
  const version = await articleRepository.nextRevisionVersion(article.id);
  await articleRepository.createRevision({
    article: { connect: { id: article.id } },
    version,
    snapshot: article as unknown as Prisma.InputJsonValue,
    changedBy: changedById ? { connect: { id: changedById } } : undefined,
    note,
  });
  return version;
}

export const articleService = {
  getBySlug: articleRepository.findBySlug,
  listPublished: articleRepository.listPublished,
  listPublishedByCategory: articleRepository.listPublishedByCategory,
  listPublishedByTopic: articleRepository.listPublishedByTopic,
  listPublishedByProvince: articleRepository.listPublishedByProvince,
  listSlugs: articleRepository.listSlugs,

  async getAdjacent(article: ArticleWithRelations) {
    if (!article.publishedAt) return { previous: null, next: null };
    const [previous, next] = await articleRepository.findAdjacent(article.publishedAt, article.id);
    return { previous, next };
  },

  async create(input: {
    data: Prisma.ArticleCreateInput;
    blocks: ArticleBlockInput[];
    actorId: string | null;
  }) {
    const validatedBlocks = validateBlocks(input.blocks);
    const article = await articleRepository.create(input.data);
    await articleRepository.replaceBlocks(article.id, validatedBlocks);
    await auditLogRepository.record({
      actorId: input.actorId,
      action: "CREATE",
      entityType: "Article",
      entityId: article.id,
    });
    const full = await articleRepository.findById(article.id);
    if (full) await snapshotRevision(full, input.actorId, "Initial version");
    return full;
  },

  /**
   * A content edit (title, body, SEO fields, ...) — not a status change,
   * which goes through `transitionStatus` instead so the two concerns
   * (what changed vs. whether it's allowed to be visible) stay separate.
   */
  async update(articleId: string, input: {
    data: Prisma.ArticleUpdateInput;
    blocks?: ArticleBlockInput[];
    actorId: string | null;
    note?: string;
  }) {
    const updated = await articleRepository.update(articleId, {
      ...input.data,
      updatedBy: input.actorId ? { connect: { id: input.actorId } } : undefined,
    });
    if (input.blocks) {
      await articleRepository.replaceBlocks(articleId, validateBlocks(input.blocks));
    }
    const full = await articleRepository.findById(updated.id);
    if (full) await snapshotRevision(full, input.actorId, input.note);
    await auditLogRepository.record({
      actorId: input.actorId,
      action: "UPDATE",
      entityType: "Article",
      entityId: articleId,
    });
    return full;
  },

  async transitionStatus(article: ArticleWithRelations, to: ArticleStatus, actorId: string | null) {
    assertTransitionAllowed(article.status, to);
    const extra: Prisma.ArticleUpdateInput = {};
    if (to === "PUBLISHED" && !article.publishedAt) {
      extra.publishedAt = new Date();
    }
    const updated = await articleRepository.updateStatus(article.id, to, extra);

    const action = to === "PUBLISHED" ? "PUBLISH" : article.status === "PUBLISHED" && to === "ARCHIVED" ? "UNPUBLISH" : to === "APPROVED" ? "APPROVE" : "UPDATE";
    await auditLogRepository.record({
      actorId,
      action,
      entityType: "Article",
      entityId: article.id,
      metadata: { from: article.status, to },
    });
    return updated;
  },
};
