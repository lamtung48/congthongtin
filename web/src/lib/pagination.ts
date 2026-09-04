/**
 * Real, static pagination — no fake infinite scroll and no client-side
 * "load more" pretending to hit a backend that doesn't exist yet. Every
 * page N is its own statically-generated route (`/tin-tuc`, then
 * `/tin-tuc/trang/2`, `/tin-tuc/trang/3`, ...) built from a plain array
 * slice, the same shape a real paged API would eventually return. See
 * `docs/LISTING_PAGES.md`.
 */
export interface Paged<T> {
  items: T[];
  page: number;
  pageCount: number;
  total: number;
}

/** Slices `all` into page `page` of `pageSize` items. `page` outside
 *  `[1, pageCount]` clamps to the nearest valid page rather than throwing —
 *  callers that need a strict 404 for an out-of-range URL (every
 *  `trang/[page]` route) check the requested page against `pageCount`
 *  themselves before calling this. */
export function paginate<T>(all: T[], page: number, pageSize: number): Paged<T> {
  const pageCount = Math.max(1, Math.ceil(all.length / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * pageSize;
  return { items: all.slice(start, start + pageSize), page: safePage, pageCount, total: all.length };
}

/** `generateStaticParams()` for a `trang/[page]` route: pages 2..pageCount.
 *  Page 1 deliberately isn't included — it lives at the un-suffixed base
 *  route, not `trang/1`, so there's exactly one canonical URL per page. */
export function staticPageParams(pageCount: number): { page: string }[] {
  return Array.from({ length: Math.max(0, pageCount - 1) }, (_, i) => ({ page: String(i + 2) }));
}

/**
 * `output: "export"` requires at least one generated path for every
 * dynamic route — a `trang/[page]` route whose real params list is empty
 * (no category/topic currently has a second page) fails the build
 * otherwise. Substitutes one placeholder the route's own `page <= 1`
 * guard is guaranteed to `notFound()`, so the build succeeds without ever
 * serving anything at that path. See `docs/LISTING_PAGES.md`.
 */
export function ensureNonEmptyParams<T>(params: T[], placeholder: T): T[] {
  return params.length > 0 ? params : [placeholder];
}
