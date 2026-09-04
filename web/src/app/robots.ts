import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteConfig";

// Required for `output: "export"` (`docs/DEPLOYMENT.md`): this route has no
// per-request input, so it's identical every build — safe to emit once as a
// static file rather than a server function static export has no server for.
export const dynamic = "force-static";

/**
 * Every URL a crawler shouldn't index already says so itself — `/tim-kiem`
 * sets `robots: { index: false }` in its own metadata (`docs/SEO.md`).
 * Blocking it here too would backfire: a `disallow` stops the page from
 * being *crawled* at all, so a crawler could never see that per-page
 * noindex tag, and Google explicitly documents this as a way URLs end up
 * indexed anyway (with no snippet, from external links alone). So this
 * stays a blanket allow, plus the one thing robots.txt is actually for:
 * pointing at the sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
