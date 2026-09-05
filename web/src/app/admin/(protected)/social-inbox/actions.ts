"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/server/auth/session";
import { socialInboxService } from "@/server/services/socialInboxService";

/**
 * Every action re-fetches the item and calls the matching
 * `socialInboxService` method, which re-checks `canView`/permission
 * independently — same discipline as `articles/actions.ts`.
 */

async function loadOr404(id: string) {
  const item = await socialInboxService.getById(id);
  if (!item) throw new Error("External item not found.");
  return item;
}

function revalidateInbox() {
  revalidatePath("/admin/social-inbox");
}

export async function ignoreExternalItemAction(formData: FormData): Promise<void> {
  const actor = await requireSession();
  const item = await loadOr404(String(formData.get("itemId")));
  await socialInboxService.ignore(actor, item);
  revalidateInbox();
}

export async function assignExternalItemAction(formData: FormData): Promise<void> {
  const actor = await requireSession();
  const item = await loadOr404(String(formData.get("itemId")));
  const contributorId = String(formData.get("contributorId"));
  await socialInboxService.assign(actor, item, contributorId);
  revalidateInbox();
}

export async function convertExternalItemAction(formData: FormData): Promise<void> {
  const actor = await requireSession();
  const item = await loadOr404(String(formData.get("itemId")));
  const categoryId = String(formData.get("categoryId"));
  const title = String(formData.get("title") ?? "").trim() || undefined;
  const article = await socialInboxService.convertToArticle(actor, item, { categoryId, title });
  revalidateInbox();
  redirect(`/admin/articles/${article.id}/edit`);
}

export async function createManualItemAction(formData: FormData): Promise<void> {
  const actor = await requireSession();
  await socialInboxService.createManual(actor, {
    url: String(formData.get("url")).trim(),
    title: String(formData.get("title") ?? "").trim() || undefined,
    contentText: String(formData.get("contentText")),
  });
  revalidateInbox();
}
