import { eventRepository, type EventWithRelations } from "@/server/repositories/eventRepository";
import { auditLogRepository } from "@/server/repositories/auditLogRepository";
import type { EventStatus, Prisma } from "@/generated/prisma/client";

/**
 * Brief section 9: "Không được giả realtime." `Event.status` in the
 * database is a stored value (an editor can set CANCELLED, which no clock
 * can derive), but LIVE/UPCOMING/COMPLETED are facts about `startAt`/`endAt`
 * versus the actual current time — never invented by a scheduler that isn't
 * built. `deriveStatus` recomputes the true value on every read and
 * `reconcileStatus` corrects a stale stored row opportunistically (called
 * from the read path, not a cron this task doesn't add) rather than trusting
 * whatever the last write happened to leave behind.
 */
export function deriveStatus(event: Pick<EventWithRelations, "startAt" | "endAt" | "status">, now: Date): EventStatus {
  if (event.status === "CANCELLED") return "CANCELLED";
  if (now < event.startAt) return "UPCOMING";
  if (now > event.endAt) return "COMPLETED";
  return "LIVE";
}

/**
 * Applied to every list/single-item read path below — a caller must never
 * be able to reach a stale `UPCOMING` for an event whose `endAt` has
 * already passed just because nothing happened to write through this
 * particular row recently.
 */
function withDerivedStatus<T extends Pick<EventWithRelations, "startAt" | "endAt" | "status">>(event: T, now: Date): T {
  const derived = deriveStatus(event, now);
  return derived === event.status ? event : { ...event, status: derived };
}

export const eventService = {
  countByStatus: eventRepository.countByStatus,

  async listAll() {
    const now = new Date();
    return (await eventRepository.listAll()).map((e) => withDerivedStatus(e, now));
  },

  async listByProvince(provinceId: string) {
    const now = new Date();
    return (await eventRepository.listByProvince(provinceId)).map((e) => withDerivedStatus(e, now));
  },

  async getBySlug(slug: string) {
    const event = await eventRepository.findBySlug(slug);
    if (!event) return null;
    const derived = deriveStatus(event, new Date());
    if (derived !== event.status) {
      await eventRepository.updateStatus(event.id, derived);
      return { ...event, status: derived };
    }
    return event;
  },

  async create(data: Prisma.EventCreateInput, actorId: string | null) {
    const event = await eventRepository.create(data);
    await auditLogRepository.record({ actorId, action: "CREATE", entityType: "Event", entityId: event.id });
    return event;
  },

  async update(id: string, data: Prisma.EventUpdateInput, actorId: string | null) {
    const event = await eventRepository.update(id, data);
    await auditLogRepository.record({ actorId, action: "UPDATE", entityType: "Event", entityId: id });
    return event;
  },

  async cancel(id: string, actorId: string | null) {
    const event = await eventRepository.updateStatus(id, "CANCELLED");
    await auditLogRepository.record({ actorId, action: "UPDATE", entityType: "Event", entityId: id, metadata: { to: "CANCELLED" } });
    return event;
  },
};
