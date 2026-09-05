import type { ID, Slug } from "./common";
import type { MediaAsset } from "./media";

export type PlatformCategory = "conference" | "training" | "sv5tot" | "volunteer" | "data";

/** Union of every status any platform category can be in. Which values are
 *  meaningful for a given category is a view-layer concern (see
 *  `src/lib/view/platformView.ts`), not something the domain constrains. */
export type PlatformStatus = "live" | "active" | "maintenance" | "open" | "unavailable" | "soon";

/**
 * Ecosystem integration task, brief section 3 — never changes what the
 * public site renders (always a real out-link, never an `<iframe>`), only
 * which CTA copy default `buildPlatformView` falls back to and which
 * adapter (if any) an Admin/Manager's "Làm mới trạng thái" action is
 * allowed to call server-side. `apiBaseUrl` itself is deliberately NOT part
 * of this public domain type — it's an admin/integration wiring detail
 * (`src/server/services/platformService.ts`), never read by any public
 * route or shipped to the client for a page visitor.
 */
export type PlatformIntegrationType = "external_link" | "api" | "sso_ready";

export interface Platform {
  id: ID;
  slug: Slug;
  name: string;
  url: string;
  description: string;
  category: PlatformCategory;
  status: PlatformStatus;
  accessLevel: string;
  metric?: string;
  /** What's happening right now (e.g. "Phiên biểu quyết đang mở", "14 khoá
   *  đang mở") — hand-written by an editor, or overwritten by
   *  `platformService.refreshActivity()` for an `integrationType: "api"`
   *  platform. Named to match the CMS field, not the old prototype's
   *  `liveActivityNote`. */
  currentActivity?: string;
  /** Overrides the per-category default CTA label in `buildPlatformView` —
   *  `undefined` keeps that default. */
  ctaLabel?: string;
  integrationType: PlatformIntegrationType;
  icon?: MediaAsset;
}
