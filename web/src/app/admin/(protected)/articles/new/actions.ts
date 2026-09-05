"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/server/auth/session";
import { articleService } from "@/server/services/articleService";
import { slugify } from "@/lib/slug";

/**
 * Brief section 4: the CMS's "Tạo bài" screen needs every field (Sapo, Chủ
 * đề, Tags, Tác giả, Đơn vị, Địa phương, Ảnh cover, Nội dung, SEO) — but
 * `autosaveDraft`/`update` (the block editor, taxonomy pickers, ...) only
 * work on an article that already has an id. So "Tạo bài" here creates the
 * minimal DRAFT (title + category, the two fields nothing else can be
 * chosen without) and immediately hands off to `/admin/articles/[id]/edit`,
 * which is where every other field actually lives — one form for "start a
 * new article", one form (already built, `ArticleEditor`) for everything
 * else, rather than one giant form trying to do both at once.
 */
const CreateDraftSchema = z.object({
  title: z.string().trim().min(1),
  categoryId: z.string().min(1),
});

export interface CreateDraftFormState {
  error?: string;
}

export async function createDraftAction(_prev: CreateDraftFormState | undefined, formData: FormData): Promise<CreateDraftFormState> {
  const actor = await requireSession();
  const parsed = CreateDraftSchema.safeParse({
    title: formData.get("title"),
    categoryId: formData.get("categoryId"),
  });
  if (!parsed.success) {
    return { error: "Vui lòng nhập tiêu đề và chọn chuyên mục." };
  }

  let articleId: string;
  try {
    const article = await articleService.create(actor, {
      fields: {
        slug: `${slugify(parsed.data.title)}-${Math.random().toString(36).slice(2, 7)}`,
        title: parsed.data.title,
        categoryId: parsed.data.categoryId,
      },
    });
    if (!article) throw new Error("Article creation returned no result.");
    articleId = article.id;
  } catch {
    return { error: "Không thể tạo bài viết." };
  }
  redirect(`/admin/articles/${articleId}/edit`);
}
