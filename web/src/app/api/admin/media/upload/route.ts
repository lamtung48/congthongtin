import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { hasPermission } from "@/server/auth/permissions";
import { mediaService } from "@/server/services/mediaService";
import { validateImageUpload, buildStorageFilename } from "@/server/validation/mediaUpload";
import { processImageForStorage } from "@/server/media/processImage";
import { slugify } from "@/lib/slug";
import { uploadRateLimiter } from "@/server/security/rateLimit";
import {
  uploadFileToDrive,
  GoogleDriveNotConfiguredError,
  GoogleDriveOperationError,
} from "@/server/integrations/googleDrive";

/**
 * Brief section 3: "Upload flow: Browser → Upload flow → Google Drive →
 * MediaAsset metadata trong database." A Route Handler rather than a Server
 * Action because a Server Action's body is capped at 1MB by default and
 * raising that cap is a global `next.config.ts` setting — a Route Handler's
 * body has no such framework-imposed limit, only whatever the reverse proxy
 * in front of it allows. One file per request: the client (Task #82) issues
 * one `XMLHttpRequest` per file so each gets its own real upload-progress
 * event and can be retried independently.
 *
 * The whole file is read into memory before anything else happens — Next's
 * Route Handlers expose the incoming body as a Web `Request`, which has no
 * API for treating one `multipart/form-data` part as a live stream, so
 * `googleDrive.ts` was written to accept a `Buffer` from the start (see its
 * own header comment). Nothing here ever writes the buffer to disk.
 */

export async function POST(request: Request) {
  const actor = await getSession();
  if (!actor) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }
  if (!hasPermission(actor.role, "media.manage.own") && !hasPermission(actor.role, "media.manage.any")) {
    return NextResponse.json({ error: "Không có quyền tải lên media." }, { status: 403 });
  }

  // Brief section 9: "upload init" is a rate-limit priority — this is the
  // one route on the whole site that both accepts an arbitrary-size body
  // and triggers an outbound call to a third-party API (Google Drive) per
  // request.
  if (!uploadRateLimiter.check(actor.id).allowed) {
    return NextResponse.json({ error: "Bạn đang tải lên quá nhanh — vui lòng thử lại sau ít phút." }, { status: 429 });
  }
  uploadRateLimiter.record(actor.id);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Không đọc được dữ liệu tải lên." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Thiếu tệp tải lên." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const validation = validateImageUpload(buffer, file.name);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { format, mimeType, dimensions } = validation.value;

  // Downscale to ≤ 1600px on the longest edge and strip EXIF before storage
  // — raw camera/phone images are multi-MB and nothing on the site needs
  // them at full size. Falls back to the original bytes if sharp can't
  // process the file (see processImageForStorage).
  const processed = await processImageForStorage(buffer, format);
  // Optional hint from the article editor — slugified + capped here so it's
  // safe as a filename (never the raw client name, brief section 9).
  const rawHint = formData.get("nameHint");
  const slugHint =
    typeof rawHint === "string" && rawHint.trim() ? slugify(rawHint).slice(0, 80).replace(/-+$/, "") || undefined : undefined;
  const storageFilename = buildStorageFilename(crypto.randomUUID(), format, slugHint);

  try {
    const uploaded = await uploadFileToDrive(processed.buffer, storageFilename, mimeType);
    const asset = await mediaService.registerUpload(actor, {
      providerFileId: uploaded.fileId,
      type: "IMAGE",
      filename: file.name,
      mimeType,
      size: uploaded.size,
      width: processed.width ?? dimensions?.width,
      height: processed.height ?? dimensions?.height,
    });
    return NextResponse.json({ media: asset }, { status: 201 });
  } catch (err) {
    if (err instanceof GoogleDriveNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof GoogleDriveOperationError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    throw err;
  }
}
