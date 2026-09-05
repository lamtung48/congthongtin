/**
 * Brief section 9's validation discipline, applied to video the same way
 * `mediaUpload.ts` applies it to images: never trust the declared
 * `Content-Type`, sniff the buffer's own magic bytes first. No dimension/
 * duration reading here — unlike an image, a video's real metadata
 * (duration, thumbnail, processing status) comes back from the YouTube Data
 * API itself right after upload (`getVideoStatus` in
 * `src/server/integrations/youtube.ts`), so there's no reason to duplicate
 * container-format parsing for it locally.
 */

export const ALLOWED_VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"] as const;
export type AllowedVideoMimeType = (typeof ALLOWED_VIDEO_MIME_TYPES)[number];

const MIME_TO_EXTENSIONS: Record<AllowedVideoMimeType, string[]> = {
  "video/mp4": ["mp4", "m4v"],
  "video/quicktime": ["mov"],
  "video/webm": ["webm"],
  "video/x-msvideo": ["avi"],
};

/** 200 MiB. The whole file is buffered in memory end to end (see
 *  `googleDrive.ts`'s upload for why nothing here streams straight
 *  through Next's Route Handler) — generous enough for a short news clip,
 *  conservative enough that a handful of concurrent uploads can't exhaust
 *  server memory. A production deployment expecting longer-form video
 *  should move to a resumable/chunked upload path instead of raising this
 *  further — see docs/YOUTUBE_INTEGRATION.md, "Limitations". */
export const MAX_VIDEO_UPLOAD_BYTES = 200 * 1024 * 1024;

export type VideoFormat = "MP4" | "MOV" | "WEBM" | "AVI";

/** Confirms the buffer's own bytes are one of the 4 accepted containers —
 *  never trusts the client-declared MIME type. MP4 and MOV share the same
 *  ISO base media "ftyp" box; they're told apart by the major-brand field
 *  right after it (`"qt  "` for QuickTime, anything else defaults to MP4,
 *  since that's the overwhelming majority of what a browser/phone actually
 *  produces). */
export function sniffVideoFormat(buffer: Buffer): VideoFormat | null {
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return "WEBM";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "AVI ") return "AVI";
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buffer.subarray(8, 12).toString("ascii");
    return brand.trim() === "qt" ? "MOV" : "MP4";
  }
  return null;
}

const FORMAT_TO_MIME: Record<VideoFormat, AllowedVideoMimeType> = {
  MP4: "video/mp4",
  MOV: "video/quicktime",
  WEBM: "video/webm",
  AVI: "video/x-msvideo",
};

export interface ValidatedVideoUpload {
  format: VideoFormat;
  mimeType: AllowedVideoMimeType;
}

export type VideoUploadValidationResult = { ok: true; value: ValidatedVideoUpload } | { ok: false; error: string };

/** The one function every video upload path calls before a byte reaches
 *  YouTube. `declaredFilename` is used only to sanity-check its extension
 *  against the sniffed format — never trusted for anything else (brief:
 *  "Không tin filename"). */
export function validateVideoUpload(buffer: Buffer, declaredFilename: string): VideoUploadValidationResult {
  if (buffer.length === 0) {
    return { ok: false, error: "Tệp rỗng." };
  }
  if (buffer.length > MAX_VIDEO_UPLOAD_BYTES) {
    return { ok: false, error: `Tệp vượt quá giới hạn ${MAX_VIDEO_UPLOAD_BYTES / (1024 * 1024)}MB.` };
  }
  const format = sniffVideoFormat(buffer);
  if (!format) {
    return { ok: false, error: "Định dạng tệp không được hỗ trợ — chỉ chấp nhận MP4, MOV, WEBM, AVI." };
  }
  const mimeType = FORMAT_TO_MIME[format];
  const extension = declaredFilename.split(".").pop()?.toLowerCase() ?? "";
  if (!MIME_TO_EXTENSIONS[mimeType].includes(extension)) {
    return { ok: false, error: `Đuôi tệp ".${extension || "?"}" không khớp với định dạng thực tế của tệp (${format}).` };
  }
  return { ok: true, value: { format, mimeType } };
}
