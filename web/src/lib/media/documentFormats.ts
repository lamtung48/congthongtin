/**
 * The two facts about document uploads the browser also needs — the accepted
 * extensions (for the file picker's `accept` and the help text) and the size
 * cap (to say the number out loud).
 *
 * Split out of `server/validation/documentUpload.ts` for the same reason
 * `variantWidths.ts` was split out of the image pipeline: that module does
 * magic-byte checks on a `Buffer` and must never be pulled into a client
 * bundle. The server module imports these constants from here, so the two
 * cannot drift.
 */
export const DOCUMENT_EXTENSIONS = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"] as const;
export type DocumentExtension = (typeof DOCUMENT_EXTENSIONS)[number];

/** 25 MiB — a scanned công văn PDF routinely runs to a few dozen pages, and
 *  unlike an image there is no downscaling step afterwards. Every upload is
 *  buffered in memory end to end, so this is also the per-request cost. */
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
