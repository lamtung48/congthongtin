import { revalidatePath } from "next/cache";
import { platformRepository } from "@/server/repositories/platformRepository";
import { auditLogRepository } from "@/server/repositories/auditLogRepository";
import { getAdapterForCategory } from "@/server/integrations/platformAdapters/registry";
import { hasPermission } from "@/server/auth/permissions";
import type { SessionUser } from "@/server/auth/session";
import type { Platform, PlatformCategory, PlatformIntegrationType, PlatformStatus } from "@/generated/prisma/client";

/**
 * Ecosystem integration task. Business rules around `Platform` the route
 * layer should never reimplement: which field group each role may write
 * (brief section 1 — ADMIN "toàn quyền" vs. MANAGER "nội dung/hiển thị"),
 * that every write leaves an audit entry (brief section 8), and that
 * calling out to an external platform's API never happens on the public
 * read path (`refreshActivity` is the only place that ever does, and only
 * an authenticated Admin/Manager action ever calls it) — see
 * docs/ECOSYSTEM_INTEGRATION.md, "Failure isolation".
 */

/** Nội dung/hiển thị — brief section 1 & 7, ADMIN + MANAGER
 *  (`platform.manage.display`). Includes `status`/`isEnabled` ("display
 *  state") and `currentActivity` (also writable by `refreshActivity`). */
export interface PlatformDisplayFields {
  name?: string;
  description?: string;
  url?: string;
  iconMediaId?: string | null;
  ctaLabel?: string | null;
  accessLevel?: string;
  metric?: string | null;
  currentActivity?: string | null;
  status?: PlatformStatus;
  order?: number;
}

/** Cấu hình tích hợp kỹ thuật — brief section 1, ADMIN only
 *  (`platform.manage`, not granted to MANAGER). Changing `category` is
 *  rare (it decides which adapter, if any, `refreshActivity` calls) but is
 *  still just a field edit, not a create — kept here rather than treated
 *  as immutable, since nothing else keys off a `Platform`'s id changing. */
export interface PlatformIntegrationFields {
  category?: PlatformCategory;
  integrationType?: PlatformIntegrationType;
  apiBaseUrl?: string | null;
}

function assertHasPermission(actor: SessionUser, permission: Parameters<typeof hasPermission>[1]) {
  if (!hasPermission(actor.role, permission)) {
    throw new Error(`Role ${actor.role} lacks permission "${permission}".`);
  }
}

/** Brief section 6: platform display changes are homepage content, same
 *  invalidation as an article publish/unpublish — see
 *  `articleService.ts`'s identically-named helper for the full reasoning
 *  (one call purges every cached public page rather than hand-tracking
 *  which page a given platform's bento slot happens to render on). */
function revalidatePublicSite() {
  revalidatePath("/", "layout");
}

