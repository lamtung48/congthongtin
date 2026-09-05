import { articleRepository, type ArticleWithRelations } from "@/server/repositories/articleRepository";
import { auditLogRepository } from "@/server/repositories/auditLogRepository";
import { parseArticleBlockData, type ArticleBlockType } from "@/server/validation/articleBlocks";
import { hasPermission } from "@/server/auth/permissions";
import type { SessionUser } from "@/server/auth/session";
import type { ArticleStatus, Prisma } from "@/generated/prisma/client";

/**
 * Business rules around `Article` that the route layer should never
 * reimplement itself: which status transitions are legal, who's allowed to
 * make each one (brief section 9's 3-tier workflow, enforced here — not
 * just at the route/UI layer, per section 3: "Mọi action nhạy cảm phải xác
 * thực quyền tại server/service layer"), that every block write is
 * validated per-type first, and that every production edit leaves both a
 * revision snapshot and an audit log entry. `ArticleRepository` (below
 * this) does no validation and enforces no rules — see
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
 *  encodes). Not exported: only this file's named workflow methods below
 *  should consult it, so the rule has exactly one enforcement point. */
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

/** Brief: Contributor may edit only their own article; Manager/Admin may
 *  edit any. Checked here — the one place both `update()` and every named
 *  workflow method below funnel through — rather than duplicated at each
 *  call site. */
function assertCanEdit(actor: SessionUser, article: Pick<ArticleWithRelations, "createdById">) {
  if (hasPermission(actor.role, "article.edit.any")) return;
  if (hasPermission(actor.role, "article.edit.own") && article.createdById === actor.id) return;
  throw new Error("Not authorized to edit this article.");
}

