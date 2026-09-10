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
 * already shown in the footer, not a second data source, so the two can
 * never say different things.
 *
 * `sameAs` and `email` used to be omitted on purpose: the accounts were
 * still "chờ xác nhận" and the footer rendered them as inert text, so there
 * was no real URL to put here and inventing one would have been a fake
 * schema field. They are real now, and they are the same values the footer
 * links to. `telephone` stays out — there is still no published number.
 */
export function organizationJsonLd(footer: FooterConfiguration) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: footer.orgName,
    description: footer.orgDescription,
    url: SITE_URL,
    logo: DEFAULT_OG_IMAGE.url,
    email: footer.contactEmail,
    sameAs: footer.socials.map((s) => s.url),
    address: {
      "@type": "PostalAddress",
      streetAddress: footer.address,
      addressCountry: "VN",
    },
  };
}
