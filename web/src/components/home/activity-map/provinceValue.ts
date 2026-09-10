import type { ActivityMapProvince } from "@/domain/activity";

/**
 * The figure the map keys on for a province: its count of published
 * articles. `null` = no article yet (distinct from a real `0`), which the
 * map renders as a hollow "chưa có tin bài" marker.
 *
 * Was previously a per-category lookup (`activity_count` / a
 * `category_distribution` slice) driven by the map's filter chips. Those
 * chips were removed — the map now always shows every unit's real article
 * count.
 */
export function provinceValue(p: ActivityMapProvince): number | null {
  return p.article_count;
}
