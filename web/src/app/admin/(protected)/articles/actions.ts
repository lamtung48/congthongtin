"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/server/auth/session";
import { articleService } from "@/server/services/articleService";
import { hasPermission } from "@/server/auth/permissions";

/**
 * Every action re-fetches the article and calls the matching
 * `articleService` workflow method, which itself re-checks permission and
 * ownership (`docs/AUTHORIZATION.md`, "Server authorization") — this file
 * does no authorization logic of its own beyond `requireSession()` (is
 * *someone* logged in at all). Shared between `/admin/articles` (the list's
 * inline action buttons) and `/admin/articles/[id]/edit` (the sticky action
 * bar) — one workflow implementation, two entry points.
 */

export async function loadOr404(articleId: string) {
  const article = await articleService.getById(articleId);
  if (!article) throw new Error("Article not found.");
  return article;
}

/** Every workflow action can be triggered from either the list's inline
 *  buttons or the edit page's sticky action bar — revalidate both so
 *  whichever one the user is looking at reflects the new status
 *  immediately. */
function revalidateArticleViews(articleId: string) {
  revalidatePath("/admin/articles");
  revalidatePath(`/admin/articles/${articleId}/edit`);
}

/**
 * `<input type="datetime-local">` submits a bare "YYYY-MM-DDTHH:mm" with no
 * timezone info — `new Date(value)` would have the JS engine guess a
 * timezone (the server process's, not the editor's browser), exactly the
 * "phụ thuộc browser local time một cách mơ hồ" the brief warns against.
 * This app and its editors are Vietnam-based, so the value is instead
 * interpreted as Asia/Ho_Chi_Minh wall-clock time explicitly (UTC+7, no DST
 * in Vietnam) and converted to a real UTC instant — unambiguous regardless
 * of what timezone the Node process or the browser's OS happens to be set
 * to.
 */
function parseScheduledAtVietnamTime(localValue: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(localValue);
  if (!match) return new Date(NaN);
  const [, year, month, day, hour, minute] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour) - 7, Number(minute)));
}

export async function submitForReviewAction(formData: FormData): Promise<void> {
  const actor = await requireSession();
  const article = await loadOr404(String(formData.get("articleId")));
  await articleService.submitForReview(actor, article);
  revalidateArticleViews(article.id);
}

export async function approveAction(formData: FormData): Promise<void> {
  const actor = await requireSession();
  const article = await loadOr404(String(formData.get("articleId")));
  await articleService.approve(actor, article);
  revalidateArticleViews(article.id);
}

export async function returnForRevisionAction(formData: FormData): Promise<void> {
  const actor = await requireSession();
  const article = await loadOr404(String(formData.get("articleId")));
  const note = String(formData.get("note") ?? "").trim();
  await articleService.returnForRevision(actor, article, note);
  revalidateArticleViews(article.id);
}

export async function publishAction(formData: FormData): Promise<void> {
  const actor = await requireSession();
  const article = await loadOr404(String(formData.get("articleId")));
  await articleService.publish(actor, article);
  revalidateArticleViews(article.id);
}

export async function scheduleAction(formData: FormData): Promise<void> {
  const actor = await requireSession();
  const article = await loadOr404(String(formData.get("articleId")));
  const scheduledAt = parseScheduledAtVietnamTime(String(formData.get("scheduledAt")));
  await articleService.schedule(actor, article, scheduledAt);
  revalidateArticleViews(article.id);
}

export async function unpublishAction(formData: FormData): Promise<void> {
  const actor = await requireSession();
  const article = await loadOr404(String(formData.get("articleId")));
  await articleService.unpublish(actor, article);
  revalidateArticleViews(article.id);
}

export async function archiveAction(formData: FormData): Promise<void> {
  const actor = await requireSession();
  const article = await loadOr404(String(formData.get("articleId")));
  await articleService.archive(actor, article);
  revalidateArticleViews(article.id);
}

export async function restoreFromArchiveAction(formData: FormData): Promise<void> {
  const actor = await requireSession();
  const article = await loadOr404(String(formData.get("articleId")));
  await articleService.restoreFromArchive(actor, article);
  revalidateArticleViews(article.id);
}

export async function deleteArticleAction(formData: FormData): Promise<void> {
  const actor = await requireSession();
  const article = await loadOr404(String(formData.get("articleId")));
  if (!hasPermission(actor.role, "article.delete")) {
    throw new Error("Not authorized to delete articles.");
  }
  await articleService.remove(actor, article);
  revalidateArticleViews(article.id);
}
