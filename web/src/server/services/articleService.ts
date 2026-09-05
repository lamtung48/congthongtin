import { revalidatePath } from "next/cache";
import { articleRepository, type ArticleWithRelations, type ArticleAdminFilter } from "@/server/repositories/articleRepository";
import { authorProfileRepository } from "@/server/repositories/authorProfileRepository";
import { mediaRepository } from "@/server/repositories/mediaRepository";
import { auditLogRepository } from "@/server/repositories/auditLogRepository";
import { articleNoteRepository } from "@/server/repositories/articleNoteRepository";
import { notificationService } from "@/server/services/notificationService";
import { parseArticleBlockData, collectMediaIdsFromBlocks, type ArticleBlockType } from "@/server/validation/articleBlocks";
import { hasPermission } from "@/server/auth/permissions";
import type { SessionUser } from "@/server/auth/session";
import type { Prisma } from "@/generated/prisma/client";
import type { ArticleStatus } from "@/generated/prisma/client";

/**
 * Business rules around `Article` that the route layer should never
 * reimplement itself: which status transitions are legal, who's allowed to
 * make each one (the 3-tier workflow, enforced here — not just at the
 * route/UI layer, per "Mọi kiểm tra quyền phải được thực hiện phía
 * server"), that every block write is validated per-type first, and that
 * every production edit leaves both a revision snapshot and an audit log
 * entry. `ArticleRepository` does no validation and enforces no rules — see
 * docs/BACKEND_ARCHITECTURE.md, "Repository/Service layer".
 */

export interface ArticleBlockInput {
  type: ArticleBlockType;
  order: number;
  data: unknown;
}

/** Every editable, non-workflow Article field a CMS form can submit — a
 *  plain field DTO, not `Prisma.Article(Unchecked)(Create|Update)Input`
 *  directly, so this file (and every Server Action calling it) never has to
 *  know or care whether Prisma models a given field as a scalar FK or a
 *  nested relation object. `topicIds`/`tagIds` replace the full set when
 *  present (matching `replaceBlocks`'s "whole list, not a diff" contract) —
 *  omit them to leave the current set untouched (relevant for `autosaveDraft`,
 *  which never touches taxonomy). */
