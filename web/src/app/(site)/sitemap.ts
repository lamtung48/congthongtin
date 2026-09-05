import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/siteConfig";
import {
  articleHref,
  categoryHref,
  eventHref,
  localityHref,
  pagedHref,
  topicHref,
  unitHref,
} from "@/lib/routes";
import {
  getArticleBySlug,
  getArticleSlugs,
  getCategories,
  getLocalitySlugs,
  getTopics,
  getUnitSlugs,
} from "@/services/contentService";
import { getEvents } from "@/services/homepageService";
import { getTinTucPageCount } from "@/app/(site)/tin-tuc/TinTucPageView";
import { getCategoryPageCount } from "@/app/(site)/chuyen-muc/[slug]/CategoryPageView";
import { getTopicPageCount } from "@/app/(site)/chu-de/[slug]/TopicPageView";

// Required for `output: "export"` (`docs/DEPLOYMENT.md`): built once from
// the same fixture data every static page already generates from, not a
// per-request computation — safe to emit as a static file.
export const dynamic = "force-static";

/**
 * One entry per real, indexable static page — mirrors exactly what each
 * route's own `generateStaticParams()` builds (`docs/SEO.md`), reusing the
 * same page-count/slug-list functions rather than a second listing of what
 * exists. `/tim-kiem` is the one route deliberately left out: it's
 * `noIndex` in its own metadata (a search page has no canonical content of
 * its own to rank), so it doesn't belong in a sitemap either.
 *
 * `output: "export"` builds this once at build time into a static
 * `sitemap.xml`, same as every other page.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];
  const add = (path: string, lastModified?: string) => {
    entries.push({ url: absoluteUrl(path), ...(lastModified ? { lastModified } : {}) });
  };

  add("/");
  add("/video");

  const tinTucPageCount = await getTinTucPageCount();
  for (let p = 1; p <= tinTucPageCount; p++) add(pagedHref("/tin-tuc", p));

  const articleSlugs = await getArticleSlugs();
  for (const slug of articleSlugs) {
    const article = await getArticleBySlug(slug);
    add(articleHref(slug), article?.updatedAt ?? article?.publishedAt);
  }

  const categories = await getCategories();
  for (const c of categories) {
    const pageCount = await getCategoryPageCount(c.slug);
    for (let p = 1; p <= pageCount; p++) add(pagedHref(categoryHref(c.slug), p));
  }

  const topics = await getTopics();
  for (const t of topics) {
    const pageCount = await getTopicPageCount(t.slug);
    for (let p = 1; p <= pageCount; p++) add(pagedHref(topicHref(t.slug), p));
  }

  const localitySlugs = await getLocalitySlugs();
  for (const slug of localitySlugs) add(localityHref(slug));

  const unitSlugs = await getUnitSlugs();
  for (const slug of unitSlugs) add(unitHref(slug));

  const events = await getEvents();
  for (const e of events) add(eventHref(e.slug));

  return entries;
}
