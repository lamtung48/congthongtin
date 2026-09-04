import type { ID, ISODateTime } from "./common";

/**
 * Reported activity numbers for one subject (a `Province` or an
 * `OverseasOrganization`) within one reporting period. This is the
 * normalized domain shape a real backend would store.
 *
 * The activity map UI does NOT consume this shape directly — it renders the
 * denormalized `ActivityMapData` projection below. Per the "chỉ tách data
 * source, không rewrite logic" constraint on the map feature, that
 * projection is kept field-for-field identical to the pre-existing
 * `lib/types.ts` shapes so none of the map's rendering/filtering/sorting
 * logic had to change — only where the data comes from did. A real backend
 * would assemble `ActivityMapData` by joining `Province`/`OverseasOrganization`
 * with `ActivityStatistic` rows for the active period.
 */
export interface ActivityStatistic {
  id: ID;
  subjectId: ID;
  period: { label: string; from: ISODateTime; to: ISODateTime };
  activityCount: number | null;
  articleCount: number | null;
  studentCount: number | null;
  categoryDistribution: Record<string, number> | null;
  latestArticle: { title: string; publishedAt: ISODateTime } | null;
  reported: boolean;
  updatedAt: ISODateTime;
}

/* ---------- Activity map read-model (unchanged wire shape) ---------- */

export interface ActivityMapCategory {
  slug: string;
  label: string;
}

export interface ActivityMapArchipelago {
  id: string;
  name: string;
  administered_by: string;
  lat: number;
  lon: number;
  islet_offsets: [number, number][];
  illustrative: boolean;
}

export interface ActivityMapProvince {
  province_id: string;
  province_name: string;
  slug: string;
  lat: number;
  lon: number;
  activity_count: number | null;
  article_count: number | null;
  unit_count: number | null;
  latest_article: { title: string; published_at: string } | null;
  category_distribution: Record<string, number> | null;
  student_count: number | null;
  reported: boolean;
  unit_url: string;
  period: string;
}

export interface ActivityMapOverseasCountry {
  name: string;
  activity_count: number;
}

export interface ActivityMapData {
  note: string;
  updated_at: string;
  summary: {
    total_activities: number;
    total_articles: number;
    participating_students: number;
    provinces_total: number;
    provinces_reported: number;
    period: string;
  };
  categories: ActivityMapCategory[];
  archipelagos: ActivityMapArchipelago[];
  provinces: ActivityMapProvince[];
  overseas: {
    label: string;
    countries: ActivityMapOverseasCountry[];
    note: string;
  };
  source: string;
  planned_endpoint: string;
  geometry_source: { name: string; unit_codes: string; verified: boolean };
  reporting_period: { label: string; from: string; to: string };
}

/** Return type of `getActivityMap()` — named for the service boundary. */
export type ActivityMapDataset = ActivityMapData;

/**
 * The data contract shared between the Homepage's `ActivityMap` and
 * `/dia-phuong/[slug]` — both read the same per-province record
 * (`ActivityMapProvince`, above); this is its camelCase, page-shaped
 * projection, field-for-field the same set the map itself renders. A
 * province the reporting cycle hasn't received data from yet still gets
 * one of these — `reported` is `false` and the numeric/content fields are
 * `null` — never a fabricated `0` or an empty string standing in for "not
 * reported". `LocalityProfile` (in `data-access/types.ts`) embeds this as
 * `activity`, alongside `latestActivity`/`organizations` — content the map
 * doesn't need and that isn't limited to the 34 tracked provinces, so it
 * lives at the `LocalityProfile` level instead of in here. See
 * `docs/LOCALITY_PAGE.md`.
 */
export interface ProvinceActivityProfile {
  provinceId: string;
  provinceName: string;
  slug: string;
  reported: boolean;
  period: string;
  /** When the whole dataset was last compiled — not per-province (the
   *  source report doesn't break it down further than this). */
  updatedAt: ISODateTime;
  articleCount: number | null;
  activityCount: number | null;
  studentCount: number | null;
  /** Resolved against the map dataset's own `categories` labels at the
   *  data-access layer, so the page never has to hardcode a slug→label
   *  mapping itself. `null`, not `[]`, when the province hasn't reported —
   *  an empty array would look identical to "reported zero everything". */
  categoryDistribution: { slug: string; label: string; count: number }[] | null;
  latestArticle: { title: string; publishedAt: string } | null;
}
