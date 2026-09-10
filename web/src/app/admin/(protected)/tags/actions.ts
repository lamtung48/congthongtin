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

/**
 * Deletion goes through `taxonomyService.removeTag`, which re-checks
 * `taxonomy.manage` and refuses anything still in use — this returns the
 * message rather than throwing so the row can show it inline instead of
 * replacing the page with an error boundary.
 */
export async function deleteTagAction(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const actor = await requireSession();
    await taxonomyService.removeTag(actor, id);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Không thể xoá." };
  }
  revalidatePath("/admin/tags");
  revalidatePath("/", "layout");
  return { ok: true };
}
