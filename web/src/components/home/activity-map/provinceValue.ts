import type { ActivityMapProvince } from "@/domain/activity";

/**
 * null = no figure yet (unit hasn't reported, or this category has no data
 * for it) — distinct from 0, which is a real reported zero.
 */
export function provinceValue(p: ActivityMapProvince, filter: string): number | null {
  if (p.reported === false) return null;
  if (filter && filter !== "all") {
    const d = p.category_distribution;
    if (!d || d[filter] == null) return null;
    return d[filter];
  }
  return p.activity_count;
}
