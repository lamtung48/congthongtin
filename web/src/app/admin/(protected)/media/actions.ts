"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/server/auth/session";
import { mediaService, MediaInUseError } from "@/server/services/mediaService";

/**
 * Both actions re-check permission/ownership/usage inside `mediaService`
 * itself (`requireSession()` here only confirms *someone* is logged in) —
 * same discipline as `articles/actions.ts`. `deleteMediaAction` surfaces
 * `MediaInUseError`'s usage list back to the client as plain data (never a
 * thrown error across the server/client boundary) so the UI can render it
 * as a confirmation prompt instead of a dead-end failure (brief section 7).
 */

export interface UpdateMetadataResult {
  ok: boolean;
  error?: string;
}

export async function updateMediaMetadataAction(formData: FormData): Promise<UpdateMetadataResult> {
  const actor = await requireSession();
  const mediaId = String(formData.get("mediaId") ?? "");
  const alt = String(formData.get("alt") ?? "").trim();
  const caption = String(formData.get("caption") ?? "").trim();
  try {
    await mediaService.updateMetadata(actor, mediaId, { alt: alt || null, caption: caption || null });
    revalidatePath("/admin/media");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Không thể cập nhật." };
  }
}

export interface DeleteMediaResult {
  ok: boolean;
  error?: string;
  usage?: { entityLabel: string; hardBlock: boolean }[];
}

export async function deleteMediaAction(formData: FormData): Promise<DeleteMediaResult> {
  const actor = await requireSession();
  const mediaId = String(formData.get("mediaId") ?? "");
  const force = formData.get("force") === "true";
  try {
    await mediaService.remove(actor, mediaId, { force });
    revalidatePath("/admin/media");
    return { ok: true };
  } catch (err) {
    if (err instanceof MediaInUseError) {
      return { ok: false, error: err.message, usage: err.usage.map((u) => ({ entityLabel: u.entityLabel, hardBlock: u.hardBlock })) };
    }
    return { ok: false, error: err instanceof Error ? err.message : "Không thể xoá." };
  }
}
