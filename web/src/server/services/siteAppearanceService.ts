import { cache } from "react";
import { siteAppearanceRepository } from "@/server/repositories/siteAppearanceRepository";
import { auditLogRepository } from "@/server/repositories/auditLogRepository";
import { hasPermission } from "@/server/auth/permissions";
import type { SessionUser } from "@/server/auth/session";
import {
  DEFAULT_PAGE_BACKGROUND,
  MIN_BODY_CONTRAST,
  contrastReport,
  normalizeHex,
} from "@/lib/appearance";

export interface SiteAppearance {
  pageBackground: string;
  updatedAt: Date | null;
  updatedById: string | null;
}

const DEFAULT_APPEARANCE: SiteAppearance = {
  pageBackground: DEFAULT_PAGE_BACKGROUND,
  updatedAt: null,
  updatedById: null,
};

/**
 * `cache()`-wrapped because `(site)/layout.tsx` wraps *every* public route:
 * without memoizing, a single request that renders the layout plus anything
 * else reading appearance would hit the database twice for one row that
 * cannot change mid-request. The layout is ISR (`revalidate = 60`) and the
 * save action revalidates `"/"` at the `layout` level, so the public site
 * reads this roughly once per deploy-or-change, not per visitor.
 *
 * A missing row, or a value that somehow isn't a colour, both resolve to the
 * design system's default — this can never fail a page render.
 */
const get = cache(async (): Promise<SiteAppearance> => {
  const row = await siteAppearanceRepository.find();
  if (!row) return DEFAULT_APPEARANCE;
  return {
    pageBackground: normalizeHex(row.pageBackground) ?? DEFAULT_PAGE_BACKGROUND,
    updatedAt: row.updatedAt,
    updatedById: row.updatedById,
  };
});

export const siteAppearanceService = {
  get,

  /**
   * `system.configure` (ADMIN only) rather than `homepage.manage`: this is
   * not one section's content, it repaints every public page at once, so it
   * sits with the other system-wide settings rather than with editorial work.
   *
   * Refuses a background that body text cannot be read on (WCAG AA, 4.5:1) —
   * the site has one set of dark text tokens and a background picker is not
   * a dark mode. The admin UI shows the same measurement live, so this is a
   * backstop for a hand-edited form post, not the primary feedback path.
   *
   * Deliberately does not revalidate: that belongs to the Server Action that
   * calls it, keeping the service callable from a script or a job.
   */
  async setPageBackground(actor: SessionUser, input: string): Promise<string> {
    if (!hasPermission(actor.role, "system.configure")) {
      throw new Error(`Role ${actor.role} lacks permission "system.configure".`);
    }
    const hex = normalizeHex(input);
    if (!hex) {
      throw new Error("Mã màu không hợp lệ. Ví dụ hợp lệ: #f5f7fa.");
    }
    const contrast = contrastReport(hex);
    if (!contrast.readable) {
      throw new Error(
        `Nền này quá tối so với màu chữ của site (độ tương phản ${contrast.body.toFixed(2)}:1, tối thiểu ${MIN_BODY_CONTRAST}:1). Hãy chọn một màu sáng hơn.`,
      );
    }

    await siteAppearanceRepository.set(hex, actor.id);
    await auditLogRepository.record({
      actorId: actor.id,
      action: "UPDATE",
      entityType: "SiteAppearance",
      entityId: "default",
      metadata: { pageBackground: hex },
    });
    return hex;
  },
};
