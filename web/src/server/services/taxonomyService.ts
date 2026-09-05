import { taxonomyRepository } from "@/server/repositories/taxonomyRepository";
import { auditLogRepository } from "@/server/repositories/auditLogRepository";
import { hasPermission } from "@/server/auth/permissions";
import type { SessionUser } from "@/server/auth/session";

function assertCanManageTaxonomy(actor: SessionUser) {
  if (!hasPermission(actor.role, "taxonomy.manage")) {
    throw new Error(`Role ${actor.role} lacks permission "taxonomy.manage".`);
  }
}

export const taxonomyService = {
  listCategories: taxonomyRepository.listCategories,
  listTopics: taxonomyRepository.listTopics,
  listTags: taxonomyRepository.listTags,

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
};
