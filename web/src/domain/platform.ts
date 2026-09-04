import type { ID, Slug } from "./common";

export type PlatformCategory = "conference" | "training" | "sv5tot" | "volunteer" | "data";

/** Union of every status any platform category can be in. Which values are
 *  meaningful for a given category is a view-layer concern (see
 *  `src/lib/view/platformView.ts`), not something the domain constrains. */
export type PlatformStatus = "live" | "active" | "maintenance" | "open" | "unavailable" | "soon";

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
  liveActivityNote?: string;
}
