import type { Metadata } from "next";
import { absoluteAssetUrl, absoluteUrl, DEFAULT_OG_IMAGE, SITE_LOCALE, SITE_NAME } from "@/lib/siteConfig";

export { SITE_NAME };

/**
 * Metadata contract every route page follows: call this from
 * `generateMetadata` (or build the object inline for a static `metadata`
 * export) with a page-specific `title`/`description`/`path`. The root
 * layout's `title.template` appends the site name, so pages here only ever
 * set the page-specific fragment — never the full "X · site name" string.
 *
 * `path` is the route's own path (e.g. "/tin-tuc/dai-hoi-xii-khai-mac").
 * It's resolved to a full absolute URL here via `absoluteUrl()` — not left
 * for Next's `metadataBase` resolution to handle, since a base URL with its
 * own path segment (GitHub Pages' `.../<repo>`) would silently strip that
 * segment for any path-absolute reference (see `src/lib/siteConfig.ts`).
 *
 * `image` omitted means "use the site's default share image"
 * (`DEFAULT_OG_IMAGE`) — every page gets a real, valid social image, never
 * no image at all. Pass `image: null` (not just omitting it) for the rare
 * case a page genuinely shouldn't advertise one — nothing in this app does
 * that today.
 *
 * `article` opts a page into `og:type=article` plus the article-specific
 * Open Graph fields and a Twitter "summary_large_image" card — pass it only
 * for actual content pages (`/tin-tuc/[slug]`), never listing/search pages.
 *
 * `titleIsAbsolute` is for exactly one caller, the homepage: its title
 * already *is* the site name (the root layout's own `title.default`), so
 * running it through `title.template` (`%s · SITE_NAME`) would duplicate
 * the site name in the `<title>` tag. Setting this emits `title: {
 * absolute: title }`, which Next.js skips the template for — `openGraph`/
 * `twitter` titles are unaffected either way, since those never go through
 * `title.template` to begin with.
 */
export function pageMetadata({
  title,
  description,
  path,
  noIndex,
  image,
  article,
  titleIsAbsolute,
}: {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
  image?: { url: string; alt?: string } | null;
  article?: { publishedTime: string; modifiedTime?: string; authorName?: string };
  titleIsAbsolute?: boolean;
}): Metadata {
  const url = absoluteUrl(path);
  const resolvedImage = image === null ? undefined : (image ?? DEFAULT_OG_IMAGE);
  const images = resolvedImage
    ? [{ url: absoluteAssetUrl(resolvedImage.url), alt: resolvedImage.alt ?? title }]
    : undefined;

  const openGraph: Metadata["openGraph"] = article
    ? {
        type: "article",
        title,
        description,
        url,
        siteName: SITE_NAME,
        locale: SITE_LOCALE,
        images,
        publishedTime: article.publishedTime,
        modifiedTime: article.modifiedTime,
        authors: article.authorName ? [article.authorName] : undefined,
      }
    : {
        type: "website",
        title,
        description,
        url,
        siteName: SITE_NAME,
        locale: SITE_LOCALE,
        images,
      };

  return {
    title: titleIsAbsolute ? { absolute: title } : title,
    description,
    alternates: { canonical: url },
    authors: article?.authorName ? [{ name: article.authorName }] : undefined,
    openGraph,
    twitter: images
      ? { card: "summary_large_image", title, description, images: images.map((i) => i.url) }
      : undefined,
    robots: noIndex ? { index: false, follow: false } : undefined,
  };
}
