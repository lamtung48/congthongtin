/**
 * CSS custom-ident shared between an article card's cover image (Hero,
 * FeaturedNews' main card) and the Article Hero's cover image, so the View
 * Transition API — where supported — morphs one into the other instead of
 * a hard cut. Derived from the article's own `url` (already identical on
 * both ends, e.g. `HeroContent.articleUrl` and `Article.url`) rather than a
 * separate id, so the two sides can never drift out of sync. Slashes aren't
 * valid in a <custom-ident>, hence the sanitize; the leading "article-cover"
 * guarantees the result never starts with a digit. See `docs/ARTICLE_DETAIL.md`.
 *
 * Plain function, no "use client" — both the (client) card components and
 * the (server) Article page need to compute the same name.
 */
export function articleCoverTransitionName(articleUrl: string): string {
  return `article-cover${articleUrl.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}
