import type { ArticleSummary } from "@/domain/article";
import type { Category } from "@/domain/taxonomy";
import type { MediaAsset } from "@/domain/media";
import type { OrganizationLevel } from "@/domain/people";

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