function assertHasPermission(actor: SessionUser, permission: Parameters<typeof hasPermission>[1]) {
  if (!hasPermission(actor.role, permission)) {
    throw new Error(`Role ${actor.role} lacks permission "${permission}".`);
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
  getById: articleRepository.findById,
  listForAdmin: articleRepository.listForAdmin,
  countByStatus: articleRepository.countByStatus,
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

  async create(actor: SessionUser, input: {
    data: Omit<Prisma.ArticleCreateInput, "createdBy">;
    blocks: ArticleBlockInput[];
  }) {
    assertHasPermission(actor, "article.create");
    const validatedBlocks = validateBlocks(input.blocks);
    const article = await articleRepository.create({
      ...input.data,
      createdBy: { connect: { id: actor.id } },
    });
    await articleRepository.replaceBlocks(article.id, validatedBlocks);
    await auditLogRepository.record({
      actorId: actor.id,
      action: "CREATE_ARTICLE",
      entityType: "Article",
      entityId: article.id,
    });
    const full = await articleRepository.findById(article.id);
    if (full) await snapshotRevision(full, actor.id, "Initial version");
    return full;
  },

  /**
   * A content edit (title, body, SEO fields, ...) — not a status change,
   * which goes through the named workflow methods below instead so the two
   * concerns (what changed vs. whether it's allowed to be visible) stay
   * separate.
   */
  async update(actor: SessionUser, article: ArticleWithRelations, input: {
    data: Prisma.ArticleUpdateInput;
    blocks?: ArticleBlockInput[];
    note?: string;
  }) {
    assertCanEdit(actor, article);
    const updated = await articleRepository.update(article.id, {
      ...input.data,
      updatedBy: { connect: { id: actor.id } },
    });
    if (input.blocks) {
      await articleRepository.replaceBlocks(article.id, validateBlocks(input.blocks));
    }
    const full = await articleRepository.findById(updated.id);
    if (full) await snapshotRevision(full, actor.id, input.note);
    await auditLogRepository.record({ actorId: actor.id, action: "UPDATE_ARTICLE", entityType: "Article", entityId: article.id });
    return full;
  },

  /** DRAFT (or a returned-for-revision article, also DRAFT) -> IN_REVIEW.
   *  Brief section 9: the one action a Contributor can take to hand an
   *  article to a Manager; also clears any previous `returnNote` since it's
   *  being resubmitted. */
  async submitForReview(actor: SessionUser, article: ArticleWithRelations) {
    assertHasPermission(actor, "article.submit");
    assertCanEdit(actor, article);
    assertTransitionAllowed(article.status, "IN_REVIEW");
    const updated = await articleRepository.update(article.id, { status: "IN_REVIEW", returnNote: null });
    await auditLogRepository.record({ actorId: actor.id, action: "SUBMIT_REVIEW", entityType: "Article", entityId: article.id });
    return updated;
  },

  /** IN_REVIEW -> APPROVED. Manager/Admin only. */
  async approve(actor: SessionUser, article: ArticleWithRelations) {
    assertHasPermission(actor, "article.approve");
    assertTransitionAllowed(article.status, "APPROVED");
    const updated = await articleRepository.update(article.id, { status: "APPROVED" });
    await auditLogRepository.record({ actorId: actor.id, action: "APPROVE_ARTICLE", entityType: "Article", entityId: article.id });
    return updated;
  },

  /** IN_REVIEW or APPROVED -> DRAFT, with a note the Contributor sees on
   *  their own edit view (`Article.returnNote`). Manager/Admin only. */
  async returnForRevision(actor: SessionUser, article: ArticleWithRelations, note: string) {
    assertHasPermission(actor, "article.return");
    assertTransitionAllowed(article.status, "DRAFT");
    const updated = await articleRepository.update(article.id, { status: "DRAFT", returnNote: note });
    await auditLogRepository.record({ actorId: actor.id, action: "RETURN_ARTICLE", entityType: "Article", entityId: article.id, metadata: { note } });
    return updated;
  },

  /** APPROVED or SCHEDULED -> PUBLISHED. Manager/Admin only. */
  async publish(actor: SessionUser, article: ArticleWithRelations) {
    assertHasPermission(actor, "article.publish");
    assertTransitionAllowed(article.status, "PUBLISHED");
    const updated = await articleRepository.updateStatus(article.id, "PUBLISHED", article.publishedAt ? {} : { publishedAt: new Date() });
    await auditLogRepository.record({ actorId: actor.id, action: "PUBLISH_ARTICLE", entityType: "Article", entityId: article.id });
    return updated;
  },

  /** APPROVED -> SCHEDULED. Manager/Admin only. */
  async schedule(actor: SessionUser, article: ArticleWithRelations, scheduledAt: Date) {
    assertHasPermission(actor, "article.schedule");
    assertTransitionAllowed(article.status, "SCHEDULED");
    const updated = await articleRepository.updateStatus(article.id, "SCHEDULED", { scheduledAt });
    await auditLogRepository.record({ actorId: actor.id, action: "SCHEDULE_ARTICLE", entityType: "Article", entityId: article.id, metadata: { scheduledAt } });
    return updated;
  },

  /** PUBLISHED -> ARCHIVED ("gỡ bài"). Manager/Admin only — brief section
   *  9's Contributor list explicitly excludes this ("gỡ bài đã xuất bản
   *  nếu không được giao quyền"). */
  async unpublish(actor: SessionUser, article: ArticleWithRelations) {
    assertHasPermission(actor, "article.unpublish");
    assertTransitionAllowed(article.status, "ARCHIVED");
    const updated = await articleRepository.updateStatus(article.id, "ARCHIVED");
    await auditLogRepository.record({ actorId: actor.id, action: "UNPUBLISH_ARTICLE", entityType: "Article", entityId: article.id });
    return updated;
  },

  /** Brief section 2: Manager may delete "nếu policy cho phép" — the
   *  policy implemented here is that a Manager can delete anything short of
   *  a live PUBLISHED article (unpublish first), while Admin can delete
   *  regardless of status. */
  async remove(actor: SessionUser, article: ArticleWithRelations) {
    assertHasPermission(actor, "article.delete");
    if (actor.role === "MANAGER" && article.status === "PUBLISHED") {
      throw new Error("A Manager must unpublish an article before deleting it.");
    }
    await articleRepository.remove(article.id);
    await auditLogRepository.record({ actorId: actor.id, action: "DELETE", entityType: "Article", entityId: article.id });
  },
};
