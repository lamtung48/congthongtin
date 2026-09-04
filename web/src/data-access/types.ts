import type { ArticleSummary } from "@/domain/article";
import type { Category } from "@/domain/taxonomy";
import type { MediaAsset } from "@/domain/media";
import type { OrganizationLevel } from "@/domain/people";
import type { Province } from "@/domain/geo";

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
 * `activityStats` is always `null` today: the activity map's numbers are
 * fetched client-side only (see `docs/DATA_ACCESS.md`), so a unit page
 * cannot safely read them at request time without a server-side data path
 * that doesn't exist yet — the page renders an empty state for that slot
 * instead of guessing.
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
}
