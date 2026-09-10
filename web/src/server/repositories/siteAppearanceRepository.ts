import { prisma } from "@/server/db/client";

/** The singleton row's fixed id — same pattern as `YoutubeConnection`. */
const SINGLETON_ID = "default";

export const siteAppearanceRepository = {
  find() {
    return prisma.siteAppearance.findUnique({ where: { id: SINGLETON_ID } });
  },

  /** Upsert, so the row is created on first save rather than needing a seed
   *  step — a site that has never changed its background simply has no row. */
  set(pageBackground: string, updatedById: string | null) {
    return prisma.siteAppearance.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, pageBackground, updatedById },
      update: { pageBackground, updatedById },
    });
  },
};
