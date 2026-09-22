"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/server/auth/session";
import { taxonomyService } from "@/server/services/taxonomyService";
import { slugify } from "@/lib/slug";

const CreateCategorySchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
});

export interface CreateCategoryFormState {
  error?: string;
}

export async function createCategoryAction(
  _prev: CreateCategoryFormState | undefined,
  formData: FormData,
): Promise<CreateCategoryFormState> {
  const actor = await requireSession();
  const parsed = CreateCategorySchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    return { error: "Vui lòng nhập tên chuyên mục." };
  }
  try {
    await taxonomyService.createCategory(actor, {
      slug: slugify(parsed.data.name),
      name: parsed.data.name,
      description: parsed.data.description,
    });
  } catch {
    return { error: "Không thể tạo chuyên mục." };
  }
  revalidatePath("/admin/categories");
  return {};
}

/**
 * Deletion goes through `taxonomyService.removeCategory`, which re-checks
 * `taxonomy.manage` and refuses anything still in use — this returns the
 * message rather than throwing so the row can show it inline instead of
 * replacing the page with an error boundary.
 */
export async function deleteCategoryAction(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const actor = await requireSession();
    await taxonomyService.removeCategory(actor, id);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Không thể xoá." };
  }
  revalidatePath("/admin/categories");
  revalidatePath("/", "layout");
  return { ok: true };
}
