import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { documentRepository } from "@/server/repositories/documentRepository";
import { documentExtensionOf } from "@/server/validation/documentUpload";
import { slugify } from "@/lib/slug";
import {
  getDriveFileStream,
  GoogleDriveNotConfiguredError,
  GoogleDriveOperationError,
} from "@/server/integrations/googleDrive";

/**
 * Serves an uploaded document's bytes. Addressed by **`Document.id`, not
 * `MediaAsset.id`**, which is the whole point: publication state lives on the
 * document, so routing through it means an unpublished văn bản is a 404 for
 * the public even though its bytes sit in the same Drive folder as every
 * published one. Going through `/api/media/[mediaId]` would have bypassed
 * that check entirely.
 *
 * As with images, the Drive file id never reaches the browser.
 */

/** `filename*=UTF-8''…` (RFC 5987) carries the real Vietnamese name with
 *  diacritics; the plain `filename=` beside it is an ASCII slug for old
 *  clients that would otherwise mangle it. */
function contentDisposition(title: string, extension: string): string {
  const pretty = `${title}.${extension}`;
  const ascii = `${slugify(title).slice(0, 80).replace(/-+$/, "") || "tai-lieu"}.${extension}`;
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(pretty)}`;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const document = await documentRepository.findById(id);
  if (!document || !document.isPublished || !document.media) {
    return NextResponse.json({ error: "Không tìm thấy tài liệu." }, { status: 404 });
  }
  const media = document.media;
  if (media.status !== "READY" || media.provider !== "GOOGLE_DRIVE" || !media.providerFileId) {
    return NextResponse.json({ error: "Tệp tài liệu không sẵn sàng." }, { status: 404 });
  }

  // Unlike an image, a document's bytes are NOT immutable for the lifetime of
  // the id: editing the document can point it at a newly uploaded file while
  // keeping the same `Document.id`. So the ETag folds in the media id, and
  // the cache is revalidated rather than declared `immutable`.
  const etag = `"${document.id}-${media.id}"`;
  const cacheHeaders = { "Cache-Control": "public, max-age=300, must-revalidate", ETag: etag };
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: cacheHeaders });
  }

  try {
    const file = await getDriveFileStream(media.providerFileId);
    const extension = documentExtensionOf(media.filename ?? "") ?? "pdf";
    return new NextResponse(Readable.toWeb(file.stream as unknown as Readable) as ReadableStream<Uint8Array>, {
      headers: {
        ...cacheHeaders,
        "Content-Type": media.mimeType ?? file.mimeType,
        "Content-Disposition": contentDisposition(document.title, extension),
        ...(file.size ? { "Content-Length": String(file.size) } : {}),
        // The bytes are attacker-supplied only in the sense that an editor
        // uploaded them; `nosniff` still stops a browser from deciding a
        // .doc is really HTML and running it in our origin.
        "X-Content-Type-Options": "nosniff",
      },
    });
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
