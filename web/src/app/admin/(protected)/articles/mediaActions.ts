"use server";

import { z } from "zod";
import { requireSession } from "@/server/auth/session";
import { mediaService } from "@/server/services/mediaService";

/**
 * The advanced fallback path in `MediaPicker` — "liên kết file có sẵn"
 * (brief section 3's UI note: keep one such option for Admin/Manager only).
 * The primary path for a new image is now `MediaUploader` talking straight
 * to `POST /api/admin/media/upload` (a real Google Drive upload); this
 * Server Action exists for the two cases that upload flow doesn't cover:
 * linking a YouTube video id (there's no "upload" for a video — YouTube is
 * where it already lives), and an Admin/Manager manually pointing at a
 * Drive file id that exists outside this app's own upload flow.
 * `mediaService.registerManualLink` itself is what actually restricts the
 * IMAGE case to `media.manage.any` — this action is just its form-data glue.
 */
const LinkMediaSchema = z.object({
  provider: z.enum(["GOOGLE_DRIVE", "YOUTUBE", "LOCAL_PLACEHOLDER"]),
  type: z.enum(["IMAGE", "VIDEO"]),
  providerFileId: z.string().trim().optional(),
  alt: z.string().trim().optional(),
  caption: z.string().trim().optional(),
});

export interface LinkMediaResult {
  id: string;
  label: string;
  type: "IMAGE" | "VIDEO";
  error?: string;
}

export async function linkMediaAction(formData: FormData): Promise<LinkMediaResult> {
  const actor = await requireSession();
  const parsed = LinkMediaSchema.safeParse({
    provider: formData.get("provider"),
    type: formData.get("type"),
    providerFileId: formData.get("providerFileId") || undefined,
    alt: formData.get("alt") || undefined,
    caption: formData.get("caption") || undefined,
  });
  if (!parsed.success) {
    return { id: "", label: "", type: "IMAGE", error: "Dữ liệu media không hợp lệ." };
  }

  try {
    const asset = await mediaService.registerManualLink(actor, parsed.data);
    return { id: asset.id, label: asset.alt || asset.caption || asset.providerFileId || asset.id, type: asset.type };
  } catch (err) {
    return { id: "", label: "", type: parsed.data.type, error: err instanceof Error ? err.message : "Không thể thêm media." };
  }
}
