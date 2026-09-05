import { prisma } from "@/server/db/client";

/**
 * Read/write access for the three taxonomy tables (`docs/DATABASE_SCHEMA.md`,
 * "Taxonomy — three tables, on purpose"). Minimal on purpose: this task's
 * focus is authentication/authorization, not a full taxonomy CRUD UI — see
 * docs/AUTHENTICATION.md, "Further work" for what a dedicated CMS task
 * would add (reordering, merging, usage counts before delete, ...).
 */
export const taxonomyRepository = {
  listCategories() {
    return prisma.category.findMany({ orderBy: { order: "asc" } });
  },
  createCategory(data: { slug: string; name: string; description?: string }) {
    return prisma.category.create({ data });
  },

  listTopics() {
    return prisma.topic.findMany({ orderBy: { name: "asc" } });
  },
  createTopic(data: { slug: string; name: string; description?: string }) {
    return prisma.topic.create({ data });
  },

  listTags() {
    return prisma.tag.findMany({ orderBy: { name: "asc" } });
  },
  createTag(data: { slug: string; name: string }) {
    return prisma.tag.create({ data });
  },
};
