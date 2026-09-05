import type { ArticleWithRelations } from "@/server/repositories/articleRepository";
import { resolveArticleContent } from "./articleContentResolver";
import { articleHref, unitHref } from "@/lib/routes";
import type { Article, ArticleSummary } from "@/domain/article";
import type { Tag } from "@/domain/taxonomy";
import type { Organization, OrganizationLevel } from "@/domain/people";
import type { Province } from "@/domain/geo";
import type { ArticleBlock } from "@/domain/articleContent";
import type { OrganizationType as PrismaOrganizationType, Province as PrismaProvince } from "@/generated/prisma/client";

/**
 * Turns a PUBLISHED `ArticleWithRelations` row into the full public `Article`
 * domain shape `ContentProvider.getArticleBySlug()`/`getAllArticles()`/etc.
 * already declare — the one place `DatabaseProvider` (`../../data-access/
 * providers/databaseProvider.ts`) goes from "a Prisma row" to "what
 * `/tin-tuc/[slug]` and every listing page already know how to render."
 *
 * Callers MUST only ever pass an article that has already cleared the
 * public policy check (`status: "PUBLISHED"` and `publishedAt` in the
 * past) — this function does not re-check either, the same "the caller
 * already filtered" contract `articleContentResolver.resolveArticleContent`
 * itself relies on. `status` is hardcoded to `"published"` below for
 * exactly that reason: nothing reaches this mapper that could honestly be
 * anything else.
 */

const ORG_TYPE_TO_LEVEL: Record<PrismaOrganizationType, OrganizationLevel> = {
  CENTRAL: "central",
  PROVINCE: "province",
  UNIVERSITY: "university",
  OVERSEAS: "overseas",
  OTHER: "other",
};

function mapProvince(province: PrismaProvince): Province {
  return { id: province.id, slug: province.slug, name: province.name, lat: province.lat, lon: province.lon };
}

/** `article.organization` here never carries its own `province` relation
 *  (`articleRepository`'s include doesn't nest that far — see
 *  `articleWithRelations`) — cheap to map what's already loaded, not worth
 *  a second query for a field nothing on the public site currently renders
 *  (`Organization.province` is UI-optional, and `Article.province` above
 *  already carries the "place" this article is datelined in). */
function mapOrganization(org: NonNullable<ArticleWithRelations["organization"]>): Organization {
  return {
    id: org.id,
    name: org.name,
    level: ORG_TYPE_TO_LEVEL[org.type],
    country: org.countryCode ?? undefined,
    url: unitHref(org.slug),
  };
}

/** A rough words-per-minute estimate (200 wpm) over the resolved body's own
 *  text-bearing blocks — the database has no authored reading-time field
 *  (the fixture's was a hand-typed number), and this is the same estimate
 *  most editorial CMSes derive rather than store. */
function extractPlainText(body: ArticleBlock[]): string {
  return body
    .map((b) => {
      switch (b.type) {
        case "paragraph":
          return b.runs.map((r) => r.text).join(" ");
        case "heading":
        case "quote":
          return b.text;
        case "table":
          return [...b.headers, ...b.rows.flat()].join(" ");
        default:
          return "";
      }
    })
    .join(" ");
}

function estimateReadingTimeMinutes(body: ArticleBlock[]): number {
  const text = extractPlainText(body).trim();
  if (!text) return 1;
  const words = text.split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

export async function mapArticleToDomain(article: ArticleWithRelations): Promise<Article> {
  const resolved = await resolveArticleContent(article);

  return {
    id: article.id,
    slug: article.slug,
    url: articleHref(article.slug),
    title: article.title,
    lead: article.excerpt ?? article.subtitle ?? undefined,
    category: { id: article.category.id, slug: article.category.slug, name: article.category.name },
    // Only ever reached with `status: "PUBLISHED"` and a past `publishedAt`
    // (the caller's policy check) — `publishedAt` is therefore never null
    // here even though the column itself is nullable.
    publishedAt: article.publishedAt!.toISOString(),
    updatedAt: article.updatedAt.toISOString(),
    coverImage: resolved.coverImage,
    place: article.province?.name,
    province: article.province ? mapProvince(article.province) : undefined,
    organization: article.organization ? mapOrganization(article.organization) : undefined,
    author: resolved.author,
    readingTimeMinutes: estimateReadingTimeMinutes(resolved.body),
    status: "published",
    body: resolved.body,
    // `Article.topics` is a real relation (`ArticleTopic`) but nothing on
    // the public site actually renders an article's own topic list today
    // (topics only ever appear the other way around, as `/chu-de/[slug]`'s
    // curated article stream) — populating it would mean computing each
    // topic's `articleCount` for a value no caller reads. Left undefined,
    // the same as the field's own optionality already allows.
    topics: undefined,
    tags: article.tags.map((t): Tag => ({ id: t.tag.id, slug: t.tag.slug, name: t.tag.name })),
  };
}

export async function mapArticleSummary(article: ArticleWithRelations): Promise<ArticleSummary> {
  return mapArticleToDomain(article);
}
