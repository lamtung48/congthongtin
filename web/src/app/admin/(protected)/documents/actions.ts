"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/server/auth/session";
import { documentService, type DocumentInput } from "@/server/services/documentService";

/**
 * `documentService` re-checks `document.manage` itself, so nothing here does
 * authorization beyond `requireSession()`. Every action returns a result
 * object rather than throwing: "cần tải lên một tệp hoặc dán một đường dẫn"
 * is ordinary form feedback, not a crash.
 */

type Result = { ok: true } | { ok: false; error: string };

function fail(err: unknown): Result {
  return { ok: false, error: err instanceof Error ? err.message : "Thao tác không thành công." };
}

function revalidateDocumentViews() {
  revalidatePath("/admin/documents");
  revalidatePath("/tai-lieu");
  // The homepage's "Tài liệu" section reads the newest few.
  revalidatePath("/", "layout");
}

function readInput(formData: FormData): DocumentInput {
  const str = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" ? v : undefined;
  };
  return {
    title: str("title") ?? "",
    description: str("description"),
    documentNumber: str("documentNumber"),
    issuedAt: str("issuedAt"),
    labelId: str("labelId"),
    mediaId: str("mediaId"),
    externalUrl: str("externalUrl"),
    // A cleared checkbox sends nothing at all, so presence is the signal —
    // reading its value would make "unchecked" indistinguishable from
    // "checked" and silently publish everything.
    isPublished: formData.has("isPublished"),
  };
}

export async function createDocumentAction(formData: FormData): Promise<Result> {
  try {
    const actor = await requireSession();
    await documentService.create(actor, readInput(formData));
  } catch (err) {
    return fail(err);
  }
  revalidateDocumentViews();
  return { ok: true };
}

export async function updateDocumentAction(id: string, formData: FormData): Promise<Result> {
  try {
    const actor = await requireSession();
    await documentService.update(actor, id, readInput(formData));
  } catch (err) {
    return fail(err);
  }
  revalidateDocumentViews();
  return { ok: true };
}

export async function toggleDocumentPublishedAction(id: string, isPublished: boolean): Promise<Result> {
  try {
    const actor = await requireSession();
    await documentService.setPublished(actor, id, isPublished);
  } catch (err) {
    return fail(err);
  }
  revalidateDocumentViews();
  return { ok: true };
}

export async function deleteDocumentAction(id: string): Promise<Result> {
  try {
    const actor = await requireSession();
    await documentService.remove(actor, id);
  } catch (err) {
    return fail(err);
  }
  revalidateDocumentViews();
  return { ok: true };
}

export async function createDocumentLabelAction(name: string): Promise<Result & { id?: string }> {
  try {
    const actor = await requireSession();
    const label = await documentService.createLabel(actor, name);
    revalidateDocumentViews();
    return { ok: true, id: label.id };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteDocumentLabelAction(id: string): Promise<Result> {
  try {
    const actor = await requireSession();
    await documentService.removeLabel(actor, id);
  } catch (err) {
    return fail(err);
  }
  revalidateDocumentViews();
  return { ok: true };
}
