import { documentRepository, type DocumentFilter, type DocumentWithRelations } from "@/server/repositories/documentRepository";
import { auditLogRepository } from "@/server/repositories/auditLogRepository";
import { mediaService } from "@/server/services/mediaService";
import { hasPermission } from "@/server/auth/permissions";
import { slugify } from "@/lib/slug";
import type { SessionUser } from "@/server/auth/session";

/**
 * "Tài liệu" — văn bản điều hành published for download.
 *
 * A document's content lives in exactly one of two places, and the choice is
 * enforced here rather than in the schema (Prisma cannot express "exactly one
 * of these two columns"):
 *
 *  - an **uploaded file**, which went through `/api/admin/documents/upload`
 *    into Google Drive and is served back through `/api/tai-lieu/[id]`, so
 *    the Drive file id is never exposed and an unpublished document is never
 *    downloadable; or
 *  - an **external link** (typically a Drive share URL), opened directly.
 *
 * Accepting both, or neither, is rejected: "neither" is a card with nothing
 * behind it, and "both" leaves no honest answer to what the download button
 * should do.
 */

function assertCanManage(actor: SessionUser) {
  if (!hasPermission(actor.role, "document.manage")) {
    throw new Error(`Role ${actor.role} lacks permission "document.manage".`);
  }
}

/** http(s) only. A `javascript:` or `data:` URL in an admin-supplied field
 *  would become a stored XSS the moment it is rendered as an `<a href>`. */
function normalizeExternalUrl(raw: string | undefined | null): string | null {
  const value = raw?.trim();
  if (!value) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Đường dẫn không hợp lệ. Ví dụ: https://drive.google.com/…");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Đường dẫn phải bắt đầu bằng http:// hoặc https://");
  }
  return parsed.toString();
}

export interface DocumentInput {
  title: string;
  description?: string;
  documentNumber?: string;
  issuedAt?: string;
  labelId?: string;
  mediaId?: string;
  externalUrl?: string;
  isPublished?: boolean;
}

function parseIssuedAt(raw: string | undefined): Date | null {
  if (!raw?.trim()) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new Error("Ngày ban hành không hợp lệ.");
  return d;
}

function normalizeInput(input: DocumentInput) {
  const title = input.title?.trim();
  if (!title) throw new Error("Vui lòng nhập tên tài liệu.");

  const mediaId = input.mediaId?.trim() || null;
  const externalUrl = normalizeExternalUrl(input.externalUrl);
  if (!mediaId && !externalUrl) {
    throw new Error("Cần tải lên một tệp hoặc dán một đường dẫn.");
  }
  if (mediaId && externalUrl) {
    throw new Error("Chỉ chọn một trong hai: tải tệp lên hoặc dán đường dẫn.");
  }

  return {
    title,
    description: input.description?.trim() || null,
    documentNumber: input.documentNumber?.trim() || null,
    issuedAt: parseIssuedAt(input.issuedAt),
    labelId: input.labelId?.trim() || null,
    mediaId,
    externalUrl,
    isPublished: input.isPublished ?? true,
  };
}

/**
 * What a public page needs, with the "where do the bytes come from" decision
 * already made — a component should never have to know that `mediaId` means
 * one URL shape and `externalUrl` another.
 */
export interface PublicDocument {
  id: string;
  title: string;
  description: string | null;
  documentNumber: string | null;
  issuedAt: string | null;
  labelName: string | null;
  labelSlug: string | null;
  /** Site-relative for an upload, absolute for an external link. */
  downloadUrl: string;
  /** Short badge text: the file extension for an upload, "LINK" otherwise. */
  kindLabel: string;
}

function toPublic(d: DocumentWithRelations): PublicDocument | null {
  const downloadUrl = d.media ? `/api/tai-lieu/${d.id}` : d.externalUrl;
  // A row with neither is unreachable content; `normalizeInput` prevents it
  // being created, and dropping it here means a stray one never renders as a
  // card that does nothing when clicked.
  if (!downloadUrl) return null;
  const extension = d.media?.filename?.toLowerCase().split(".").pop();
  return {
    id: d.id,
    title: d.title,
    description: d.description,
    documentNumber: d.documentNumber,
    issuedAt: d.issuedAt ? d.issuedAt.toISOString() : null,
    labelName: d.label?.name ?? null,
    labelSlug: d.label?.slug ?? null,
    downloadUrl,
    kindLabel: d.media ? (extension ?? "TỆP").toUpperCase() : "LINK",
  };
}

