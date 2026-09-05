import { prisma } from "@/server/db/client";
import type { Prisma, SourceType, SourceStatus } from "@/generated/prisma/client";

/**
 * Pure data access for `Source`. `publicSelect` excludes
 * `encryptedCredential` — every method here except
 * `findByIdWithCredential` uses it, and that one method is called from
 * exactly one place (`sourceService.sync()`, right before handing the
 * decrypted value to the matching adapter) — never returned to any
 * Server Component prop or Server Action response. Same discipline as
 * `userRepository.ts`'s `publicUserSelect`/`passwordHash`.
 */
const publicSelect = {
  id: true,
  name: true,
  type: true,
  status: true,
  isEnabled: true,
  externalUrl: true,
  externalId: true,
  includeHashtags: true,
  excludeHashtags: true,
  categoryId: true,
  lastSyncedAt: true,
  lastSyncItemCount: true,
  lastError: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  category: true,
  createdBy: { select: { id: true, displayName: true } },
} satisfies Prisma.SourceSelect;

export type PublicSource = Prisma.SourceGetPayload<{ select: typeof publicSelect }>;

export interface SourceAdminFilter {
  type?: SourceType;
  status?: SourceStatus;
}

export const sourceRepository = {
  list(params: SourceAdminFilter = {}): Promise<PublicSource[]> {
    return prisma.source.findMany({
      where: { type: params.type, status: params.status },
      orderBy: { createdAt: "desc" },
      select: publicSelect,
    });
  },

  findById(id: string): Promise<PublicSource | null> {
    return prisma.source.findUnique({ where: { id }, select: publicSelect });
  },

  /** The one credential-bearing read in the whole app — see this file's
   *  header comment. Callers must never pass the result anywhere except
   *  straight into an adapter's `fetchPosts()`. */
  findByIdWithCredential(id: string) {
    return prisma.source.findUnique({ where: { id } });
  },

  create(data: Prisma.SourceUncheckedCreateInput): Promise<PublicSource> {
    return prisma.source.create({ data, select: publicSelect });
  },

  update(id: string, data: Prisma.SourceUncheckedUpdateInput): Promise<PublicSource> {
    return prisma.source.update({ where: { id }, data, select: publicSelect });
  },

  recordSyncSuccess(id: string, itemCount: number): Promise<PublicSource> {
    return prisma.source.update({
      where: { id },
      data: { status: "ACTIVE", lastSyncedAt: new Date(), lastSyncItemCount: itemCount, lastError: null },
      select: publicSelect,
    });
  },

  recordSyncFailure(id: string, message: string): Promise<PublicSource> {
    return prisma.source.update({
      where: { id },
      data: { status: "ERROR", lastSyncedAt: new Date(), lastError: message },
      select: publicSelect,
    });
  },

  remove(id: string): Promise<void> {
    return prisma.source.delete({ where: { id } }).then(() => undefined);
  },
};
