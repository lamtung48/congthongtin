import { taxonomyRepository } from "@/server/repositories/taxonomyRepository";
import { auditLogRepository } from "@/server/repositories/auditLogRepository";
import { hasPermission } from "@/server/auth/permissions";
import type { SessionUser } from "@/server/auth/session";

function assertCanManageTaxonomy(actor: SessionUser) {
  if (!hasPermission(actor.role, "taxonomy.manage")) {
    throw new Error(`Role ${actor.role} lacks permission "taxonomy.manage".`);
  }
}

/**
 * Vietnamese for "N bài viết, M video" — only the non-zero parts, so the
 * refusal message names exactly what is in the way instead of a wall of
 * zeroes.
 */
function describeCategoryUsage(counts: { articles: number; videos: number; sources: number; activityStatistics: number }): string {
  const parts = [
    counts.articles > 0 ? `${counts.articles} bài viết` : null,
    counts.videos > 0 ? `${counts.videos} video` : null,
    counts.sources > 0 ? `${counts.sources} nguồn thu thập` : null,
    counts.activityStatistics > 0 ? `${counts.activityStatistics} số liệu hoạt động` : null,
  ].filter(Boolean);
  return parts.join(", ");
}

export const taxonomyService = {
  listCategories: taxonomyRepository.listCategories,
  listTopics: taxonomyRepository.listTopics,
  listTags: taxonomyRepository.listTags,
  listCategoriesWithUsage: taxonomyRepository.listCategoriesWithUsage,
  listTopicsWithUsage: taxonomyRepository.listTopicsWithUsage,
  listTagsWithUsage: taxonomyRepository.listTagsWithUsage,

  async createCategory(actor: SessionUser, input: { slug: string; name: string; description?: string }) {
    assertCanManageTaxonomy(actor);
    const category = await taxonomyRepository.createCategory(input);
    await auditLogRepository.record({ actorId: actor.id, action: "CREATE", entityType: "Category", entityId: category.id });
    return category;
  },

  async createTopic(actor: SessionUser, input: { slug: string; name: string; description?: string }) {
    assertCanManageTaxonomy(actor);
    const topic = await taxonomyRepository.createTopic(input);
    await auditLogRepository.record({ actorId: actor.id, action: "CREATE", entityType: "Topic", entityId: topic.id });
    return topic;
  },

  async createTag(actor: SessionUser, input: { slug: string; name: string }) {
    assertCanManageTaxonomy(actor);
    const tag = await taxonomyRepository.createTag(input);
    await auditLogRepository.record({ actorId: actor.id, action: "CREATE", entityType: "Tag", entityId: tag.id });
    return tag;
  },

  /**
   * `Article.categoryId` and `Video.categoryId` are **required** columns, so
   * a category still in use cannot be deleted without either orphaning that
   * content or silently reassigning it — neither of which an editor pressing
   * "Xoá" is asking for. Refused here with the counts named, so the fix
   * ("move these 7 articles first") is obvious; the alternative is a raw
   * Postgres foreign-key error surfacing as "Không thể xoá".
   */
  async removeCategory(actor: SessionUser, id: string): Promise<void> {
    assertCanManageTaxonomy(actor);
    const category = await taxonomyRepository.findCategoryWithUsage(id);
    if (!category) throw new Error("Chuyên mục không tồn tại.");
    const inUse = describeCategoryUsage(category._count);
    if (inUse) {
      throw new Error(`Không thể xoá "${category.name}" vì đang được dùng bởi ${inUse}. Hãy chuyển sang chuyên mục khác trước.`);
    }
    await taxonomyRepository.deleteCategory(id);
    await auditLogRepository.record({
      actorId: actor.id,
      action: "DELETE",
      entityType: "Category",
      entityId: id,
      metadata: { slug: category.slug, name: category.name },
    });
  },

  /**
   * Unlike a category, a topic is attached through the `ArticleTopic` join
   * table with `onDelete: Cascade`, so deleting one detaches it from its
   * articles rather than destroying them — the articles themselves are
   * untouched and keep their category. Allowed even when in use (the admin
   * UI shows the count in its confirmation), but the number of detached
   * articles is recorded so the audit log says what actually happened.
   */
  async removeTopic(actor: SessionUser, id: string): Promise<void> {
    assertCanManageTaxonomy(actor);
    const topic = await taxonomyRepository.findTopicWithUsage(id);
    if (!topic) throw new Error("Chủ đề không tồn tại.");
    await taxonomyRepository.deleteTopic(id);
    await auditLogRepository.record({
      actorId: actor.id,
      action: "DELETE",
      entityType: "Topic",
      entityId: id,
      metadata: { slug: topic.slug, name: topic.name, detachedArticles: topic._count.articles },
    });
  },

  /** Same shape as `removeTopic` — `ArticleTag` cascades, so this only ever
   *  removes a label, never content. */
  async removeTag(actor: SessionUser, id: string): Promise<void> {
    assertCanManageTaxonomy(actor);
    const tag = await taxonomyRepository.findTagWithUsage(id);
    if (!tag) throw new Error("Tag không tồn tại.");
    await taxonomyRepository.deleteTag(id);
    await auditLogRepository.record({
      actorId: actor.id,
      action: "DELETE",
      entityType: "Tag",
      entityId: id,
      metadata: { slug: tag.slug, name: tag.name, detachedArticles: tag._count.articles },
    });
  },
};