export interface ArticleFieldsInput {
  slug?: string;
  title?: string;
  subtitle?: string | null;
  excerpt?: string | null;
  categoryId?: string;
  authorId?: string | null;
  organizationId?: string | null;
  provinceId?: string | null;
  coverMediaId?: string | null;
  ogMediaId?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  canonicalUrl?: string | null;
  topicIds?: string[];
  tagIds?: string[];
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

function canViewArticle(actor: SessionUser, article: Pick<ArticleWithRelations, "createdById">): boolean {
  if (hasPermission(actor.role, "article.edit.any")) return true;
  return hasPermission(actor.role, "article.edit.own") && article.createdById === actor.id;
}

/**
 * Brief: Contributor may edit only their own article, and only while it's
 * still a DRAFT — "Nếu bài đã gửi duyệt: Cộng tác viên không được tự ý sửa
 * nếu workflow đang khóa bài, trừ khi bài được trả lại" (a returned article
 * is DRAFT again, via `returnForRevision`, so this same check naturally
 * re-allows editing it — no separate "is this a returned draft" state to
 * track). Manager/Admin's `article.edit.any` is not status-gated: they're
 * the ones performing the review-workflow edits (approve/return/publish/...)
 * that DO change status on a non-DRAFT article, and touching content while
 * doing so (e.g. a Manager fixing a typo before publishing) is expected.
 */
function assertCanEdit(actor: SessionUser, article: Pick<ArticleWithRelations, "createdById" | "status">) {
  if (hasPermission(actor.role, "article.edit.any")) return;
  if (hasPermission(actor.role, "article.edit.own") && article.createdById === actor.id) {
    if (article.status !== "DRAFT") {
      throw new Error("Bài đã gửi duyệt — không thể chỉnh sửa cho đến khi được trả lại.");
    }
    return;
  }
  throw new Error("Not authorized to edit this article.");
}

function assertHasPermission(actor: SessionUser, permission: Parameters<typeof hasPermission>[1]) {
  if (!hasPermission(actor.role, permission)) {
    throw new Error(`Role ${actor.role} lacks permission "${permission}".`);
  }
}

/** Brief section 14: "Không publish khi thiếu title/category/article
 *  body/các field bắt buộc khác" — checked server-side, on the live
 *  `Article` row (not just whatever the last save's input happened to be),
 *  so a publish attempt can never slip through with stale in-memory state. */
function assertPublishReady(article: ArticleWithRelations) {
  const problems: string[] = [];
  if (!article.title.trim()) problems.push("thiếu tiêu đề");
  if (!article.categoryId) problems.push("thiếu chuyên mục");
  if (article.blocks.length === 0) problems.push("thiếu nội dung bài viết");
  if (problems.length > 0) {
    throw new Error(`Không thể xuất bản: ${problems.join(", ")}.`);
  }
}

/** Brief: "Cộng tác viên chỉ được chọn các dữ liệu mà permission policy cho
 *  phép" — applied here to the one field that's genuinely sensitive
 *  (claiming a byline): a Contributor may only set `authorId` to their own
 *  linked `AuthorProfile` (or leave it unset), never someone else's.
 *  Manager/Admin (`article.edit.any`) may set any author. Category/topic/
 *  tag/organization/province carry no such restriction — nothing in the
 *  brief treats picking a real taxonomy value as a privileged action, and
 *  restricting them would just make the Contributor form less usable for no
 *  security benefit. */
async function assertAuthorAllowed(actor: SessionUser, authorId: string | null | undefined) {
  if (!authorId) return;
  if (hasPermission(actor.role, "article.edit.any")) return;
  const own = await authorProfileRepository.findByUserId(actor.id);
  if (!own || own.id !== authorId) {
    throw new Error("Bạn chỉ được chọn tác giả là chính mình.");
  }
}

function validateBlocks(blocks: ArticleBlockInput[]) {
  return blocks.map((b) => ({ ...b, data: parseArticleBlockData(b.type, b.data) }));
}

/**
 * Keeps `MediaUsage` (usageType `ARTICLE_BLOCK`) in lockstep with whatever
 * media the article's blocks actually reference — called right after every
 * `replaceBlocks`, mirroring its own "whole list, not a diff" contract.
 * This is what lets `mediaService.remove()` correctly refuse to delete an
 * image that's inline in an article body, not just one set as the cover
 * (Google Drive media task, brief section 7).
 */
function syncBlockMediaUsage(articleId: string, blocks: ArticleBlockInput[]) {
  return mediaRepository.replaceArticleBlockUsages(articleId, collectMediaIdsFromBlocks(blocks));
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

/** Applies `fields` to a `Prisma.ArticleUncheckedUpdateInput`/
 *  `UncheckedCreateInput`-compatible object — shared by `create`, `update`,
 *  and `autosaveDraft` so the field list is defined exactly once. */
function fieldsToData(fields: ArticleFieldsInput) {
  const data: Record<string, unknown> = {};
  if (fields.slug !== undefined) data.slug = fields.slug;
  if (fields.title !== undefined) data.title = fields.title;
  if (fields.subtitle !== undefined) data.subtitle = fields.subtitle;
  if (fields.excerpt !== undefined) data.excerpt = fields.excerpt;
  if (fields.categoryId !== undefined) data.categoryId = fields.categoryId;
  if (fields.authorId !== undefined) data.authorId = fields.authorId;
  if (fields.organizationId !== undefined) data.organizationId = fields.organizationId;
  if (fields.provinceId !== undefined) data.provinceId = fields.provinceId;
  if (fields.coverMediaId !== undefined) data.coverMediaId = fields.coverMediaId;
  if (fields.ogMediaId !== undefined) data.ogMediaId = fields.ogMediaId;
  if (fields.seoTitle !== undefined) data.seoTitle = fields.seoTitle;
  if (fields.seoDescription !== undefined) data.seoDescription = fields.seoDescription;
  if (fields.canonicalUrl !== undefined) data.canonicalUrl = fields.canonicalUrl;
  return data;
}

/**
 * Brief section 12: slug uniqueness (throws a clear message instead of
 * surfacing Postgres's raw unique-constraint error), and — "Nếu bài đã
 * public và slug thay đổi: thiết kế redirect history" — snapshots the old
 * slug into `ArticleSlugHistory` whenever the article being renamed has
 * ever gone live (`publishedAt` set), so the public site can 301 an old
 * indexed/bookmarked URL instead of 404ing. A DRAFT that never published
 * has no public URL anyone could have linked to, so renaming it needs no
 * history entry.
 */
async function handleSlugChange(article: Pick<ArticleWithRelations, "id" | "slug" | "publishedAt">, newSlug: string | undefined) {
  if (newSlug === undefined || newSlug === article.slug) return;
  const clash = await articleRepository.findBySlugExcludingId(newSlug, article.id);
  if (clash) {
    throw new Error(`Slug "${newSlug}" đã được dùng bởi bài viết khác.`);
  }
  if (article.publishedAt) {
    await articleRepository.createSlugHistory(article.id, article.slug);
  }
}

/**
 * Production Data Policy task, brief section 6: "CMS publish/update phải
 * invalidate trang phù hợp." A single `revalidatePath("/", "layout")`
 * purges every cached page under the public `(site)` root layout — home,
 * every listing, every article detail page, locality/unit pages, all of
 * it — in one call, per Next.js's own documented "Revalidating all data"
 * pattern, rather than maintaining a hand-built list of every category/
 * topic/province/organization path a single article touches (fragile: miss
 * one and that page silently serves stale content until the 60s ISR
 * ceiling in `(site)/layout.tsx` catches up). `/sitemap.xml` is a metadata
 * route file, not a page under that layout, so it needs its own call.
 * Called only from workflow methods that can actually change what's
 * publicly visible — never from `create`/`submitForReview`/`approve`/
 * `returnForRevision`/`autosaveDraft`, none of which can touch a currently-
 * PUBLISHED article's public page.
 */
function revalidatePublicSite() {
  revalidatePath("/", "layout");
  revalidatePath("/sitemap.xml");
}

export const articleService = {
  getBySlug: articleRepository.findBySlug,
  getById: articleRepository.findById,
  listPublished: articleRepository.listPublished,
  listPublishedByCategory: articleRepository.listPublishedByCategory,
  listPublishedByTopic: articleRepository.listPublishedByTopic,
  listPublishedByProvince: articleRepository.listPublishedByProvince,
  listSlugs: articleRepository.listSlugs,
  countByStatus: articleRepository.countByStatus,
  countPublishedToday: articleRepository.countPublishedToday,
  canView: canViewArticle,
  canEdit(actor: SessionUser, article: Pick<ArticleWithRelations, "createdById" | "status">): boolean {
    try {
      assertCanEdit(actor, article);
      return true;
    } catch {
      return false;
    }
  },

  /** Brief section 2's admin listing — every filter, scoped server-side (not
   *  by trusting the caller): a CONTRIBUTOR's `createdById` is forced to
   *  their own id regardless of what the caller passed, so a Server Action
   *  that forgot to scope it can never leak another Contributor's drafts. */
  listForAdmin(actor: SessionUser, params: ArticleAdminFilter = {}) {
    const createdById = actor.role === "CONTRIBUTOR" ? actor.id : params.createdById;
    return articleRepository.listForAdmin({ ...params, createdById });
  },

  countForAdmin(actor: SessionUser, params: ArticleAdminFilter = {}) {
    const createdById = actor.role === "CONTRIBUTOR" ? actor.id : params.createdById;
    return articleRepository.countForAdmin({ ...params, createdById });
  },

  async getAdjacent(article: ArticleWithRelations) {
    if (!article.publishedAt) return { previous: null, next: null };
    const [previous, next] = await articleRepository.findAdjacent(article.publishedAt, article.id);
    return { previous, next };
  },

  async create(actor: SessionUser, input: { fields: ArticleFieldsInput & { slug: string; title: string; categoryId: string }; blocks?: ArticleBlockInput[] }) {
    assertHasPermission(actor, "article.create");
    await assertAuthorAllowed(actor, input.fields.authorId);
    const article = await articleRepository.create({
      ...fieldsToData(input.fields),
      slug: input.fields.slug,
      title: input.fields.title,
      categoryId: input.fields.categoryId,
      createdById: actor.id,
    } as Prisma.ArticleUncheckedCreateInput);
    if (input.blocks) {
      await articleRepository.replaceBlocks(article.id, validateBlocks(input.blocks));
      await syncBlockMediaUsage(article.id, input.blocks);
    }
    if (input.fields.topicIds) await articleRepository.replaceTopics(article.id, input.fields.topicIds);
    if (input.fields.tagIds) await articleRepository.replaceTags(article.id, input.fields.tagIds);
    await auditLogRepository.record({ actorId: actor.id, action: "CREATE_ARTICLE", entityType: "Article", entityId: article.id });
    const full = await articleRepository.findById(article.id);
    if (full) await snapshotRevision(full, actor.id, "Initial version");
    return full;
  },

  /**
   * A content edit (title, body, taxonomy, SEO fields, ...) — not a status
   * change, which goes through the named workflow methods below instead so
   * the two concerns (what changed vs. whether it's allowed to be visible)
   * stay separate. Creates a revision snapshot and an audit entry — the
   * "Lưu" action a human explicitly triggers, distinct from `autosaveDraft`.
   */
  async update(actor: SessionUser, article: ArticleWithRelations, input: { fields: ArticleFieldsInput; blocks?: ArticleBlockInput[]; note?: string }) {
    assertCanEdit(actor, article);
    await assertAuthorAllowed(actor, input.fields.authorId);
    await handleSlugChange(article, input.fields.slug);
    const updated = await articleRepository.update(article.id, {
      ...fieldsToData(input.fields),
      updatedById: actor.id,
    } as Prisma.ArticleUncheckedUpdateInput);
    if (input.blocks) {
      await articleRepository.replaceBlocks(article.id, validateBlocks(input.blocks));
      await syncBlockMediaUsage(article.id, input.blocks);
    }
    if (input.fields.topicIds) await articleRepository.replaceTopics(article.id, input.fields.topicIds);
    if (input.fields.tagIds) await articleRepository.replaceTags(article.id, input.fields.tagIds);
    const full = await articleRepository.findById(updated.id);
    if (full) await snapshotRevision(full, actor.id, input.note);
    await auditLogRepository.record({ actorId: actor.id, action: "UPDATE_ARTICLE", entityType: "Article", entityId: article.id });
    // `article` is the pre-update row — its `status` here reflects whether
    // this edit just changed already-public content (a Manager fixing a
    // typo on a live article), the case `revalidatePublicSite()` exists for.
    if (article.status === "PUBLISHED") revalidatePublicSite();
    return full;
  },

  /**
   * Brief section 6: autosave for DRAFT only — no revision snapshot, no
   * audit entry, no taxonomy replace (autosave only ever carries the fields
   * the editor's plain inputs own; topic/tag pickers save immediately via
   * `update` instead, so this never needs to touch either join table). A
   * background timer calling this on every keystroke-settling pause would
   * otherwise flood `AuditLog`/`ArticleRevision` with noise neither is meant
   * to hold — see `docs/AUTHENTICATION.md`-style reasoning applied to
   * content instead of auth.
   */
  async autosaveDraft(actor: SessionUser, article: ArticleWithRelations, input: { fields: ArticleFieldsInput; blocks?: ArticleBlockInput[] }) {
    assertCanEdit(actor, article);
    if (article.status !== "DRAFT") {
      throw new Error("Chỉ có thể tự động lưu khi bài đang ở trạng thái Nháp.");
    }
    await assertAuthorAllowed(actor, input.fields.authorId);
    await handleSlugChange(article, input.fields.slug);
    const updated = await articleRepository.update(article.id, {
      ...fieldsToData(input.fields),
      updatedById: actor.id,
    } as Prisma.ArticleUncheckedUpdateInput);
    if (input.blocks) {
      await articleRepository.replaceBlocks(article.id, validateBlocks(input.blocks));
      await syncBlockMediaUsage(article.id, input.blocks);
    }
    return articleRepository.findById(updated.id);
  },

  /** DRAFT (or a returned-for-revision article, also DRAFT) -> IN_REVIEW.
   *  The one action a Contributor can take to hand an article to a Manager;
   *  also clears any previous `returnNote` since it's being resubmitted. */
  async submitForReview(actor: SessionUser, article: ArticleWithRelations) {
    assertHasPermission(actor, "article.submit");
    assertCanEdit(actor, article);
    assertTransitionAllowed(article.status, "IN_REVIEW");
    const updated = await articleRepository.update(article.id, { status: "IN_REVIEW", returnNote: null });
    await auditLogRepository.record({ actorId: actor.id, action: "SUBMIT_REVIEW", entityType: "Article", entityId: article.id });
    // Brief section 9: "Cộng tác viên → gửi duyệt: notify Manager/Admin
    // phù hợp" — every active Manager and Admin, since no single reviewer
    // is assigned per article.
    await notificationService.notifyRoles(
      ["ADMIN", "MANAGER"],
      "ARTICLE_SUBMITTED",
      "Article",
      article.id,
      `${actor.displayName} vừa gửi duyệt bài viết "${article.title}".`,
    );
    return updated;
  },

  /** IN_REVIEW -> APPROVED. Manager/Admin only. */
  async approve(actor: SessionUser, article: ArticleWithRelations) {
    assertHasPermission(actor, "article.approve");
    assertTransitionAllowed(article.status, "APPROVED");
    const updated = await articleRepository.update(article.id, { status: "APPROVED" });
    await auditLogRepository.record({ actorId: actor.id, action: "APPROVE_ARTICLE", entityType: "Article", entityId: article.id });
    // Brief section 9: "Quản trị viên/Admin → duyệt/publish: notify Contributor."
    await notificationService.notifyUser(
      article.createdById,
      "ARTICLE_APPROVED",
      "Article",
      article.id,
      `Bài viết "${article.title}" của bạn đã được duyệt.`,
    );
    return updated;
  },

  /** IN_REVIEW or APPROVED -> DRAFT, with a mandatory note the Contributor
   *  sees on their own edit view (`Article.returnNote`). Manager/Admin
   *  only. */
  async returnForRevision(actor: SessionUser, article: ArticleWithRelations, note: string) {
    assertHasPermission(actor, "article.return");
    if (!note.trim()) {
      throw new Error("Vui lòng nhập ghi chú khi trả bài.");
    }
    assertTransitionAllowed(article.status, "DRAFT");
    const updated = await articleRepository.update(article.id, { status: "DRAFT", returnNote: note });
    await auditLogRepository.record({ actorId: actor.id, action: "RETURN_ARTICLE", entityType: "Article", entityId: article.id, metadata: { note } });
    // Brief section 9: "Quản trị viên → trả bài: notify Contributor."
    await notificationService.notifyUser(
      article.createdById,
      "ARTICLE_RETURNED",
      "Article",
      article.id,
      `Bài viết "${article.title}" đã bị trả lại: ${note}`,
    );
    return updated;
  },

  /** APPROVED or SCHEDULED -> PUBLISHED. Manager/Admin only. Refuses an
   *  article missing required fields (brief section 14). */
  async publish(actor: SessionUser, article: ArticleWithRelations) {
    assertHasPermission(actor, "article.publish");
    assertPublishReady(article);
    assertTransitionAllowed(article.status, "PUBLISHED");
    const updated = await articleRepository.updateStatus(article.id, "PUBLISHED", article.publishedAt ? {} : { publishedAt: new Date() });
    await auditLogRepository.record({ actorId: actor.id, action: "PUBLISH_ARTICLE", entityType: "Article", entityId: article.id });
    // Brief section 9: "Quản trị viên/Admin → duyệt/publish: notify Contributor."
    await notificationService.notifyUser(
      article.createdById,
      "ARTICLE_PUBLISHED",
      "Article",
      article.id,
      `Bài viết "${article.title}" của bạn đã được xuất bản.`,
    );
    revalidatePublicSite();
    return updated;
  },

  /** APPROVED -> SCHEDULED. Manager/Admin only. `scheduledAt` is always a
   *  UTC instant by the time it reaches here (brief section 11: "Xử lý
   *  timezone rõ ràng") — see `articles/actions.ts`'s `parseScheduledAt`
   *  for where a `datetime-local` form value is interpreted as
   *  Asia/Ho_Chi_Minh wall-clock time and converted, so this method never
   *  has to guess what timezone a bare `Date` means. */
  async schedule(actor: SessionUser, article: ArticleWithRelations, scheduledAt: Date) {
    assertHasPermission(actor, "article.schedule");
    assertPublishReady(article);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
      throw new Error("Thời gian hẹn giờ không hợp lệ — phải là một thời điểm trong tương lai.");
    }
    assertTransitionAllowed(article.status, "SCHEDULED");
    const updated = await articleRepository.updateStatus(article.id, "SCHEDULED", { scheduledAt });
    await auditLogRepository.record({ actorId: actor.id, action: "SCHEDULE_ARTICLE", entityType: "Article", entityId: article.id, metadata: { scheduledAt: scheduledAt.toISOString() } });
    // Not one of the brief's 3 named triggers by name, but grouped with
    // "duyệt/publish" in spirit — a Contributor should know their article
    // now has a firm publish date, not just silence until it appears live.
    await notificationService.notifyUser(
      article.createdById,
      "ARTICLE_PUBLISHED",
      "Article",
      article.id,
      `Bài viết "${article.title}" của bạn đã được hẹn giờ xuất bản.`,
    );
    return updated;
  },

  /** PUBLISHED -> ARCHIVED ("gỡ bài"). Manager/Admin only — Contributor's
   *  permission set excludes `article.unpublish` entirely, so this always
   *  rejects a Contributor regardless of ownership. */
  async unpublish(actor: SessionUser, article: ArticleWithRelations) {
    assertHasPermission(actor, "article.unpublish");
    if (article.status !== "PUBLISHED") {
      throw new Error('Chỉ có thể gỡ bài đang ở trạng thái "Đã xuất bản" — dùng chức năng Lưu trữ cho các trạng thái khác.');
    }
    assertTransitionAllowed(article.status, "ARCHIVED");
    const updated = await articleRepository.updateStatus(article.id, "ARCHIVED");
    await auditLogRepository.record({ actorId: actor.id, action: "UNPUBLISH_ARTICLE", entityType: "Article", entityId: article.id });
    revalidatePublicSite();
    return updated;
  },

  /**
   * Any non-PUBLISHED status -> ARCHIVED ("lưu trữ") — shelving a stale
   * DRAFT/IN_REVIEW/APPROVED/SCHEDULED article without ever having gone
   * live. Kept as a separate method (and a separate `ARCHIVE_ARTICLE` audit
   * action) from `unpublish` above even though both land on the same
   * status, because they're different real-world actions with different UI
   * entry points — "gỡ một bài đang sống" and "dọn một bản nháp cũ" are not
   * the same event to an auditor reading the log later.
   */
  async archive(actor: SessionUser, article: ArticleWithRelations) {
    assertHasPermission(actor, "article.unpublish");
    if (article.status === "PUBLISHED") {
      throw new Error("Bài đang xuất bản — dùng chức năng Gỡ bài thay vì Lưu trữ.");
    }
    assertTransitionAllowed(article.status, "ARCHIVED");
    const updated = await articleRepository.updateStatus(article.id, "ARCHIVED");
    await auditLogRepository.record({ actorId: actor.id, action: "ARCHIVE_ARTICLE", entityType: "Article", entityId: article.id });
    return updated;
  },

  /** ARCHIVED -> DRAFT — the inverse of `archive`/`unpublish`. Same
   *  permission as archiving/unpublishing: whoever can put an article away
   *  can also bring it back out. */
  async restoreFromArchive(actor: SessionUser, article: ArticleWithRelations) {
    assertHasPermission(actor, "article.unpublish");
    assertTransitionAllowed(article.status, "DRAFT");
    const updated = await articleRepository.updateStatus(article.id, "DRAFT");
    await auditLogRepository.record({ actorId: actor.id, action: "RESTORE_ARTICLE", entityType: "Article", entityId: article.id });
    return updated;
  },

  /** Brief section 13: "ADMIN có thể restore... MANAGER có thể xem/restore
   *  nếu policy cho phép" — the policy here is `article.edit.any`
   *  (Manager and Admin, never Contributor), the same permission that
   *  already governs editing any article's content regardless of
   *  ownership; restoring a revision is exactly that (a content edit),
   *  just sourced from history instead of a form submission. Restores the
   *  editorial content (title/subtitle/excerpt/SEO fields/blocks) captured
   *  in the snapshot — deliberately NOT its category/author/organization/
   *  province/cover, slug, or workflow status: those are relations and
   *  workflow state, not "what was written", and blindly reconnecting a
   *  relation captured possibly months ago risks pointing at a taxonomy
   *  row that has since been renamed or removed. */
  async restoreRevision(actor: SessionUser, article: ArticleWithRelations, version: number) {
    assertHasPermission(actor, "article.edit.any");
    const revision = await articleRepository.findRevision(article.id, version);
    if (!revision) {
      throw new Error(`Không tìm thấy phiên bản ${version}.`);
    }
    const snapshot = revision.snapshot as unknown as ArticleWithRelations;
    const updated = await articleRepository.update(article.id, {
      title: snapshot.title,
      subtitle: snapshot.subtitle,
      excerpt: snapshot.excerpt,
      seoTitle: snapshot.seoTitle,
      seoDescription: snapshot.seoDescription,
      canonicalUrl: snapshot.canonicalUrl,
      updatedById: actor.id,
    });
    await articleRepository.replaceBlocks(
      article.id,
      snapshot.blocks.map((b) => ({ type: b.type, order: b.order, data: b.data as Prisma.InputJsonValue })),
    );
    await mediaRepository.replaceArticleBlockUsages(article.id, collectMediaIdsFromBlocks(snapshot.blocks));
    const full = await articleRepository.findById(updated.id);
    if (full) await snapshotRevision(full, actor.id, `Khôi phục từ phiên bản ${version}`);
    await auditLogRepository.record({ actorId: actor.id, action: "RESTORE_REVISION", entityType: "Article", entityId: article.id, metadata: { version } });
    // Same "was it already public" check as `update()` — restoring a past
    // revision's content onto a currently-PUBLISHED article changes what a
    // visitor sees right now, exactly like a normal content edit would.
    if (article.status === "PUBLISHED") revalidatePublicSite();
    return full;
  },

  async listRevisions(actor: SessionUser, article: ArticleWithRelations) {
    if (!canViewArticle(actor, article)) {
      throw new Error("Not authorized to view this article's revisions.");
    }
    return articleRepository.listRevisions(article.id);
  },

  /** Brief section 8: "Cho phép ghi chú nội bộ. Không public." Same
   *  visibility rule as the article itself (`canView`) — an Admin/Manager
   *  can note on anything, a Contributor only on their own article — rather
   *  than a fourth, note-specific permission tier the brief never asks for. */
  async listNotes(actor: SessionUser, article: ArticleWithRelations) {
    if (!canViewArticle(actor, article)) {
      throw new Error("Not authorized to view this article's notes.");
    }
    return articleNoteRepository.listForArticle(article.id);
  },

  async addNote(actor: SessionUser, article: ArticleWithRelations, body: string) {
    if (!canViewArticle(actor, article)) {
      throw new Error("Not authorized to note on this article.");
    }
    if (!body.trim()) {
      throw new Error("Ghi chú không được để trống.");
    }
    return articleNoteRepository.create(article.id, actor.id, body.trim());
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
    // Admin deleting a still-live PUBLISHED article outright (a Manager
    // can't reach this branch — they're refused above) — its public page
    // must 404 immediately, not linger cached until the ISR ceiling.
    if (article.status === "PUBLISHED") revalidatePublicSite();
  },
};
