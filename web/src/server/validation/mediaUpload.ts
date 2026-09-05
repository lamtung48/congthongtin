/**
 * Brief section 9: "Validate: MIME; extension; size; image dimensions nếu
 * cần. Không tin filename." Deliberately does NOT use the `image-size` npm
 * package — an audit (`npm audit`) turned up two open, unpatched high-
 * severity DoS advisories in it (infinite loops in its ICNS/JXL/HEIF
 * parsers, https://github.com/advisories/GHSA-w3rx-r6r6-pgpr and
 * https://github.com/advisories/GHSA-5p2g-fcmc-qvqq), and that package picks
 * which parser to run by sniffing the buffer's own magic bytes — so a
 * client could label a malicious file "image/jpeg" and still reach the
 * vulnerable branch. This file re-implements dimension reading for exactly
 * the 4 formats this CMS accepts (JPEG/PNG/GIF/WEBP), each gated by first
 * confirming the buffer's own magic bytes match — nothing here ever hands
 * an unverified buffer to a format-sniffing library.
 */

export const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

const MIME_TO_EXTENSIONS: Record<AllowedImageMimeType, string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/gif": ["gif"],
};

/** 10 MiB — generous enough for a real editorial photo, small enough that a
 *  handful of concurrent uploads can't meaningfully strain the server's
 *  memory (every upload is buffered in memory end to end — see
 *  `googleDrive.ts`'s header comment on why nothing is streamed straight
 *  through). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export type ImageFormat = "JPEG" | "PNG" | "GIF" | "WEBP";

/** Confirms the buffer's own bytes are one of the 4 accepted formats —
 *  never trusts the `Content-Type`/extension the client sent. Returns
 *  `null` for anything else, including a well-formed image of a format
 *  this CMS doesn't accept (e.g. BMP, TIFF, SVG, ICNS, JXL, HEIF, AVIF). */
export function sniffImageFormat(buffer: Buffer): ImageFormat | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "JPEG";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "PNG";
  if (buffer.length >= 6 && (buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a")) return "GIF";
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "WEBP";
  }
  return null;
}

const FORMAT_TO_MIME: Record<ImageFormat, AllowedImageMimeType> = {
  JPEG: "image/jpeg",
  PNG: "image/png",
  GIF: "image/gif",
  WEBP: "image/webp",
};

export interface ImageDimensions {
  width: number;
  height: number;
}

function readPngDimensions(buffer: Buffer): ImageDimensions | null {
  // 8-byte signature, then the IHDR chunk is always first: 4-byte length,
  // 4-byte type "IHDR", then width/height as big-endian uint32 (spec:
  // https://www.w3.org/TR/png/#11IHDR).
  if (buffer.length < 24) return null;
  if (buffer.subarray(12, 16).toString("ascii") !== "IHDR") return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function readGifDimensions(buffer: Buffer): ImageDimensions | null {
  // 6-byte header, then the Logical Screen Descriptor's width/height as
  // little-endian uint16 (GIF89a spec, section 18).
  if (buffer.length < 10) return null;
  return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
}

function readJpegDimensions(buffer: Buffer): ImageDimensions | null {
  // Walk the marker segments looking for a Start-Of-Frame marker (0xC0-0xCF,
  // excluding 0xC4/0xC8/0xCC which aren't SOF) — its payload's first 5 bytes
  // are precision(1) + height(2 BE) + width(2 BE). Every other marker is
  // skipped by its own declared length. See ITU-T T.81, Annex B.
  let offset = 2; // past the SOI marker (0xFFD8)
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1; // resync past a stray fill byte
      continue;
    }
    let marker = buffer[offset + 1];
    let markerOffset = offset + 1;
    while (marker === 0xff && markerOffset + 1 < buffer.length) {
      markerOffset += 1;
      marker = buffer[markerOffset];
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset = markerOffset + 1;
      continue;
    }
    const segmentStart = markerOffset + 1;
    if (segmentStart + 2 > buffer.length) return null;
    const length = buffer.readUInt16BE(segmentStart);
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      if (segmentStart + 7 > buffer.length) return null;
      return { height: buffer.readUInt16BE(segmentStart + 3), width: buffer.readUInt16BE(segmentStart + 5) };
    }
    offset = segmentStart + length;
  }
  return null;
}

