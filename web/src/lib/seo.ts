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
 * because `metadataBase` is set once on the root layout.
 */
export function pageMetadata({
  title,
  description,
  path,
  noIndex,
}: {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: SITE_NAME,
      locale: "vi_VN",
      type: "website",
    },
    robots: noIndex ? { index: false, follow: false } : undefined,
  };
}
