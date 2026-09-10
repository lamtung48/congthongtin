import { prisma } from "@/server/db/client";

/**
 * Read/write access for the three taxonomy tables (`docs/DATABASE_SCHEMA.md`,
 * "Taxonomy — three tables, on purpose").
 *
 * The list queries come in two flavours on purpose. The plain ones are what
 * every picker/dropdown in the app uses (an article editor choosing a
 * category does not need usage counts). The `*WithUsage` ones are for the
 * admin taxonomy screens, where "how many things point at this?" is the
 * whole reason an editor can tell a safe delete from a destructive one.
 */

/** Everything that holds a **required** FK to `Category` — deleting a row
 *  any of these point at is a foreign-key error at the database, so the
 *  service refuses it up front with a message that names the count. */
const categoryUsage = {
  _count: { select: { articles: true, videos: true, sources: true, activityStatistics: true } },
} as const;

export const taxonomyRepository = {
  listCategories() {
    return prisma.category.findMany({ orderBy: { order: "asc" } });
  },
  listCategoriesWithUsage() {
    return prisma.category.findMany({ orderBy: { order: "asc" }, include: categoryUsage });
  },
  findCategoryWithUsage(id: string) {
    return prisma.category.findUnique({ where: { id }, include: categoryUsage });
  },
  createCategory(data: { slug: string; name: string; description?: string }) {
    return prisma.category.create({ data });
  },
  deleteCategory(id: string) {
    return prisma.category.delete({ where: { id } });
  },

  listTopics() {
    return prisma.topic.findMany({ orderBy: { name: "asc" } });
  },
  listTopicsWithUsage() {
    return prisma.topic.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { articles: true } } } });
  },
  findTopicWithUsage(id: string) {
    return prisma.topic.findUnique({ where: { id }, include: { _count: { select: { articles: true } } } });
  },
  createTopic(data: { slug: string; name: string; description?: string }) {
    return prisma.topic.create({ data });
  },
  deleteTopic(id: string) {
    return prisma.topic.delete({ where: { id } });
  },

  /** The public site's `Topic.articleCount` (`/chu-de` listing, homepage's
   *  trending topics) — published articles only, matching the same
   *  production data policy every other public count/list applies. */
  countPublishedArticlesByTopic(topicId: string) {
    return prisma.article.count({ where: { status: "PUBLISHED", topics: { some: { topicId } } } });
  },

  listTags() {
    return prisma.tag.findMany({ orderBy: { name: "asc" } });
  },
  listTagsWithUsage() {
    return prisma.tag.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { articles: true } } } });
  },
  findTagWithUsage(id: string) {
    return prisma.tag.findUnique({ where: { id }, include: { _count: { select: { articles: true } } } });
  },
  createTag(data: { slug: string; name: string }) {
    return prisma.tag.create({ data });
  },
  deleteTag(id: string) {
    return prisma.tag.delete({ where: { id } });
  },
};
