"use server";

import { z } from "zod";
import { requireSession } from "@/server/auth/session";
import { mediaService } from "@/server/services/mediaService";

/**
 * The advanced fallback path in `MediaPicker` — "liên kết file có sẵn"
 * (brief section 3's UI note: keep one such option for Admin/Manager only).
 * Images only: the primary path for a new image is `MediaUploader` talking
 * straight to `POST /api/admin/media/upload` (a real Google Drive upload);
 * this Server Action exists only for an Admin/Manager manually pointing at
 * a Drive file id that exists outside this app's own upload flow.
 * `mediaService.registerManualLink` itself is what actually restricts this
 * to `media.manage.any` — this action is just its form-data glue.
 *
 * Video's equivalent used to live here too (a YouTube video id typed by
 * hand, trusted without verification) — the YouTube integration task
 * replaced it with `youtubeService.linkExistingVideo`
 * (`media/videos/actions.ts`'s `linkVideoAction`), which actually verifies
 * the id against the real YouTube Data API before creating anything. There
 * is no video path here anymore.
 */
const LinkMediaSchema = z.object({
  provider: z.enum(["GOOGLE_DRIVE", "LOCAL_PLACEHOLDER"]),
  providerFileId: z.string().trim().optional(),
  alt: z.string().trim().optional(),
  caption: z.string().trim().optional(),
});

export interface LinkMediaResult {
  id: string;
  label: string;
  /** Set only when the manually-linked asset is a `GOOGLE_DRIVE` file
   *  that's actually `READY` — see `MediaOption.previewUrl`'s own comment.
   *  A `LOCAL_PLACEHOLDER` link, or a Drive link left without a file id
   *  (`status: MISSING`), has nothing this delivery route could serve. */
  previewUrl?: string;
  error?: string;
}

export async function linkMediaAction(formData: FormData): Promise<LinkMediaResult> {
  const actor = await requireSession();
  const parsed = LinkMediaSchema.safeParse({
    provider: formData.get("provider"),
    providerFileId: formData.get("providerFileId") || undefined,
    alt: formData.get("alt") || undefined,
    caption: formData.get("caption") || undefined,
  });
  if (!parsed.success) {
    return { id: "", label: "", error: "Dữ liệu media không hợp lệ." };
  }

  try {
    const asset = await mediaService.registerManualLink(actor, { ...parsed.data, type: "IMAGE" });
    return {
      id: asset.id,
      label: asset.alt || asset.caption || asset.providerFileId || asset.id,
      previewUrl: asset.provider === "GOOGLE_DRIVE" && asset.status === "READY" ? `/api/media/${asset.id}` : undefined,
    };
  } catch (err) {
    return { id: "", label: "", error: err instanceof Error ? err.message : "Không thể thêm media." };
  }
}
