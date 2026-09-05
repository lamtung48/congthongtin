"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/server/auth/session";
import { articleService, type ArticleFieldsInput, type ArticleBlockInput } from "@/server/services/articleService";
import type { EditorBlock } from "./BlockEditor";

/** `EditorBlock[]` (client state, order = array index) -> `ArticleBlockInput[]`
 *  (what `articleService` expects) — the one place that conversion happens,
 *  shared by autosave and the explicit "Lưu" action so they can never drift
 *  into building the array shape differently. */
function toBlockInputs(blocks: EditorBlock[]): ArticleBlockInput[] {
  return blocks.map((b, order) => ({ type: b.type, order, data: b.data }));
}

export interface EditorFormPayload {
  fields: ArticleFieldsInput;
  blocks: EditorBlock[];
}

export interface EditorActionResult {
  ok: boolean;
  error?: string;
  updatedAt?: string;
}

async function loadOr404(articleId: string) {
  const article = await articleService.getById(articleId);
  if (!article) throw new Error("Article not found.");
  return article;
}

/** Brief section 6: silent, throttled (the client debounces — this action
 *  itself doesn't rate-limit, that's `ArticleEditor`'s job), DRAFT-only,
 *  no revision/audit noise. Returns `{ok:false}` instead of throwing for
 *  the routine "not a DRAFT anymore" case (e.g. two tabs open, one just
 *  submitted it) so the editor can show "Lỗi lưu" without an unhandled
 *  rejection. */
export async function autosaveAction(articleId: string, payload: EditorFormPayload): Promise<EditorActionResult> {
  try {
    const actor = await requireSession();
    const article = await loadOr404(articleId);
    const updated = await articleService.autosaveDraft(actor, article, { fields: payload.fields, blocks: toBlockInputs(payload.blocks) });
    return { ok: true, updatedAt: updated?.updatedAt.toISOString() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Lỗi tự động lưu." };
  }
}

/** The explicit "Lưu" button — always allowed to run regardless of status
 *  (unlike autosave), because Manager/Admin edit non-DRAFT articles too
 *  (see `assertCanEdit`'s comment in `articleService.ts`); creates a
 *  revision snapshot and an audit entry, unlike autosave. */
export async function saveAction(articleId: string, payload: EditorFormPayload): Promise<EditorActionResult> {
  try {
    const actor = await requireSession();
    const article = await loadOr404(articleId);
    const updated = await articleService.update(actor, article, { fields: payload.fields, blocks: toBlockInputs(payload.blocks) });
    revalidatePath("/admin/articles");
    return { ok: true, updatedAt: updated?.updatedAt.toISOString() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Không thể lưu bài viết." };
  }
}

export async function restoreRevisionAction(formData: FormData): Promise<void> {
  const actor = await requireSession();
  const article = await loadOr404(String(formData.get("articleId")));
  const version = Number(formData.get("version"));
  await articleService.restoreRevision(actor, article, version);
  revalidatePath(`/admin/articles/${article.id}/edit`);
}
