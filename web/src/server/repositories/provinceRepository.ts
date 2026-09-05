import { prisma } from "@/server/db/client";

/** Read-only — dropdown data for the CMS's "Địa phương" field/filter, same
 *  pattern as `organizationRepository.ts`. */
export const provinceRepository = {
  list() {
    return prisma.province.findMany({ orderBy: { name: "asc" } });
  },
};
