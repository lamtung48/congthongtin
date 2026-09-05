import { prisma } from "@/server/db/client";
import type { EventStatus, Prisma } from "@/generated/prisma/client";

const eventWithRelations = {
  province: true,
  organization: true,
  coverMedia: true,
} satisfies Prisma.EventInclude;

export type EventWithRelations = Prisma.EventGetPayload<{ include: typeof eventWithRelations }>;

export const eventRepository = {
  findBySlug(slug: string): Promise<EventWithRelations | null> {
    return prisma.event.findUnique({ where: { slug }, include: eventWithRelations });
  },

  listAll() {
    return prisma.event.findMany({ orderBy: { startAt: "asc" }, include: eventWithRelations });
  },

  listByProvince(provinceId: string) {
    return prisma.event.findMany({
      where: { provinceId, status: { not: "CANCELLED" } },
      orderBy: { startAt: "desc" },
      include: eventWithRelations,
    });
  },

  create(data: Prisma.EventCreateInput) {
    return prisma.event.create({ data, include: eventWithRelations });
  },

  update(id: string, data: Prisma.EventUpdateInput) {
    return prisma.event.update({ where: { id }, data, include: eventWithRelations });
  },

  updateStatus(id: string, status: EventStatus) {
    return prisma.event.update({ where: { id }, data: { status } });
  },
};
