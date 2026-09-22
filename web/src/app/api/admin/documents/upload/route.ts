import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { hasPermission } from "@/server/auth/permissions";
import { mediaService } from "@/server/services/mediaService";
import { validateDocumentUpload, buildDocumentStorageFilename } from "@/server/validation/documentUpload";
import { slugify } from "@/lib/slug";
import { uploadRateLimiter } from "@/server/security/rateLimit";
import {
  uploadFileToDrive,
  GoogleDriveNotConfiguredError,
  GoogleDriveOperationError,
} from "@/server/integrations/googleDrive";

/**
 * Same shape as `/api/admin/media/upload` — a Route Handler rather than a
 * Server Action, because a Server Action's body is capped at 1MB and raising
 * that is a global setting. The differences from the image route are all in
 * what happens to the bytes: no sharp, no resize, no EXIF strip, no
 * dimensions. A document is stored exactly as uploaded.
 *
 * The response is a bare `MediaAsset`; the admin form then submits its id as
 * part of the document itself. An upload that is never attached leaves an
 * unreferenced asset, which is the same trade `MediaUploader` already makes
 * for images.
 */
export async function POST(request: Request) {
  const actor = await getSession();
  if (!actor) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }
  if (!hasPermission(actor.role, "document.manage")) {
    return NextResponse.json({ error: "Không có quyền tải tài liệu lên." }, { status: 403 });
  }

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
  const validation = validateDocumentUpload(buffer, file.name);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { extension, mimeType } = validation.value;

  const rawHint = formData.get("nameHint");
  const slugHint =
    typeof rawHint === "string" && rawHint.trim() ? slugify(rawHint).slice(0, 80).replace(/-+$/, "") || undefined : undefined;
  const storageFilename = buildDocumentStorageFilename(crypto.randomUUID(), extension, slugHint);

  try {
    const uploaded = await uploadFileToDrive(buffer, storageFilename, mimeType);
    const asset = await mediaService.registerUpload(actor, {
      providerFileId: uploaded.fileId,
      type: "DOCUMENT",
      // The original name is kept as metadata only — it is what the download
      // is named for the visitor, never what the file is called in Drive.
      filename: file.name,
      mimeType,
      size: uploaded.size,
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
