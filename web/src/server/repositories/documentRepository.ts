import { prisma } from "@/server/db/client";
import type { Prisma } from "@/generated/prisma/client";

/**
 * "Tài liệu" — downloadable văn bản, plus the label vocabulary they are
 * filed under. Two tables, one repository, because a label has no life of
 * its own outside the documents that carry it.
 */

const withRelations = {
  label: true,
  media: true,
  createdBy: { select: { id: true, displayName: true } },
} as const;

export type DocumentWithRelations = Prisma.DocumentGetPayload<{ include: typeof withRelations }>;

export interface DocumentFilter {
  labelSlug?: string;
  /** Public listings pass `true`; the admin list passes nothing and sees
   *  drafts too. */
  publishedOnly?: boolean;
  skip?: number;
  take?: number;
}

function where(filter: DocumentFilter): Prisma.DocumentWhereInput {
  return {
    ...(filter.publishedOnly ? { isPublished: true } : {}),
    ...(filter.labelSlug ? { label: { slug: filter.labelSlug } } : {}),
  };
}

/** Newest first by issue date, falling back to when it was posted — a
 *  document with no `issuedAt` (a form, a template) would otherwise sort
 *  below everything forever. */
const order: Prisma.DocumentOrderByWithRelationInput[] = [{ issuedAt: "desc" }, { createdAt: "desc" }];

export const documentRepository = {
  list(filter: DocumentFilter = {}) {
    return prisma.document.findMany({
      where: where(filter),
      orderBy: order,
      skip: filter.skip,
      take: filter.take,
      include: withRelations,
    });
  },

  count(filter: DocumentFilter = {}) {
    return prisma.document.count({ where: where(filter) });
  },

  findById(id: string) {
    return prisma.document.findUnique({ where: { id }, include: withRelations });
  },

  findBySlug(slug: string) {
    return prisma.document.findUnique({ where: { slug }, include: withRelations });
  },

  create(data: Prisma.DocumentUncheckedCreateInput) {
    return prisma.document.create({ data, include: withRelations });
  },

  update(id: string, data: Prisma.DocumentUncheckedUpdateInput) {
    return prisma.document.update({ where: { id }, data, include: withRelations });
  },

  remove(id: string) {
    return prisma.document.delete({ where: { id } });
  },

  listLabels() {
    return prisma.documentLabel.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] });
  },

  listLabelsWithUsage() {
    return prisma.documentLabel.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
      include: { _count: { select: { documents: true } } },
    });
  },

  findLabelById(id: string) {
    return prisma.documentLabel.findUnique({ where: { id }, include: { _count: { select: { documents: true } } } });
  },

  createLabel(data: { slug: string; name: string; order: number }) {
    return prisma.documentLabel.create({ data });
  },

  /** Highest `order` currently in use, so a new label lands at the end of
   *  the filter row instead of jumping to the front. */
  async nextLabelOrder(): Promise<number> {
    const last = await prisma.documentLabel.findFirst({ orderBy: { order: "desc" }, select: { order: true } });
    return (last?.order ?? -1) + 1;
  },

  deleteLabel(id: string) {
    return prisma.documentLabel.delete({ where: { id } });
  },
};
