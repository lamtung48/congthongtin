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
