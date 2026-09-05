import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { hasPermission } from "@/server/auth/permissions";
import { youtubeService } from "@/server/services/youtubeService";
import { validateVideoUpload } from "@/server/validation/videoUpload";
import { YoutubeNotConfiguredError, YoutubeNotConnectedError, YoutubeOperationError, type YoutubePrivacyStatus } from "@/server/integrations/youtube";

/**
 * Brief section 3: real YouTube Data API upload with title/description/
 * visibility. A Route Handler for the same reason as `/api/admin/media/
 * upload` (image upload) — a Server Action's body is capped at 1MB, a
 * Route Handler's isn't. The whole file is buffered in memory before
 * anything else happens, same constraint and same reasoning as the image
 * path (see `videoUpload.ts`'s header comment on why this caps at 200MB
 * rather than streaming through).
 */

const VALID_VISIBILITY: YoutubePrivacyStatus[] = ["public", "unlisted", "private"];

export async function POST(request: Request) {
  const actor = await getSession();
  if (!actor) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }
  if (!hasPermission(actor.role, "media.manage.own") && !hasPermission(actor.role, "media.manage.any")) {
    return NextResponse.json({ error: "Không có quyền tải video lên." }, { status: 403 });
  }

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
  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "Thiếu tiêu đề video." }, { status: 400 });
  }
  const description = String(formData.get("description") ?? "").trim();
  const rawVisibility = String(formData.get("visibility") ?? "unlisted");
  const visibility = (VALID_VISIBILITY as string[]).includes(rawVisibility) ? (rawVisibility as YoutubePrivacyStatus) : "unlisted";

  const buffer = Buffer.from(await file.arrayBuffer());
  const validation = validateVideoUpload(buffer, file.name);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const asset = await youtubeService.uploadVideo(actor, { buffer, mimeType: validation.value.mimeType, title, description, visibility });
    return NextResponse.json({ media: asset }, { status: 201 });
  } catch (err) {
    if (err instanceof YoutubeNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof YoutubeNotConnectedError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof YoutubeOperationError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }
}
