import { prisma } from "@/server/db/client";
import type { Prisma, ExternalItemStatus } from "@/generated/prisma/client";

export const externalItemWithRelations = {
  source: true,
  assignedTo: { select: { id: true, displayName: true } },
  ignoredBy: { select: { id: true, displayName: true } },
  createdBy: { select: { id: true, displayName: true } },
} satisfies Prisma.ExternalItemInclude;

export type ExternalItemWithRelations = Prisma.ExternalItemGetPayload<{ include: typeof externalItemWithRelations }>;

export interface ExternalItemFilter {
  status?: ExternalItemStatus;
  statusIn?: ExternalItemStatus[];
  sourceId?: string;
  /** Social Inbox task, brief section 5: a CONTRIBUTOR's own queue is
   *  scoped to items assigned to them — enforced by the caller
   *  (`socialInboxService.listForActor`), not optional here, same
   *  pattern as `ArticleAdminFilter.createdById`. */
  assignedToId?: string;
}

function buildWhere(params: ExternalItemFilter): Prisma.ExternalItemWhereInput {
  return {
    status: params.status,
    ...(params.statusIn ? { status: { in: params.statusIn } } : {}),
    sourceId: params.sourceId,
    assignedToId: params.assignedToId,
  };
}

export const externalItemRepository = {
  findById(id: string): Promise<ExternalItemWithRelations | null> {
    return prisma.externalItem.findUnique({ where: { id }, include: externalItemWithRelations });
  },

  listForAdmin(params: ExternalItemFilter = {}) {
    return prisma.externalItem.findMany({
      where: buildWhere(params),
      orderBy: [{ status: "asc" }, { publishedAt: "desc" }],
      include: externalItemWithRelations,
    });
  },

  countForAdmin(params: ExternalItemFilter = {}) {
    return prisma.externalItem.count({ where: buildWhere(params) });
  },

  /** Dedup check 1 (brief section 7): the same platform-native post
   *  fetched twice from the same source. */
  findBySourceAndExternalId(sourceId: string, externalId: string) {
    return prisma.externalItem.findUnique({ where: { sourceId_externalId: { sourceId, externalId } } });
  },

  /** Dedup check 2: the same link surfacing again, from any source. */
  findByUrl(url: string) {
    return prisma.externalItem.findFirst({ where: { url } });
  },

  /** Dedup check 3: a near-duplicate with no matching id/url — same
   *  source, same normalized content hash, within `windowMs` of the
   *  candidate's own `publishedAt` (a genuine repost from the same page
   *  months later is not a duplicate; an edited/reformatted repost of the
   *  same moment is). */
  findByNormalizedHashNearTime(sourceId: string, normalizedContentHash: string, around: Date, windowMs: number) {
    return prisma.externalItem.findFirst({
      where: {
        sourceId,
        normalizedContentHash,
        publishedAt: { gte: new Date(around.getTime() - windowMs), lte: new Date(around.getTime() + windowMs) },
      },
    });
  },

  create(data: Prisma.ExternalItemUncheckedCreateInput): Promise<ExternalItemWithRelations> {
    return prisma.externalItem.create({ data, include: externalItemWithRelations });
  },

  assign(id: string, assignedToId: string) {
    return prisma.externalItem.update({
      where: { id },
      data: { status: "ASSIGNED", assignedToId },
      include: externalItemWithRelations,
    });
  },

  ignore(id: string, ignoredById: string) {
    return prisma.externalItem.update({
      where: { id },
      data: { status: "IGNORED", ignoredById, ignoredAt: new Date() },
      include: externalItemWithRelations,
    });
  },

  markConverted(id: string, articleId: string) {
    return prisma.externalItem.update({
      where: { id },
      data: { status: "CONVERTED", articleId },
      include: externalItemWithRelations,
    });
  },

  countByStatus(status: ExternalItemStatus) {
    return prisma.externalItem.count({ where: { status } });
  },
};
