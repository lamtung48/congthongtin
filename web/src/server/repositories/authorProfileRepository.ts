import { prisma } from "@/server/db/client";

/**
 * Read-only — dropdown data for the CMS's "Tác giả" field. Full author-
 * profile management (create/edit a byline, link it to a `User`) is out of
 * this task's scope, same as Organization/Event/Homepage in the prior
 * auth/authz task; this only needs to list existing profiles and find the
 * one (if any) tied to the current actor, so `articleService` can restrict
 * a Contributor to their own byline.
 */
export const authorProfileRepository = {
  list() {
    return prisma.authorProfile.findMany({ orderBy: { displayName: "asc" } });
  },

  findByUserId(userId: string) {
    return prisma.authorProfile.findUnique({ where: { userId } });
  },
};
