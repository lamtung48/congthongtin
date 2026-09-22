"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/server/auth/session";
import { sourceService, type SourceFieldsInput } from "@/server/services/sourceService";
import { externalIntegrationRateLimiter, sensitiveAdminActionRateLimiter } from "@/server/security/rateLimit";
import type { SourceType } from "@/generated/prisma/client";

/**
 * Every action re-fetches the source and calls the matching
 * `sourceService` method, which re-checks `source.manage` independently
 * — this file does no authorization of its own beyond `requireSession()`.
 *
 * Brief section 9: "sensitive admin API" rate limit — create/update write
 * third-party API tokens (Facebook/YouTube credentials, brief section 3's
 * "source token"), at least as sensitive as the user-management actions
 * that already carry this same limiter (`users/actions.ts`). `sync` stays
 * on its own `externalIntegrationRateLimiter` bucket instead — it's the
 * one action here that actually calls out to Facebook/YouTube/RSS, a
 * distinct concern from "how often can this token be rewritten."
 */
function assertNotRateLimited(actorId: string): void {
  if (!sensitiveAdminActionRateLimiter.check(actorId).allowed) {
    throw new Error("Bạn đang thao tác quá nhanh — vui lòng thử lại sau ít phút.");
  }
  sensitiveAdminActionRateLimiter.record(actorId);
}

async function loadOr404(id: string) {
  const source = await sourceService.getById(await requireSession(), id);
  if (!source) throw new Error("Source not found.");
  return source;
}

function revalidateSourceViews(id: string) {
  revalidatePath("/admin/sources");
  revalidatePath(`/admin/sources/${id}/edit`);
}

/** Splits a comma/newline-separated textarea into a clean hashtag list —
 *  `sourceService`'s own `normalizeHashtagList` still strips `#`/lower-
 *  cases/trims, this only breaks the raw textarea value into entries. */
function parseHashtagList(raw: FormDataEntryValue | null): string[] {
  return String(raw ?? "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** "6" (hours) -> 360 (minutes); empty / invalid -> null (manual only). */
function parseSyncEveryMinutes(raw: FormDataEntryValue | null): number | null {
  const h = Number(String(raw ?? "").trim());
  if (!Number.isFinite(h) || h <= 0) return null;
  return Math.round(Math.min(168, Math.max(1, h)) * 60);
}

function parsePositiveIntOrNull(raw: FormDataEntryValue | null): number | null {
  const n = Number(String(raw ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.min(500, Math.round(n)) : null;
}

function collectorFields(formData: FormData) {
  return {
    syncEveryMinutes: parseSyncEveryMinutes(formData.get("syncEveryHours")),
    maxItemsPerSync: parsePositiveIntOrNull(formData.get("maxItemsPerSync")),
    fetchFullBody: formData.get("fetchFullBody") === "on",
    contentSelector: String(formData.get("contentSelector") ?? "").trim() || null,
  };
}

export async function createSourceAction(formData: FormData): Promise<void> {
  const actor = await requireSession();
  assertNotRateLimited(actor.id);
  const credential = String(formData.get("credential") ?? "").trim();
  const source = await sourceService.create(actor, {
    name: String(formData.get("name")).trim(),
    type: String(formData.get("type")) as SourceType,
    externalUrl: String(formData.get("externalUrl") ?? "").trim() || null,
    externalId: String(formData.get("externalId") ?? "").trim() || null,
    credential: credential || null,
    includeHashtags: parseHashtagList(formData.get("includeHashtags")),
    excludeHashtags: parseHashtagList(formData.get("excludeHashtags")),
    categoryId: String(formData.get("categoryId") ?? "").trim() || null,
    ...collectorFields(formData),
  });
  revalidatePath("/admin/sources");
  redirect(`/admin/sources/${source.id}/edit`);
}

export async function updateSourceAction(formData: FormData): Promise<void> {
  const actor = await requireSession();
  assertNotRateLimited(actor.id);
  const source = await loadOr404(String(formData.get("sourceId")));
  const credentialRaw = formData.get("credential");
  const credential = credentialRaw === null ? undefined : String(credentialRaw).trim() || undefined;
  const fields: SourceFieldsInput = {
    name: String(formData.get("name")).trim(),
    type: String(formData.get("type")) as SourceType,
    externalUrl: String(formData.get("externalUrl") ?? "").trim() || null,
    externalId: String(formData.get("externalId") ?? "").trim() || null,
    includeHashtags: parseHashtagList(formData.get("includeHashtags")),
    excludeHashtags: parseHashtagList(formData.get("excludeHashtags")),
    categoryId: String(formData.get("categoryId") ?? "").trim() || null,
    ...collectorFields(formData),
  };
  // Only touch the credential if the write-only field was actually filled
  // in — an empty submit must never silently wipe an existing credential.
  if (credential) fields.credential = credential;
  await sourceService.update(actor, source, fields);
  revalidateSourceViews(source.id);
}

export async function setSourceEnabledAction(formData: FormData): Promise<void> {
  const actor = await requireSession();
  assertNotRateLimited(actor.id);
  const source = await loadOr404(String(formData.get("sourceId")));
  const isEnabled = String(formData.get("isEnabled")) === "true";
  await sourceService.setEnabled(actor, source, isEnabled);
  revalidateSourceViews(source.id);
}

export interface SyncSourceFormState {
  ok?: boolean;
  message?: string;
}

export async function syncSourceAction(_prev: SyncSourceFormState | undefined, formData: FormData): Promise<SyncSourceFormState> {
  const actor = await requireSession();
  // Brief section 9: "external integration endpoint" rate limit — a sync
  // makes a real outbound call to a third-party API (Facebook/YouTube/RSS),
  // so this also protects those APIs' own rate limits, not just ours.
  if (!externalIntegrationRateLimiter.check(actor.id).allowed) {
    return { ok: false, message: "Bạn đang đồng bộ quá nhanh — vui lòng thử lại sau ít phút." };
  }
  externalIntegrationRateLimiter.record(actor.id);
  const source = await loadOr404(String(formData.get("sourceId")));
  const result = await sourceService.sync(actor, source);
  revalidateSourceViews(source.id);
  if (result.ok) {
    return { ok: true, message: `Đồng bộ xong: ${result.fetched} mục tìm thấy, ${result.stored} mục mới được thêm vào Social Inbox.` };
  }
  return { ok: false, message: `Đồng bộ thất bại: ${result.message}` };
}

export async function deleteSourceAction(formData: FormData): Promise<void> {
  const actor = await requireSession();
  assertNotRateLimited(actor.id);
  const source = await loadOr404(String(formData.get("sourceId")));
  await sourceService.remove(actor, source);
  revalidatePath("/admin/sources");
}
