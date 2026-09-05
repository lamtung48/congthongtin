"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/server/auth/session";
import { taxonomyService } from "@/server/services/taxonomyService";
import { slugify } from "@/lib/slug";

const CreateTagSchema = z.object({
  name: z.string().trim().min(1),
});

export interface CreateTagFormState {
  error?: string;
}

export async function createTagAction(
  _prev: CreateTagFormState | undefined,
  formData: FormData,
): Promise<CreateTagFormState> {
  const actor = await requireSession();
  const parsed = CreateTagSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: "Vui lòng nhập tên tag." };
  }
  try {
    await taxonomyService.createTag(actor, { slug: slugify(parsed.data.name), name: parsed.data.name });
  } catch {
    return { error: "Không thể tạo tag." };
  }
  revalidatePath("/admin/tags");
  return {};
}
