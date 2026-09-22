import "server-only";
import sharp from "sharp";
import type { ImageFormat } from "@/server/validation/mediaUpload";

/**
 * Longest edge an uploaded image is downscaled to before it goes to Google
 * Drive. Only ever shrinks — an image already within this bound is stored
 * as-is. Nothing on the public site (article cover, hero, body image, OG)
 * needs more than this, and the raw phone/camera JPEGs editors paste in are
 * routinely 4–6 MB.
 */
export const MAX_IMAGE_EDGE = 1600;

export interface ProcessedImage {
  buffer: Buffer;
  /** Post-resize dimensions, or `null` when the file was passed through
   *  untouched (GIF) or sharp couldn't read it — caller falls back to the
   *  dimensions the upload validator already sniffed. */
  width: number | null;
  height: number | null;
  resized: boolean;
}

/**
 * Fit the image within `MAX_IMAGE_EDGE` (aspect ratio kept, never enlarged),
 * auto-orient from EXIF and then drop all metadata, and re-encode in the
 * same format. Animated GIFs are passed straight through — resizing them
 * safely is a separate concern and they're vanishingly rare here. Any sharp
 * failure also passes the original through, so a quirky-but-valid file can
 * never make an upload fail just at the processing step (validation already
 * ran on the original bytes before this).
 */
/**
 * Re-encodes an image the storage pipeline has no native format for into
 * WebP so it can still go through the normal validate → resize → Drive
 * path. The external-content collector needs this: Vietnamese news CDNs
 * serve article images as AVIF, which `sniffImageFormat` (deliberately a
 * short magic-byte allowlist, not a codec detector) does not accept.
 * Returns `null` when sharp cannot decode the bytes either — the caller then
 * lets validation reject them as it always would.
 */
export async function transcodeToWebp(input: Buffer): Promise<Buffer | null> {
  try {
    const out = await sharp(input, { failOn: "none" })
      .rotate()
      .resize(MAX_IMAGE_EDGE, MAX_IMAGE_EDGE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

export async function processImageForStorage(input: Buffer, format: ImageFormat): Promise<ProcessedImage> {
  if (format === "GIF") {
    return { buffer: input, width: null, height: null, resized: false };
  }

  try {
    const pipeline = sharp(input, { failOn: "none" });
    const meta = await pipeline.metadata();
    const longest = Math.max(meta.width ?? 0, meta.height ?? 0);

    if (!longest || longest <= MAX_IMAGE_EDGE) {
      return { buffer: input, width: meta.width ?? null, height: meta.height ?? null, resized: false };
    }

    let out = pipeline
      .rotate() // apply EXIF orientation, then the re-encode below drops the tag
      .resize(MAX_IMAGE_EDGE, MAX_IMAGE_EDGE, { fit: "inside", withoutEnlargement: true });

    if (format === "JPEG") out = out.jpeg({ quality: 82, mozjpeg: true });
    else if (format === "PNG") out = out.png({ compressionLevel: 9 });
    else if (format === "WEBP") out = out.webp({ quality: 82 });

    const { data, info } = await out.toBuffer({ resolveWithObject: true });
    return { buffer: data, width: info.width, height: info.height, resized: true };
  } catch {
    return { buffer: input, width: null, height: null, resized: false };
  }
}