export const documentService = {
  list: documentRepository.list,
  count: documentRepository.count,
  findById: documentRepository.findById,
  listLabels: documentRepository.listLabels,
  listLabelsWithUsage: documentRepository.listLabelsWithUsage,

  /** What the public site reads — never anything unpublished. */
  async listPublic(filter: Omit<DocumentFilter, "publishedOnly"> = {}): Promise<PublicDocument[]> {
    const rows = await documentRepository.list({ ...filter, publishedOnly: true });
    return rows.map(toPublic).filter((d): d is PublicDocument => d !== null);
  },
  countPublic(filter: Omit<DocumentFilter, "publishedOnly"> = {}) {
    return documentRepository.count({ ...filter, publishedOnly: true });
  },

  async create(actor: SessionUser, input: DocumentInput) {
    assertCanManage(actor);
    const fields = normalizeInput(input);
    // Random suffix for the same reason article slugs carry one: two "Kế
    // hoạch công tác Đoàn" in different years must not collide on a unique
    // column and fail the save.
    const slug = `${slugify(fields.title).slice(0, 80).replace(/-+$/, "") || "tai-lieu"}-${Math.random().toString(36).slice(2, 7)}`;
    const document = await documentRepository.create({ ...fields, slug, createdById: actor.id });
    await auditLogRepository.record({
      actorId: actor.id,
      action: "CREATE",
      entityType: "Document",
      entityId: document.id,
      metadata: { title: fields.title, hasFile: Boolean(fields.mediaId) },
    });
    return document;
  },

  async update(actor: SessionUser, id: string, input: DocumentInput) {
    assertCanManage(actor);
    const existing = await documentRepository.findById(id);
    if (!existing) throw new Error("Tài liệu không tồn tại.");
    const fields = normalizeInput(input);
    const document = await documentRepository.update(id, fields);
    await auditLogRepository.record({ actorId: actor.id, action: "UPDATE", entityType: "Document", entityId: id });
    return document;
  },

  async setPublished(actor: SessionUser, id: string, isPublished: boolean) {
    assertCanManage(actor);
    const document = await documentRepository.update(id, { isPublished });
    await auditLogRepository.record({
      actorId: actor.id,
      action: isPublished ? "PUBLISH" : "UNPUBLISH",
      entityType: "Document",
      entityId: id,
    });
    return document;
  },

  /**
   * Deletes the record and, when the document was an upload, the Drive file
   * behind it — leaving the file would orphan bytes nothing can ever reach
   * again, since `/api/tai-lieu/[id]` is the only way to read it. An
   * external-link document has nothing of ours to clean up.
   */
  async remove(actor: SessionUser, id: string) {
    assertCanManage(actor);
    const existing = await documentRepository.findById(id);
    if (!existing) throw new Error("Tài liệu không tồn tại.");
    await documentRepository.remove(id);
    if (existing.mediaId) {
      // Never let a Drive hiccup leave the record half-deleted: the row is
      // already gone, and an orphan Drive file is recoverable by hand.
      await mediaService.remove(actor, existing.mediaId).catch((err) => {
        console.warn(`[documentService] không xoá được tệp Drive của tài liệu ${id}:`, err);
      });
    }
    await auditLogRepository.record({
      actorId: actor.id,
      action: "DELETE",
      entityType: "Document",
      entityId: id,
      metadata: { title: existing.title },
    });
  },

  /** Adding a label is the point of having a table instead of an enum — an
   *  editor filing a kind of văn bản nobody anticipated should not need a
   *  migration. */
  async createLabel(actor: SessionUser, name: string) {
    assertCanManage(actor);
    const trimmed = name?.trim();
    if (!trimmed) throw new Error("Vui lòng nhập tên nhãn.");
    const slug = slugify(trimmed).slice(0, 60).replace(/-+$/, "");
    if (!slug) throw new Error("Tên nhãn không hợp lệ.");
    const existing = await documentRepository.listLabels();
    if (existing.some((l) => l.slug === slug)) throw new Error(`Nhãn "${trimmed}" đã có.`);
    const label = await documentRepository.createLabel({ slug, name: trimmed, order: await documentRepository.nextLabelOrder() });
    await auditLogRepository.record({ actorId: actor.id, action: "CREATE", entityType: "DocumentLabel", entityId: label.id, metadata: { name: trimmed } });
    return label;
  },

  /** A label still in use is deleted, not blocked: `Document.labelId` is
   *  nullable with `ON DELETE SET NULL`, so the documents survive and simply
   *  become unfiled. The admin UI shows the count before asking. */
  async removeLabel(actor: SessionUser, id: string) {
    assertCanManage(actor);
    const label = await documentRepository.findLabelById(id);
    if (!label) throw new Error("Nhãn không tồn tại.");
    await documentRepository.deleteLabel(id);
    await auditLogRepository.record({
      actorId: actor.id,
      action: "DELETE",
      entityType: "DocumentLabel",
      entityId: id,
      metadata: { name: label.name, unfiledDocuments: label._count.documents },
    });
  },
};
