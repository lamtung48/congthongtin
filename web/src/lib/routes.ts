/**
 * Routing convention, not content — safe for both the data-access layer and
 * components to import directly (unlike fixture data, which must go through
 * the service layer). One function per route pattern in `docs/ROUTES.md`;
 * nothing in the app builds one of these paths by hand.
 */
export function articleHref(slug: string): string {
  return `/tin-tuc/${slug}`;
}

export function categoryHref(slug: string): string {
  return `/chuyen-muc/${slug}`;
}

export function topicHref(slug: string): string {
  return `/chu-de/${slug}`;
}

export function localityHref(slug: string): string {
  return `/dia-phuong/${slug}`;
}

export function unitHref(slug: string): string {
  return `/don-vi/${slug}`;
}

export function eventHref(slug: string): string {
  return `/su-kien/${slug}`;
}

export function searchHref(query?: string): string {
  return query ? `/tim-kiem?q=${encodeURIComponent(query)}` : "/tim-kiem";
}

/** Page 1 of a paginated listing has no `/trang/N` suffix — it IS
 *  `basePath`. Every other page lives at `basePath/trang/N`. */
export function pagedHref(basePath: string, page: number): string {
  return page <= 1 ? basePath : `${basePath}/trang/${page}`;
}
