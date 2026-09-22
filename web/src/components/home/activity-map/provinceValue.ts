import type { ActivityMapProvince } from "@/domain/activity";

/**
 * The figure the map keys on for a province: its published articles plus
 * the activities its units run on the Hoạt động platform (both are "tin bài"
 * in the map's sense — an activity is listed like an article and links to its
 * landing page). `null` = nothing yet (distinct from a real `0`), which the
 * map renders as a hollow "chưa có dữ liệu" marker.
 */
export function provinceValue(p: ActivityMapProvince): number | null {
  const total = (p.article_count ?? 0) + (p.platform_activity_count ?? 0);
  return total > 0 ? total : null;
}

/** "3 tin bài · 2 hoạt động" / "2 hoạt động" / "Chưa có dữ liệu" — the one wording every place uses. */
export function provinceValueLabel(p: ActivityMapProvince): string {
  const parts: string[] = [];
  if (p.article_count) parts.push(`${p.article_count.toLocaleString("vi-VN")} tin bài`);
  if (p.platform_activity_count) parts.push(`${p.platform_activity_count.toLocaleString("vi-VN")} hoạt động`);
  return parts.length ? parts.join(" · ") : "Chưa có dữ liệu";
}
