/** Routing convention, not content — safe for both the data-access layer and
 *  components to import directly (unlike fixture data, which must go through
 *  the service layer). */
export function articleHref(slug: string): string {
  return `/tin/${slug}`;
}
