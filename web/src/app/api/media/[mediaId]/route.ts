import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { mediaRepository } from "@/server/repositories/mediaRepository";
import { getImageVariant, parseVariantWidth } from "@/server/media/imageVariants";
import {
  getDriveFileStream,
  GoogleDriveNotConfiguredError,
  GoogleDriveOperationError,
} from "@/server/integrations/googleDrive";

/**
 * Brief section 8: "Public frontend dùng MediaImage(mediaId) ... mediaId →
 * database → provider file ID → media delivery." This is that last step —
 * the only place a raw Google Drive file id is ever used to fetch bytes.
 * Nothing upstream of this (public pages, `resolveMedia.ts`) ever sees or
 * stores a Drive URL; they only ever know a `MediaAsset.id`, which this
 * route resolves server-side. No session check: a published article's
 * images are public content, same as everything else `/tin-tuc/[slug]`
 * serves.
 */
export async function GET(request: Request, { params }: { params: Promise<{ mediaId: string }> }) {
  const { mediaId } = await params;
  const asset = await mediaRepository.findById(mediaId);
  if (!asset || asset.status !== "READY" || asset.provider !== "GOOGLE_DRIVE" || !asset.providerFileId) {
    return NextResponse.json({ error: "Không tìm thấy media." }, { status: 404 });
  }

  // A `MediaAsset` id's bytes never change in place — replacing an image
  // means a new Drive file and a new asset row, never mutating this one —
  // so the response is genuinely immutable. `immutable` stops browsers
  // re-fetching (or even revalidating) it on a normal reload; the ETag
  // catches hard-reloads and caches that ignore `immutable`, turning what
  // was a full multi-MB re-download into a ~0-byte 304.
  // `?w=` asks for a resized copy (see `imageVariants.ts` for why the widths
  // are a closed set). It is part of the identity of the response, so it has
  // to be part of the ETag too — otherwise a cached 320px copy would satisfy
  // a request for 1200px.
  const width = parseVariantWidth(new URL(request.url).searchParams.get("w"));
  const etag = `"${asset.id}${width ? `-w${width}` : ""}"`;
  const cacheHeaders = { "Cache-Control": "public, max-age=31536000, immutable", ETag: etag };
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: cacheHeaders });
  }

  try {
    const file = await getDriveFileStream(asset.providerFileId);

    if (width) {
      const source = Buffer.from(await new Response(Readable.toWeb(file.stream as unknown as Readable) as ReadableStream<Uint8Array>).arrayBuffer());
      const variant = await getImageVariant(asset.id, source, width);
      // A format sharp can't read (or a video) falls through to the original
      // bytes rather than failing the request.
      const body = variant ? variant.buffer : source;
      return new NextResponse(new Uint8Array(body), {
        status: 200,
        headers: {
          "Content-Type": variant ? variant.mimeType : file.mimeType,
          "Content-Length": String(body.byteLength),
          ...cacheHeaders,
        },
      });
    }

    const webStream = Readable.toWeb(file.stream as unknown as Readable) as ReadableStream<Uint8Array>;
    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        ...(file.size ? { "Content-Length": String(file.size) } : {}),
        ...cacheHeaders,
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
