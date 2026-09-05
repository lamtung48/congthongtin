"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/server/auth/session";
import { platformService, type PlatformDisplayFields, type PlatformIntegrationFields } from "@/server/services/platformService";
import type { PlatformCategory, PlatformIntegrationType, PlatformStatus } from "@/generated/prisma/client";

/**
 * Every action re-fetches the platform and calls the matching
 * `platformService` method, which itself re-checks permission
 * (`platform.manage` vs `platform.manage.display`) — this file does no
 * authorization logic of its own beyond `requireSession()`, same
 * discipline as `articles/actions.ts`.
 */

async function loadOr404(id: string) {
  const platform = await platformService.getById(id);
  if (!platform) throw new Error("Platform not found.");
  return platform;
}

function revalidatePlatformViews(id: string) {
  revalidatePath("/admin/platforms");
  revalidatePath(`/admin/platforms/${id}/edit`);
}

export async function createPlatformAction(formData: FormData): Promise<void> {
  const actor = await requireSession();
  await platformService.create(actor, {
    slug: String(formData.get("slug")).trim(),
    name: String(formData.get("name")).trim(),
    description: String(formData.get("description")).trim(),
    url: String(formData.get("url")).trim(),
    category: String(formData.get("category")) as PlatformCategory,
    status: String(formData.get("status")) as PlatformStatus,
    accessLevel: String(formData.get("accessLevel")).trim(),
    integrationType: (String(formData.get("integrationType")) || "EXTERNAL_LINK") as PlatformIntegrationType,
  });
  revalidatePath("/admin/platforms");
}

/** Shared by both field groups' forms on the edit page — which group's
 *  permission gets checked depends only on which `FormData` fields the
 *  submitting form actually included (`fields`/`hidden` inputs), matching
 *  `platformService.update`'s own "only prove what you send" contract. */
export async function updateDisplayAction(formData: FormData): Promise<void> {
  const actor = await requireSession();
  const platform = await loadOr404(String(formData.get("platformId")));
  const display: PlatformDisplayFields = {
    name: String(formData.get("name")).trim(),
    description: String(formData.get("description")).trim(),
    url: String(formData.get("url")).trim(),
    accessLevel: String(formData.get("accessLevel")).trim(),
    metric: (formData.get("metric") as string | null)?.trim() || null,
    currentActivity: (formData.get("currentActivity") as string | null)?.trim() || null,
    ctaLabel: (formData.get("ctaLabel") as string | null)?.trim() || null,
    status: String(formData.get("status")) as PlatformStatus,
    order: Number(formData.get("order")) || 0,
    iconMediaId: (formData.get("iconMediaId") as string | null) || null,
  };
  await platformService.update(actor, platform, { display });
  revalidatePlatformViews(platform.id);
}

export async function updateIntegrationAction(formData: FormData): Promise<void> {
  const actor = await requireSession();
  const platform = await loadOr404(String(formData.get("platformId")));
  const apiBaseUrlRaw = (formData.get("apiBaseUrl") as string | null)?.trim();
  const integration: PlatformIntegrationFields = {
    category: String(formData.get("category")) as PlatformCategory,
    integrationType: String(formData.get("integrationType")) as PlatformIntegrationType,
    apiBaseUrl: apiBaseUrlRaw || null,
  };
  await platformService.update(actor, platform, { integration });
  revalidatePlatformViews(platform.id);
}

export async function setPlatformEnabledAction(formData: FormData): Promise<void> {
  const actor = await requireSession();
  const platform = await loadOr404(String(formData.get("platformId")));
  const isEnabled = String(formData.get("isEnabled")) === "true";
  await platformService.setEnabled(actor, platform, isEnabled);
  revalidatePlatformViews(platform.id);
}

export interface RefreshActivityFormState {
  ok?: boolean;
  message?: string;
}

export async function refreshActivityAction(_prev: RefreshActivityFormState | undefined, formData: FormData): Promise<RefreshActivityFormState> {
  const actor = await requireSession();
  const platform = await loadOr404(String(formData.get("platformId")));
  const result = await platformService.refreshActivity(actor, platform);
  revalidatePlatformViews(platform.id);
  if (result.ok) {
    return { ok: true, message: `Đã làm mới: ${result.currentActivity}` };
  }
  return { ok: false, message: `Không thể làm mới: ${result.message}` };
}

export async function deletePlatformAction(formData: FormData): Promise<void> {
  const actor = await requireSession();
  const platform = await loadOr404(String(formData.get("platformId")));
  await platformService.remove(actor, platform);
  revalidatePath("/admin/platforms");
}