function readWebpDimensions(buffer: Buffer): ImageDimensions | null {
  // See https://developers.google.com/speed/webp/docs/riff_container —
  // dimensions live at a different offset/encoding per sub-format.
  if (buffer.length < 30) return null;
  const fourCc = buffer.subarray(12, 16).toString("ascii");
  if (fourCc === "VP8X") {
    // 24-bit little-endian width-1 / height-1 starting at byte 24.
    const width = (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16)) + 1;
    const height = (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16)) + 1;
    return { width, height };
  }
  if (fourCc === "VP8 ") {
    // Lossy: a 3-byte start code (0x9d 0x01 0x2a) at byte 23, then two
    // 16-bit little-endian fields whose low 14 bits are width/height.
    if (buffer.length < 30 || buffer[23] !== 0x9d || buffer[24] !== 0x01 || buffer[25] !== 0x2a) return null;
    const width = buffer.readUInt16LE(26) & 0x3fff;
    const height = buffer.readUInt16LE(28) & 0x3fff;
    return { width, height };
  }
  if (fourCc === "VP8L") {
    // Lossless: a 1-byte signature (0x2f) at byte 20, then 4 bytes packing
    // 14-bit (width-1) and 14-bit (height-1) little-endian.
    if (buffer[20] !== 0x2f) return null;
    const b0 = buffer[21];
    const b1 = buffer[22];
    const b2 = buffer[23];
    const b3 = buffer[24];
    const width = (((b1 & 0x3f) << 8) | b0) + 1;
    const height = ((b3 & 0x0f) << 10 | (b2 << 2) | (b1 >> 6)) + 1;
    return { width, height };
  }
  return null;
}

function readDimensions(buffer: Buffer, format: ImageFormat): ImageDimensions | null {
  switch (format) {
    case "PNG":
      return readPngDimensions(buffer);
    case "GIF":
      return readGifDimensions(buffer);
    case "JPEG":
      return readJpegDimensions(buffer);
    case "WEBP":
      return readWebpDimensions(buffer);
  }
}

export interface ValidatedUpload {
  format: ImageFormat;
  mimeType: AllowedImageMimeType;
  dimensions: ImageDimensions | null;
}

export type UploadValidationResult = { ok: true; value: ValidatedUpload } | { ok: false; error: string };

/** The one function every upload path (the Route Handler) calls before a
 *  byte reaches Google Drive. `declaredFilename` is used only to check its
 *  extension is plausible for the sniffed format — never trusted for a
 *  filesystem path, a Drive folder name, or anything logged verbatim (brief:
 *  "Không tin filename"). */
export function validateImageUpload(buffer: Buffer, declaredFilename: string): UploadValidationResult {
  if (buffer.length === 0) {
    return { ok: false, error: "Tệp rỗng." };
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    return { ok: false, error: `Tệp vượt quá giới hạn ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB.` };
  }
  const format = sniffImageFormat(buffer);
  if (!format) {
    return { ok: false, error: "Định dạng tệp không được hỗ trợ — chỉ chấp nhận JPEG, PNG, WEBP, GIF." };
  }
  const mimeType = FORMAT_TO_MIME[format];
  const extension = declaredFilename.split(".").pop()?.toLowerCase() ?? "";
  if (!MIME_TO_EXTENSIONS[mimeType].includes(extension)) {
    return { ok: false, error: `Đuôi tệp ".${extension || "?"}" không khớp với định dạng thực tế của tệp (${format}).` };
  }
  const dimensions = readDimensions(buffer, format);
  return { ok: true, value: { format, mimeType, dimensions } };
}

/** A Drive-stored filename derived from a random id, never the client-
 *  supplied name — the original name is kept only as display metadata
 *  (`MediaAsset.filename`). Guarantees a safe, collision-resistant name
 *  regardless of what a browser sends. */
export function buildStorageFilename(mediaId: string, format: ImageFormat): string {
  const ext = MIME_TO_EXTENSIONS[FORMAT_TO_MIME[format]][0];
  return `${mediaId}.${ext}`;
}
