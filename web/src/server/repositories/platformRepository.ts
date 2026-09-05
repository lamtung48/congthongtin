import { prisma } from "@/server/db/client";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Pure data access for `Platform` — the ecosystem integration registry
 * (Hội nghị, Đào tạo, Sinh viên 5 tốt, Tình nguyện, + any added later).
 * No permission/business rules here (which fields a role may write, audit
 * logging, calling an adapter) — see `platformService.ts`. Previously this
 * table only had two ad-hoc `prisma.platform.*` calls inline in
 * `homepageRepository.ts` (no admin CRUD existed at all); this is now the
 * one place every caller — admin UI and homepage fallback alike — reads/
 * writes through.
 */
export const platformRepository = {
  findById(id: string) {
    return prisma.platform.findUnique({ where: { id } });
  },

  findBySlug(slug: string) {
    return prisma.platform.findUnique({ where: { slug } });
  },

  /** Admin listing order — every platform, enabled or not (an Admin/
   *  Manager needs to see and re-enable a disabled one). */
  list() {
    return prisma.platform.findMany({ orderBy: { order: "asc" } });
  },

  /** Public/homepage-fallback order — see `homepageRepository.fallback.platforms`. */
  listEnabled(limit?: number) {
    return prisma.platform.findMany({
      where: { isEnabled: true },
      orderBy: { order: "asc" },
      take: limit,
    });
  },

  create(data: Prisma.PlatformUncheckedCreateInput) {
    return prisma.platform.create({ data });
  },

  update(id: string, data: Prisma.PlatformUncheckedUpdateInput) {
    return prisma.platform.update({ where: { id }, data });
  },

  setEnabled(id: string, isEnabled: boolean) {
    return prisma.platform.update({ where: { id }, data: { isEnabled } });
  },

  remove(id: string) {
    return prisma.platform.delete({ where: { id } });
  },
};
