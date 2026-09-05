import { prisma } from "@/server/db/client";

/**
 * Read-only for now — this task's focus is authentication/authorization,
 * not a full organization CRUD UI (same scope line drawn in
 * `taxonomyRepository.ts`'s header comment). `/admin/organizations` uses
 * this directly, the same way `/admin/dashboard` reads `auditLogRepository`
 * directly: a plain read with no actor-scoped authorization logic doesn't
 * need a service wrapper.
 */
export const organizationRepository = {
  list() {
    return prisma.organization.findMany({
      orderBy: { name: "asc" },
      include: { province: true },
    });
  },
};
