import type { SearchResultItem } from "@/domain/search";

/** Diacritic-insensitive, case-insensitive normalization for search matching. */
export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase();
}

/**
 * Literal substring matching, tiered by which field matched — not semantic
 * search, and not meant to be: this stands in for a real search engine
 * until one exists (`docs/SEARCH_ARCHITECTURE.md`), so it stays honest
 * about being "contains", not "means the same as".
 */
function matchScore(item: SearchResultItem, normalizedQuery: string): number {
  const title = normalizeForSearch(item.title);
  if (title === normalizedQuery) return 100;
  if (title.startsWith(normalizedQuery)) return 80;
  if (title.includes(normalizedQuery)) return 60;
  if (normalizeForSearch(item.category).includes(normalizedQuery)) return 30;
  if (item.excerpt && normalizeForSearch(item.excerpt).includes(normalizedQuery)) return 20;
  return 0;
}

/**
 * Same matching rule everywhere search is offered — the search overlay and
 * `/tim-kiem` both call this (by way of `ContentProvider.searchContent()`)
 * instead of reimplementing it. Ranks title matches above
 * category/excerpt matches; ties keep the index's own order.
 */
export function matchesSearchQuery(index: SearchResultItem[], query: string, limit?: number): SearchResultItem[] {
  const q = normalizeForSearch(query.trim());
  if (!q) return [];
  const ranked = index
    .map((item, position) => ({ item, position, score: matchScore(item, q) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.position - b.position)
    .map((r) => r.item);
  return typeof limit === "number" ? ranked.slice(0, limit) : ranked;
}
