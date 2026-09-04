import type { Metadata } from "next";

export const SITE_NAME = "Cổng thông tin số Hội Sinh viên Việt Nam";

/**
 * Metadata contract every route page follows: call this from
 * `generateMetadata` (or build the object inline for a static `metadata`
 * export) with a page-specific `title`/`description`/`path`. The root
 * layout's `title.template` appends the site name, so pages here only ever
 * set the page-specific fragment — never the full "X · site name" string.
 *
 * `path` is the route's own path (e.g. "/tin-tuc/dai-hoi-xii-khai-mac"),
 * used for both the canonical link and Open Graph `url`. It's relative
 * because `metadataBase` is set once on the root layout, which also
 * resolves `image.url` if it's relative.
 *
 * `article` opts a page into `og:type=article` plus the article-specific
 * Open Graph fields and a Twitter "summary_large_image" card — pass it only
 * for actual content pages (`/tin-tuc/[slug]`), never listing/search pages.
 */
export function pageMetadata({
  title,
  description,
  path,
  noIndex,
  image,
  article,
}: {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
  image?: { url: string; alt?: string };
  article?: { publishedTime: string; modifiedTime?: string; authorName?: string };
}): Metadata {
  const images = image ? [{ url: image.url, alt: image.alt ?? title }] : undefined;

  const openGraph: Metadata["openGraph"] = article
    ? {
        type: "article",
        title,
        description,
        url: path,
        siteName: SITE_NAME,
        locale: "vi_VN",
        images,
        publishedTime: article.publishedTime,
        modifiedTime: article.modifiedTime,
        authors: article.authorName ? [article.authorName] : undefined,
      }
    : {
        type: "website",
        title,
        description,
        url: path,
        siteName: SITE_NAME,
        locale: "vi_VN",
        images,
      };

  return {
    title,
    description,
    alternates: { canonical: path },
    authors: article?.authorName ? [{ name: article.authorName }] : undefined,
    openGraph,
    twitter: images
      ? { card: "summary_large_image", title, description, images: images.map((i) => i.url) }
      : undefined,
    robots: noIndex ? { index: false, follow: false } : undefined,
  };
}
