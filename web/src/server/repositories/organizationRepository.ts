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

  /** `/dia-phuong/[slug]`'s "Hội units operating here" list — a real query
   *  against `Organization.provinceId` now, replacing the old fixture
   *  world's only approximation (deriving a unit list from local-news
   *  bylines' `slugify()`-matched org names). */
  listByProvince(provinceId: string) {
    return prisma.organization.findMany({
      where: { provinceId, status: "ACTIVE" },
      orderBy: { name: "asc" },
    });
  },

  /** `/don-vi/[slug]` on the public site — an `Organization` row carries its
   *  own `slug` directly, unlike the old fixture world where a unit was only
   *  reachable by `slugify()`-ing a local-news byline's org name. */
  findBySlug(slug: string) {
    return prisma.organization.findUnique({
      where: { slug },
      include: { province: true },
    });
  },
};
