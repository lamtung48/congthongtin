import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { mediaRepository } from "@/server/repositories/mediaRepository";
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
export async function GET(_request: Request, { params }: { params: Promise<{ mediaId: string }> }) {
  const { mediaId } = await params;
  const asset = await mediaRepository.findById(mediaId);
  if (!asset || asset.status !== "READY" || asset.provider !== "GOOGLE_DRIVE" || !asset.providerFileId) {
    return NextResponse.json({ error: "Không tìm thấy media." }, { status: 404 });
  }

  try {
    const file = await getDriveFileStream(asset.providerFileId);
    const webStream = Readable.toWeb(file.stream as unknown as Readable) as ReadableStream<Uint8Array>;
    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        ...(file.size ? { "Content-Length": String(file.size) } : {}),
        // A given `MediaAsset` id's bytes never change in place — replacing
        // an image means uploading a new Drive file and a new asset row, not
        // mutating this one — so a long, cache-friendly lifetime is safe.
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
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
