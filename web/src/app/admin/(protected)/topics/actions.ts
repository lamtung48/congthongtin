"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/server/auth/session";
import { taxonomyService } from "@/server/services/taxonomyService";
import { slugify } from "@/lib/slug";

const CreateTopicSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
});

export interface CreateTopicFormState {
  error?: string;
}

export async function createTopicAction(
  _prev: CreateTopicFormState | undefined,
  formData: FormData,
): Promise<CreateTopicFormState> {
  const actor = await requireSession();
  const parsed = CreateTopicSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    return { error: "Vui lòng nhập tên chủ đề." };
  }
  try {
    await taxonomyService.createTopic(actor, {
      slug: slugify(parsed.data.name),
      name: parsed.data.name,
      description: parsed.data.description,
    });
  } catch {
    return { error: "Không thể tạo chủ đề." };
  }
  revalidatePath("/admin/topics");
  return {};
}
