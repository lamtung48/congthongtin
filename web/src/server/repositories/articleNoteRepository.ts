import { prisma } from "@/server/db/client";

/**
 * Editorial workflow task, brief section 8: "Cho phép ghi chú nội bộ.
 * Không public." Pure data access — `articleService.addNote`/`listNotes`
 * own the visibility check (same `canView` rule as the article itself).
 */
export const articleNoteRepository = {
  create(articleId: string, authorId: string | null, body: string) {
    return prisma.articleNote.create({
      data: { articleId, authorId, body },
      include: { author: { select: { id: true, displayName: true } } },
    });
  },

  listForArticle(articleId: string) {
    return prisma.articleNote.findMany({
      where: { articleId },
      orderBy: { createdAt: "asc" },
      include: { author: { select: { id: true, displayName: true } } },
    });
  },
};