export const platformService = {
  list: platformRepository.list,
  getById: platformRepository.findById,

  /** ADMIN only — creating a new registry entry is a structural/integration
   *  act, not a "manage existing content" one; see docs/ECOSYSTEM_INTEGRATION.md. */
  async create(
    actor: SessionUser,
    fields: { slug: string; name: string; description: string; url: string; category: PlatformCategory; status: PlatformStatus; accessLevel: string } & Partial<
      PlatformDisplayFields & PlatformIntegrationFields
    >,
  ): Promise<Platform> {
    assertHasPermission(actor, "platform.manage");
    const platform = await platformRepository.create({
      slug: fields.slug,
      name: fields.name,
      description: fields.description,
      url: fields.url,
      category: fields.category,
      status: fields.status,
      accessLevel: fields.accessLevel,
      metric: fields.metric,
      currentActivity: fields.currentActivity,
      ctaLabel: fields.ctaLabel,
      iconMediaId: fields.iconMediaId,
      integrationType: fields.integrationType,
      apiBaseUrl: fields.apiBaseUrl,
      order: fields.order ?? 0,
    });
    await auditLogRepository.record({ actorId: actor.id, action: "CREATE", entityType: "Platform", entityId: platform.id });
    if (platform.isEnabled) revalidatePublicSite();
    return platform;
  },

  /**
   * `display`/`integration` are separate optional groups so a caller only
   * needs (and only proves it holds) the permission for whichever it
   * actually sends — a Manager's request that never includes `integration`
   * never even reaches the `platform.manage` check.
   */
  async update(
    actor: SessionUser,
    platform: Platform,
    input: { display?: PlatformDisplayFields; integration?: PlatformIntegrationFields },
  ): Promise<Platform> {
    if (input.integration) {
      assertHasPermission(actor, "platform.manage");
    }
    if (input.display) {
      assertHasPermission(actor, "platform.manage.display");
    }
    if (!input.display && !input.integration) {
      return platform;
    }
    const updated = await platformRepository.update(platform.id, { ...input.display, ...input.integration });
    await auditLogRepository.record({
      actorId: actor.id,
      action: "UPDATE_PLATFORM",
      entityType: "Platform",
      entityId: platform.id,
      metadata: { fields: [...Object.keys(input.display ?? {}), ...Object.keys(input.integration ?? {})] },
    });
    if (updated.isEnabled) revalidatePublicSite();
    return updated;
  },

  /** Brief section 7 "quản lý display state" + section 8's own dedicated
   *  audit actions — ADMIN + MANAGER, same as any other display field. */
  async setEnabled(actor: SessionUser, platform: Platform, isEnabled: boolean): Promise<Platform> {
    assertHasPermission(actor, "platform.manage.display");
    const updated = await platformRepository.setEnabled(platform.id, isEnabled);
    await auditLogRepository.record({
      actorId: actor.id,
      action: isEnabled ? "ENABLE_PLATFORM" : "DISABLE_PLATFORM",
      entityType: "Platform",
      entityId: platform.id,
    });
    // Both directions need the public site to catch up immediately — a
    // just-disabled platform must disappear from the homepage right away,
    // not linger cached until the ISR ceiling.
    revalidatePublicSite();
    return updated;
  },

  /** ADMIN only — removing a registry row entirely is the same tier as
   *  creating one. */
  async remove(actor: SessionUser, platform: Platform): Promise<void> {
    assertHasPermission(actor, "platform.manage");
    await platformRepository.remove(platform.id);
    await auditLogRepository.record({ actorId: actor.id, action: "DELETE", entityType: "Platform", entityId: platform.id });
    if (platform.isEnabled) revalidatePublicSite();
  },

  /**
   * Brief section 5/6: calls the one adapter matching this platform's
   * `category` (if any) and, only on success, writes the result back.
   * Never throws past an adapter failure — returns a discriminated result
   * the caller (a Server Action) turns into a UI message; `currentActivity`
   * is left completely untouched on failure, which is what makes "external
   * platform chết → portal vẫn hoạt động" true: nothing here ever blocks or
   * degrades what the public homepage already has cached in `Platform`.
   * ADMIN + MANAGER (`platform.manage.display`) — triggering a refresh is a
   * display-state action, not an integration-wiring one; the actual
   * `apiBaseUrl` it calls stays whatever an Admin configured.
   */
  async refreshActivity(
    actor: SessionUser,
    platform: Platform,
  ): Promise<{ ok: true; currentActivity: string; updatedAt: Date } | { ok: false; reason: string; message: string }> {
    assertHasPermission(actor, "platform.manage.display");
    if (platform.integrationType !== "API") {
      return { ok: false, reason: "not_configured", message: "Nền tảng này không dùng tích hợp API — không có gì để làm mới." };
    }
    const adapter = getAdapterForCategory(platform.category);
    if (!adapter) {
      return { ok: false, reason: "not_configured", message: "Chưa có adapter tích hợp cho loại nền tảng này." };
    }
    const result = await adapter.fetchActivity({ apiBaseUrl: platform.apiBaseUrl });
    if (!result.ok) {
      return { ok: false, reason: result.reason, message: result.message };
    }
    const updatedAt = new Date();
    const updated = await platformRepository.update(platform.id, {
      currentActivity: result.currentActivity,
      currentActivityUpdatedAt: updatedAt,
      ...(result.status ? { status: result.status } : {}),
    });
    await auditLogRepository.record({
      actorId: actor.id,
      action: "UPDATE_PLATFORM",
      entityType: "Platform",
      entityId: platform.id,
      metadata: { source: "adapter-refresh" },
    });
    if (updated.isEnabled) revalidatePublicSite();
    return { ok: true, currentActivity: result.currentActivity, updatedAt };
  },
};
