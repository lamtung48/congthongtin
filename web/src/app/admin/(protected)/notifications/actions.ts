"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/server/auth/session";
import { notificationService } from "@/server/services/notificationService";

/**
 * `notificationService.markRead`/`markAllRead` scope every write to
 * `actor.id` themselves (see that file) — this action layer adds no
 * authorization of its own beyond "is someone logged in", same discipline
 * as `articles/actions.ts`.
 */
export async function markNotificationReadAction(formData: FormData): Promise<void> {
  const actor = await requireSession();
  await notificationService.markRead(actor, String(formData.get("notificationId")));
  revalidatePath("/admin/notifications");
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const actor = await requireSession();
  await notificationService.markAllRead(actor);
  revalidatePath("/admin/notifications");
}
