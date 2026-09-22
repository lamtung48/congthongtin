"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/server/auth/session";
import { siteAppearanceService } from "@/server/services/siteAppearanceService";

/**
 * `siteAppearanceService` re-checks `system.configure` itself, so this file
 * does no authorization of its own beyond `requireSession()` — same split as
 * every other action module here.
 *
 * Returns a result object instead of throwing: the editor is an interactive
 * client component that shows the failure inline (an unreadable colour is a
 * normal thing for an admin to try), not a form that can afford to blow up
 * into an error boundary.
 */
export async function saveBackgroundAction(
  hex: string,
): Promise<{ ok: true; value: string } | { ok: false; error: string }> {
  try {
    const actor = await requireSession();
    const value = await siteAppearanceService.setPageBackground(actor, hex);
    // The background lives in `(site)/layout.tsx`, which wraps every public
    // route — so this has to invalidate at the layout level, not just "/".
    revalidatePath("/", "layout");
    revalidatePath("/admin/appearance");
    return { ok: true, value };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Không lưu được màu nền." };
  }
}
