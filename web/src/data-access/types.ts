import type { ArticleSummary } from "@/domain/article";
import type { Event } from "@/domain/event";
import type { Category } from "@/domain/taxonomy";
import type { MediaAsset } from "@/domain/media";
import type { Organization, OrganizationLevel } from "@/domain/people";
import type { Province } from "@/domain/geo";
import type { ProvinceActivityProfile } from "@/domain/activity";

/**
 * Section-specific read models returned by `ContentProvider` / the service
 * layer. These sit between the domain entities (the canonical business
 * model) and the UI (whose prop shapes must stay stable so section
 * components don't need internal rewrites when the data source changes).
 * Each type here documents exactly what one homepage section needs — no
 * more — the way a real BFF/GraphQL resolver would shape a per-view response.
 */

/** `getFeaturedArticles()` result — one lead story plus its secondary list. */
export interface FeaturedNewsResult {
  main: ArticleSummary;
  secondary: ArticleSummary[];
}

/** `getStoryRail()` item — the story rail keys off locality, not category. */
export interface StoryRailItem {
  slug: string;
  url: string;
  place: string;
  publishedAt: string;
  headline: string;
  category: Category;
}

/** `getLocalNews()` item. */
export interface LocalNewsEntry {
  slug: string;
  url: string;
  title: string;
  publishedAt: string;
  level: OrganizationLevel;
  orgName: string;
  place: string;
  unitUrl?: string;
  media: MediaAsset;
}

/**
 * `getUnitBySlug()` result for `/don-vi/[slug]` — a specific reporting Hội
 * unit (a province chapter, a university chapter, or an overseas chapter).
 * `activityStats` is always `null` today: nothing wires a unit to one
 * `ActivityMapProvince`/`ProvinceActivityProfile` record yet (a "Trường"-level
 * unit isn't a province in the first place). `/dia-phuong/[slug]` now reads
 * `ProvinceActivityProfile` at build time (see `LocalityProfile.activity`
 * below and `docs/LOCALITY_PAGE.md`) — the same mechanism could back a
 * province-level unit's stats too, but that's unbuilt; the page renders an
 * empty state for this slot instead of guessing.
 */
export interface UnitProfile {
  slug: string;
  name: string;
  level: OrganizationLevel;
  localNews: LocalNewsEntry[];
  activityStats: null;
}

/** `getLocalityBySlug()` result for `/dia-phuong/[slug]` — a geographic
 *  place, aggregating everything keyed by `place` rather than by reporting
 *  unit (that's `UnitProfile`'s job). See `docs/ROUTES.md` for why both exist. */
export interface LocalityProfile {
  slug: string;
  name: string;
  province?: Province;
  localNews: LocalNewsEntry[];
  stories: StoryRailItem[];
  /** `null` when `slug` isn't one of the 34 reporting provinces at all
   *  (e.g. an overseas city name reached through `LocalNewsEntry.place`) —
   *  a fundamentally different empty state from "reported: false" (a real
   *  province that just hasn't sent this period's numbers yet). See
   *  `docs/LOCALITY_PAGE.md`. */
  activity: ProvinceActivityProfile | null;
  /** Most recent `Event` whose `place` names this locality — independent of
   *  `activity` (works for any place, not only the 34 tracked provinces).
   *  `null` when none match. */
  latestActivity: Event | null;
  /** Hội units known to operate here, derived from `LocalNewsEntry.orgName`
   *  — empty, not fabricated, when none do. */
  organizations: Organization[];
  /** Gallery items whose `metadata.locationLabel` names this place —
   *  empty, not fabricated, when none do. */
  relatedMedia: MediaAsset[];
}

/** `getAdjacentArticles()` result for `/tin-tuc/[slug]`'s prev/next nav —
 *  either side is `null` when the current article is at that end of the
 *  reading order (see `docs/ARTICLE_DETAIL.md`). */
export interface AdjacentArticles {
  previous: ArticleSummary | null;
  next: ArticleSummary | null;
}
