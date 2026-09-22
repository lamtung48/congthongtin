import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { hasPermission } from "@/server/auth/permissions";
import { uploadRateLimiter } from "@/server/security/rateLimit";
import { storeImageBuffer, inferImageFilename } from "@/server/media/storeImage";
import { fetchRemoteImage } from "@/server/media/fetchRemoteImage";
import { GoogleDriveNotConfiguredError, GoogleDriveOperationError } from "@/server/integrations/googleDrive";

/**
 * Pulls an image referenced by URL into Drive — the rich-text editor calls
 * this for every `<img>` in a pasted article (a `data:` URI from a Word /
 * Google-Docs paste, or a remote `http(s)` URL). Same validate → resize →
 * Drive pipeline as a normal upload (`storeImageBuffer`), so a link-inserted
 * image is indistinguishable from an uploaded one afterwards — including
 * having a `/api/media/[id]` preview the editor can actually render.
 *
 * The fetch itself (and its SSRF guards) lives in `fetchRemoteImage.ts`,
 * shared with the external-content collector's convert step.
 */
export async function POST(request: Request) {
  const actor = await getSession();
  if (!actor) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  if (!hasPermission(actor.role, "media.manage.own") && !hasPermission(actor.role, "media.manage.any")) {
    return NextResponse.json({ error: "Không có quyền thêm media." }, { status: 403 });
  }
  if (!uploadRateLimiter.check(actor.id).allowed) {
    return NextResponse.json({ error: "Bạn đang thêm ảnh quá nhanh — thử lại sau ít phút." }, { status: 429 });
  }
  uploadRateLimiter.record(actor.id);

  let url: string;
  let nameHint: string | undefined;
  try {
    const body = (await request.json()) as { url?: unknown; nameHint?: unknown };
    if (typeof body.url !== "string" || !body.url.trim()) throw new Error();
    url = body.url.trim();
    nameHint = typeof body.nameHint === "string" ? body.nameHint : undefined;
  } catch {
    return NextResponse.json({ error: "Thiếu địa chỉ ảnh." }, { status: 400 });
  }

  const fetched = await fetchRemoteImage(url, nameHint);
  if (!fetched.ok) return NextResponse.json({ error: fetched.error }, { status: fetched.status });

  try {
    const result = await storeImageBuffer(actor, fetched.buffer, {
      originalName: inferImageFilename(fetched.buffer, fetched.nameHint),
      nameHint,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ media: result.media }, { status: 201 });
  } catch (err) {
    if (err instanceof GoogleDriveNotConfiguredError) return NextResponse.json({ error: err.message }, { status: 503 });
    if (err instanceof GoogleDriveOperationError) return NextResponse.json({ error: err.message }, { status: 502 });
    throw err;
  }
}
