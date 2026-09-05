"use server";

import { z } from "zod";
import { requireSession } from "@/server/auth/session";
import { mediaService } from "@/server/services/mediaService";
import { hasPermission } from "@/server/auth/permissions";

/**
 * No real upload pipeline exists in this task (Google Drive/YouTube
 * integration is out of scope — see docs/AUTHORIZATION.md, "Remaining
 * work"). The block editor still needs *some* way to attach media, so this
 * registers a `MediaAsset` row from metadata a human types in (a Drive
 * share link's file id, a YouTube video id, or a plain placeholder) —
 * exactly the same "metadata now, real file later" contract
 * `mediaService.ts`'s own header comment describes. Any role that can
 * create/edit an article (which already implies at least `media.manage.own`
 * — see `src/server/auth/permissions.ts`) can register one for their own
 * use; this only creates a metadata row, never touches another user's
 * asset.
 */
const CreateMediaSchema = z.object({
  provider: z.enum(["GOOGLE_DRIVE", "YOUTUBE", "LOCAL_PLACEHOLDER"]),
  type: z.enum(["IMAGE", "VIDEO"]),
  providerFileId: z.string().trim().optional(),
  alt: z.string().trim().optional(),
  caption: z.string().trim().optional(),
});

export interface CreateMediaResult {
  id: string;
  label: string;
  type: "IMAGE" | "VIDEO";
  error?: string;
}

export async function createMediaAction(formData: FormData): Promise<CreateMediaResult> {
  const actor = await requireSession();
  if (!hasPermission(actor.role, "media.manage.own") && !hasPermission(actor.role, "media.manage.any")) {
    return { id: "", label: "", type: "IMAGE", error: "Không có quyền thêm media." };
  }
  const parsed = CreateMediaSchema.safeParse({
    provider: formData.get("provider"),
    type: formData.get("type"),
    providerFileId: formData.get("providerFileId") || undefined,
    alt: formData.get("alt") || undefined,
    caption: formData.get("caption") || undefined,
  });
  if (!parsed.success) {
    return { id: "", label: "", type: "IMAGE", error: "Dữ liệu media không hợp lệ." };
  }

  const asset = await mediaService.registerAsset(
    {
      provider: parsed.data.provider,
      type: parsed.data.type,
      providerFileId: parsed.data.providerFileId,
      alt: parsed.data.alt,
      caption: parsed.data.caption,
      status: parsed.data.providerFileId ? "READY" : "MISSING",
      createdBy: { connect: { id: actor.id } },
    },
    actor.id,
  );

  return { id: asset.id, label: asset.alt || asset.caption || asset.providerFileId || asset.id, type: asset.type };
}
