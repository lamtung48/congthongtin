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

/**
 * Deletion goes through `taxonomyService.removeTopic`, which re-checks
 * `taxonomy.manage` and refuses anything still in use — this returns the
 * message rather than throwing so the row can show it inline instead of
 * replacing the page with an error boundary.
 */
export async function deleteTopicAction(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const actor = await requireSession();
    await taxonomyService.removeTopic(actor, id);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Không thể xoá." };
  }
  revalidatePath("/admin/topics");
  revalidatePath("/", "layout");
  return { ok: true };
}
