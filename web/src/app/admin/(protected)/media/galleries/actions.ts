"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/server/auth/session";
import { galleryService } from "@/server/services/galleryService";
import { homepageService } from "@/server/services/homepageService";

/**
 * Every action re-fetches nothing it doesn't need and calls the matching
 * `galleryService` method, which re-checks `gallery.manage` itself — this
 * file does no authorization of its own beyond `requireSession()`.
 */
function revalidateGalleryViews(id?: string) {
  revalidatePath("/admin/media/galleries");
  if (id) revalidatePath(`/admin/media/galleries/${id}`);
  // "Ảnh hoạt động" on the public homepage reads whichever gallery is
  // pinned/newest, so any edit here can change what visitors see.
  revalidatePath("/", "layout");
}

export async function createGalleryAction(formData: FormData): Promise<void> {
  const actor = await requireSession();
  const gallery = await galleryService.create(actor, {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
  });
  revalidateGalleryViews();
  redirect(`/admin/media/galleries/${gallery.id}`);
}

export async function updateGalleryAction(formData: FormData): Promise<void> {
  const actor = await requireSession();
  const id = String(formData.get("galleryId"));
  await galleryService.update(actor, id, {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
  });
  revalidateGalleryViews(id);
}

export async function deleteGalleryAction(formData: FormData): Promise<void> {
  const actor = await requireSession();
  await galleryService.remove(actor, String(formData.get("galleryId")));
  revalidateGalleryViews();
  redirect("/admin/media/galleries");
}

/** Called by the uploader once each file has finished reaching Drive — the
 *  upload itself goes through `/api/admin/media/upload`, this only attaches
 *  the resulting `MediaAsset`s to the gallery. */
export async function addPhotosAction(galleryId: string, mediaIds: string[]): Promise<{ ok: boolean; added?: number; error?: string }> {
  try {
    const actor = await requireSession();
    const added = await galleryService.addMedia(actor, galleryId, mediaIds);
    revalidateGalleryViews(galleryId);
    return { ok: true, added };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Không thêm được ảnh." };
  }
}

export async function removePhotoAction(formData: FormData): Promise<void> {
  const actor = await requireSession();
  await galleryService.removeItem(actor, String(formData.get("itemId")));
  revalidateGalleryViews(String(formData.get("galleryId")));
}

export async function movePhotoAction(formData: FormData): Promise<void> {
  const actor = await requireSession();
  const direction = String(formData.get("direction")) === "up" ? -1 : 1;
  await galleryService.moveItem(actor, String(formData.get("itemId")), direction);
  revalidateGalleryViews(String(formData.get("galleryId")));
}

export async function setPhotoCaptionAction(formData: FormData): Promise<void> {
  const actor = await requireSession();
  await galleryService.setItemCaption(actor, String(formData.get("itemId")), String(formData.get("caption") ?? ""));
  revalidateGalleryViews(String(formData.get("galleryId")));
}

/** Pins this gallery into the homepage's "Ảnh hoạt động" slot (or unpins it,
 *  which drops the section back to showing the most recent gallery). */
export async function toggleGalleryOnHomepageAction(formData: FormData): Promise<void> {
  const actor = await requireSession();
  const galleryId = String(formData.get("galleryId"));
  const pinned = String(formData.get("pinned")) === "true";
  await homepageService.setGalleryPinned(actor, galleryId, pinned);
  revalidateGalleryViews(galleryId);
}
