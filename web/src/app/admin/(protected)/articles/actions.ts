"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/server/auth/session";
import { articleService } from "@/server/services/articleService";
import { hasPermission } from "@/server/auth/permissions";
import { slugify } from "@/lib/slug";

/**
 * Every action re-fetches the article and calls the matching
 * `articleService` workflow method, which itself re-checks permission and
 * ownership (`docs/AUTHORIZATION.md`, "Server authorization") — this file
 * does no authorization logic of its own beyond `requireSession()` (is
 * *someone* logged in at all).
 */

async function loadOr404(articleId: string) {
  const article = await articleService.getById(articleId);
  if (!article) throw new Error("Article not found.");
  return article;
}

const CreateArticleSchema = z.object({
  title: z.string().trim().min(1),
  categoryId: z.string().min(1),
  excerpt: z.string().trim().optional(),
});

export interface CreateArticleFormState {
  error?: string;
}

export async function createArticleAction(_prev: CreateArticleFormState | undefined, formData: FormData): Promise<CreateArticleFormState> {
  const actor = await requireSession();
  const parsed = CreateArticleSchema.safeParse({
    title: formData.get("title"),
    categoryId: formData.get("categoryId"),
    excerpt: formData.get("excerpt") || undefined,
  });
  if (!parsed.success) {
    return { error: "Vui lòng nhập tiêu đề và chọn chuyên mục." };
  }
  try {
    await articleService.create(actor, {
      data: {
        slug: `${slugify(parsed.data.title)}-${Math.random().toString(36).slice(2, 7)}`,
        title: parsed.data.title,
        excerpt: parsed.data.excerpt,
        category: { connect: { id: parsed.data.categoryId } },
      },
      blocks: [],
    });
  } catch {
    return { error: "Không thể tạo bài viết." };
  }
  revalidatePath("/admin/articles");
  return {};
}

export async function submitForReviewAction(formData: FormData): Promise<void> {
  const actor = await requireSession();
  const article = await loadOr404(String(formData.get("articleId")));
  await articleService.submitForReview(actor, article);
  revalidatePath("/admin/articles");
}

export async function approveAction(formData: FormData): Promise<void> {
  const actor = await requireSession();
  const article = await loadOr404(String(formData.get("articleId")));
  await articleService.approve(actor, article);
  revalidatePath("/admin/articles");
}

export async function returnForRevisionAction(formData: FormData): Promise<void> {
  const actor = await requireSession();
  const article = await loadOr404(String(formData.get("articleId")));
  const note = String(formData.get("note") ?? "").trim() || "Vui lòng chỉnh sửa lại theo góp ý.";
  await articleService.returnForRevision(actor, article, note);
  revalidatePath("/admin/articles");
}

export async function publishAction(formData: FormData): Promise<void> {
  const actor = await requireSession();
  const article = await loadOr404(String(formData.get("articleId")));
  await articleService.publish(actor, article);
  revalidatePath("/admin/articles");
}

export async function scheduleAction(formData: FormData): Promise<void> {
  const actor = await requireSession();
  const article = await loadOr404(String(formData.get("articleId")));
  const scheduledAt = new Date(String(formData.get("scheduledAt")));
  await articleService.schedule(actor, article, scheduledAt);
  revalidatePath("/admin/articles");
}

export async function unpublishAction(formData: FormData): Promise<void> {
  const actor = await requireSession();
  const article = await loadOr404(String(formData.get("articleId")));
  await articleService.unpublish(actor, article);
  revalidatePath("/admin/articles");
}

export async function deleteArticleAction(formData: FormData): Promise<void> {
  const actor = await requireSession();
  const article = await loadOr404(String(formData.get("articleId")));
  if (!hasPermission(actor.role, "article.delete")) {
    throw new Error("Not authorized to delete articles.");
  }
  await articleService.remove(actor, article);
  revalidatePath("/admin/articles");
}
