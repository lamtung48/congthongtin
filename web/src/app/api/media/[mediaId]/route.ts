import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { mediaRepository } from "@/server/repositories/mediaRepository";
import { getImageVariant, parseVariantWidth } from "@/server/media/imageVariants";
import { mediaCache, MEDIA_CACHE_MAX_ENTRY_BYTES } from "@/server/media/mediaCache";
import {
  getDriveFileContent,
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
 *
 * Delivery path (see `mediaCache.ts` for the why): the response bytes are
 * looked up in a shared cache — an in-process LRU backed by a disk volume
 * that survives redeploys — *before* Google Drive is touched. A hit is
 * ~1ms; only a genuine miss pays the ~1.5–4s Drive round trip, and it then
 * populates the cache for everyone. The MIME type comes from the
 * `MediaAsset` row (stored at upload), so a miss is a single `files.get`,
 * not the metadata + content pair it used to be.
 */
export async function GET(request: Request, { params }: { params: Promise<{ mediaId: string }> }) {
  const { mediaId } = await params;
  const asset = await mediaRepository.findById(mediaId);
  if (!asset || asset.status !== "READY" || asset.provider !== "GOOGLE_DRIVE" || !asset.providerFileId) {
    return NextResponse.json({ error: "Không tìm thấy media." }, { status: 404 });
  }

  // `?w=` asks for a resized copy (see `imageVariants.ts` for why the widths
  // are a closed set). It is part of the identity of the response, so it is
  // part of the ETag and the cache key too — otherwise a cached 320px copy
  // would satisfy a request for 1200px.
  const width = parseVariantWidth(new URL(request.url).searchParams.get("w"));

  // A `MediaAsset` id's bytes never change in place — replacing an image
  // means a new Drive file and a new asset row — so the response is
  // genuinely immutable. `immutable` stops browsers re-fetching (or even
  // revalidating) it on a normal reload; the ETag turns a hard-reload into
  // a ~0-byte 304 instead of a multi-MB re-download.
  const etag = `"${asset.id}${width ? `-w${width}` : ""}"`;
  const cacheHeaders = { "Cache-Control": "public, max-age=31536000, immutable", ETag: etag };
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: cacheHeaders });
  }

  const cacheKey = width ? `${asset.id}@w${width}` : asset.id;
  const baseType = asset.mimeType || "application/octet-stream";

  // Shared cache (memory + disk volume), consulted BEFORE Google Drive.
  const cached = await mediaCache.get(cacheKey);
  if (cached) return bodyResponse(cached.buffer, cached.contentType, cacheHeaders);

  let content;
  try {
    content = await getDriveFileContent(asset.providerFileId);
  } catch (err) {
    if (err instanceof GoogleDriveNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof GoogleDriveOperationError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    throw err;
  }

  const webStream = () => Readable.toWeb(content.stream as unknown as Readable) as ReadableStream<Uint8Array>;

  // A large un-resized original (a legacy upload from before the resize step)
  // asked for at full size is too big to cache and not worth buffering —
  // stream it straight through, the old behaviour.
  if (!width && content.size && content.size > MEDIA_CACHE_MAX_ENTRY_BYTES) {
    return new NextResponse(webStream(), {
      status: 200,
      headers: { "Content-Type": baseType, "Content-Length": String(content.size), ...cacheHeaders },
    });
  }

  const original = Buffer.from(await new Response(webStream()).arrayBuffer());

  if (width) {
    // A format sharp can't read (or a video) falls through to the original
    // bytes rather than failing the request.
    const variant = await getImageVariant(original, width);
    const body = variant ? variant.buffer : original;
    const type = variant ? variant.mimeType : baseType;
    void mediaCache.set(cacheKey, body, type);
    return bodyResponse(body, type, cacheHeaders);
  }

  void mediaCache.set(cacheKey, original, baseType);
  return bodyResponse(original, baseType, cacheHeaders);
}

function bodyResponse(body: Buffer, contentType: string, cacheHeaders: Record<string, string>) {
  return new NextResponse(new Uint8Array(body), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(body.byteLength),
      ...cacheHeaders,
    },
  });
}
