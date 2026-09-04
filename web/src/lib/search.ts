/** Diacritic-insensitive, case-insensitive normalization for search matching. */
export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase();
}

export interface Searchable {
  title: string;
  category: string;
}

/** Same matching rule everywhere search is offered — the search overlay and
 *  the `/tim-kiem` page both call this instead of reimplementing it. */
export function matchesQuery<T extends Searchable>(items: T[], query: string): T[] {
  const q = normalizeForSearch(query.trim());
  if (!q) return [];
  return items.filter((item) => normalizeForSearch(`${item.title} ${item.category}`).includes(q));
}
