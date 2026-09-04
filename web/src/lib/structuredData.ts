import type { FooterConfiguration } from "@/domain/homepage";
import { DEFAULT_OG_IMAGE, SITE_URL } from "@/lib/siteConfig";

/**
 * `publisher` fragment for Article/NewsArticle JSON-LD (`docs/SEO.md`).
 * Takes the org name as a parameter rather than hard-coding a second copy
 * of it — `FOOTER_ORG_NAME` lives in the fixture layer, off-limits to page
 * components (`docs/DATA_ACCESS.md`: fixture data goes through the service
 * layer), so callers pass the same `homepage.footer.orgName` the site's
 * `Organization` schema below is built from. The logo is the one fact this
 * fragment can supply unconditionally: a real `public/` asset, not a
 * placeholder (see `DEFAULT_OG_IMAGE`).
 */
export function publisherRef(orgName: string) {
  return {
    "@type": "Organization" as const,
    name: orgName,
    logo: {
      "@type": "ImageObject" as const,
      url: DEFAULT_OG_IMAGE.url,
    },
  };
}

/**
 * Site-wide `Organization` schema, rendered once from the root layout. Built
 * from `FooterConfiguration` — the same real org name/description/address
 * already fetched for the footer, not a second data source. Deliberately
 * omits `sameAs` (social profile links) and `telephone`/`email`: the footer
 * itself says those accounts and contact channels are "chờ xác nhận — chưa
 * gắn liên kết" (pending confirmation, not yet linked) — there is no real
 * URL or number to put there, and inventing one would be exactly the fake
 * schema field this task explicitly rules out.
 */
export function organizationJsonLd(footer: FooterConfiguration) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: footer.orgName,
    description: footer.orgDescription,
    url: SITE_URL,
    logo: DEFAULT_OG_IMAGE.url,
    address: {
      "@type": "PostalAddress",
      streetAddress: footer.address,
      addressCountry: "VN",
    },
  };
}
