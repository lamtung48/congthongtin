/**
 * Validation for the document uploader, in the same spirit as
 * `mediaUpload.ts`'s image checks: never trust the client's `Content-Type`
 * or filename, confirm the buffer's own magic bytes first.
 *
 * The honest limit of what byte-sniffing can prove here is worth stating.
 * `.docx`, `.xlsx` and `.pptx` are all ZIP archives with the identical
 * `PK\x03\x04` signature, and `.doc`, `.xls` and `.ppt` are all OLE2
 * compound files with the identical `D0CF11E0` signature — telling them
 * apart needs a real archive/OLE parser, which is exactly the kind of
 * format-sniffing dependency `mediaUpload.ts` refused to take on for images.
 *
 * So this checks two things instead of pretending to check one: the bytes
 * must be one of three recognised container families (PDF / OOXML zip /
 * legacy OLE2), **and** the claimed extension must belong to that family.
 * A `.docx` full of spreadsheet data still passes — but a `.docx` that is
 * really an executable, a script, or an HTML page does not, and that is the
 * property that matters, because the served MIME type is derived from this
 * allowlist rather than from anything the uploader said.
 */

import { DOCUMENT_EXTENSIONS, MAX_DOCUMENT_BYTES, type DocumentExtension } from "@/lib/media/documentFormats";

export { DOCUMENT_EXTENSIONS, MAX_DOCUMENT_BYTES };
export type { DocumentExtension };

const EXTENSION_TO_MIME: Record<DocumentExtension, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

type Container = "PDF" | "OOXML" | "OLE2";

const EXTENSION_TO_CONTAINER: Record<DocumentExtension, Container> = {
  pdf: "PDF",
  docx: "OOXML",
  xlsx: "OOXML",
  pptx: "OOXML",
  doc: "OLE2",
  xls: "OLE2",
  ppt: "OLE2",
};

/** Reads the container family from the buffer's own leading bytes. `null`
 *  for anything this app does not accept — including a perfectly valid file
 *  of some other type (RTF, ODT, plain ZIP, an image, an executable). */
export function sniffDocumentContainer(buffer: Buffer): Container | null {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-") return "PDF";
  // Local file header of a ZIP archive — every OOXML file starts with one.
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) return "OOXML";
  // OLE2 / Compound File Binary Format — pre-2007 Office documents.
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
  ) {
    return "OLE2";
  }
  return null;
}

export function documentExtensionOf(filename: string): DocumentExtension | null {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  return (DOCUMENT_EXTENSIONS as readonly string[]).includes(ext) ? (ext as DocumentExtension) : null;
}

export type DocumentValidation =
  | { ok: true; value: { extension: DocumentExtension; mimeType: string } }
  | { ok: false; error: string };

export function validateDocumentUpload(buffer: Buffer, originalName: string): DocumentValidation {
  if (buffer.length === 0) return { ok: false, error: "Tệp rỗng." };
  if (buffer.length > MAX_DOCUMENT_BYTES) {
    return { ok: false, error: `Tệp vượt quá ${Math.round(MAX_DOCUMENT_BYTES / (1024 * 1024))} MB.` };
  }

  const extension = documentExtensionOf(originalName);
  if (!extension) {
    return { ok: false, error: `Chỉ nhận các định dạng: ${DOCUMENT_EXTENSIONS.join(", ").toUpperCase()}.` };
  }

  const container = sniffDocumentContainer(buffer);
  if (!container) {
    return { ok: false, error: "Nội dung tệp không phải PDF hay tài liệu Office." };
  }
  if (container !== EXTENSION_TO_CONTAINER[extension]) {
    return { ok: false, error: `Nội dung tệp không khớp với đuôi .${extension}.` };
  }

  return { ok: true, value: { extension, mimeType: EXTENSION_TO_MIME[extension] } };
}

/** Storage name for Drive — never the raw client filename. */
export function buildDocumentStorageFilename(uuid: string, extension: DocumentExtension, slugHint?: string): string {
  return slugHint ? `${slugHint}-${uuid}.${extension}` : `${uuid}.${extension}`;
}
