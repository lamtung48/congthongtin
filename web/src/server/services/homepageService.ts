import { cache } from "react";
import { homepageRepository } from "@/server/repositories/homepageRepository";
import { articleRepository, type ArticleWithRelations } from "@/server/repositories/articleRepository";
import type { HomepagePlacement, HomepageSectionKey } from "@/generated/prisma/client";

/**
 * Brief section 11: "phải giữ fallback tự động nếu CMS chưa cấu hình." A
 * section resolves its *configured* placements (enabled, and within
 * `activeFrom`/`activeUntil` if set) when any exist; otherwise it falls back
 * to `homepageRepository.fallback`'s "most recent N" query for that section.
 * The homepage is never empty just because nobody has opened the (not yet
 * built) CMS UI — see docs/BACKEND_ARCHITECTURE.md, "Homepage configuration
 * & fallback".
 */

function isPlacementActive(p: HomepagePlacement, now: Date): boolean {
  if (!p.isEnabled) return false;
  if (p.activeFrom && p.activeFrom > now) return false;
  if (p.activeUntil && p.activeUntil < now) return false;
  return true;
}

async function resolveSection(
  sections: Awaited<ReturnType<typeof homepageRepository.findActiveConfiguration>> extends { sections: infer S } | null ? S : never,
  key: HomepageSectionKey,
) {
  const section = sections?.find((s) => s.key === key && s.isEnabled);
  const now = new Date();
  const activePlacements = section?.placements.filter((p) => isPlacementActive(p, now)) ?? [];
  return { section, placements: activePlacements };
}

/**
 * Resolves every `ARTICLE`-typed placement in `placements` to its real,
 * currently-public `Article` row — silently dropping (never throwing) a
 * placement whose target has since been unpublished/deleted, or one that
 * was pinned to the wrong `HomepageSectionKey`'s content type entirely
 * (`contentType !== "ARTICLE"`). The Production Data Policy task's own
 * rule — PUBLISHED + a past `publishedAt` — applies here exactly as it does
 * everywhere else content reaches the public site: a CMS-pinned placement
 * is not a bypass. An Admin staging a DRAFT as next week's Hero pick before
 * it's ready would otherwise leak that draft to every visitor the moment
 * the placement is saved, which is precisely what this task's Production
 * Data Policy forbids.
 */
async function resolveArticlePlacements(placements: HomepagePlacement[]): Promise<ArticleWithRelations[]> {
  const now = new Date();
  const resolved = await Promise.all(
    placements
      .filter((p) => p.contentType === "ARTICLE")
      .map((p) => articleRepository.findById(p.contentId)),
  );
  return resolved.filter(
    (a): a is ArticleWithRelations => !!a && a.status === "PUBLISHED" && !!a.publishedAt && a.publishedAt <= now,
  );
}

async function resolveVideoPlacements(placements: HomepagePlacement[]) {
  const resolved = await Promise.all(
    placements.filter((p) => p.contentType === "VIDEO").map((p) => homepageRepository.resolvers.video(p.contentId)),
  );
  return resolved.filter((v) => v !== null);
}

async function resolveEventPlacements(placements: HomepagePlacement[]) {
  const resolved = await Promise.all(
    placements.filter((p) => p.contentType === "EVENT").map((p) => homepageRepository.resolvers.event(p.contentId)),
  );
  return resolved.filter((e) => e !== null);
}

/** Drops a placement pointing at a platform that's since been disabled
 *  (brief section 7's "display state") — a CMS pin is not a bypass of that
 *  toggle, same reasoning as `resolveArticlePlacements`'s Production Data
 *  Policy check for a pinned-but-unpublished article. */
async function resolvePlatformPlacements(placements: HomepagePlacement[]) {
  const resolved = await Promise.all(
    placements.filter((p) => p.contentType === "PLATFORM").map((p) => homepageRepository.resolvers.platform(p.contentId)),
  );
  return resolved.filter((p): p is NonNullable<typeof p> => p !== null && p.isEnabled);
}

async function resolveGalleryPlacement(placements: HomepagePlacement[]) {
  const galleryPlacement = placements.find((p) => p.contentType === "GALLERY");
  return galleryPlacement ? homepageRepository.resolvers.gallery(galleryPlacement.contentId) : null;
}

/**
 * Returns the resolved content for every homepage section — each key maps
 * to either its configured `HomepagePlacement`s (fully joined to their real
 * Article/Video/Event/Platform/Gallery rows, CMS's choice, in `order`) or
 * the automatic fallback query's result. `hero`/`video`/`gallery` resolve
 * to a single entity-or-`null` (one Hero, one featured video, one gallery);
 * `featured`/`storyRail`/`platforms`/`events`/`localNews` resolve to
 * arrays. Callers don't need to know which path (configured vs. fallback)
 * produced a given result, only its shape — `DatabaseProvider`
 * (`src/data-access/providers/databaseProvider.ts`) maps this directly into
 * the exact `HomepageConfiguration`/`FeaturedNewsResult`/etc. shapes
 * `src/data-access/provider.ts` declares.
 *
 * `cache()`-wrapped: `DatabaseProvider` calls this independently from
 * several different `ContentProvider` methods (`getFeaturedArticles`,
 * `getStoryRail`, `getVideos`'s homepage pick, `getEvents`, `getGallery`,
 * `getLocalNews`, ...), all of which the homepage renders in one
 * `Promise.all` — without memoizing, each would re-run this same set of
 * section/fallback queries independently in the same request.
 */
const resolveHomepage = cache(async () => {
    const config = await homepageRepository.findActiveConfiguration();
    const sections = config?.sections ?? [];

    const heroSection = await resolveSection(sections, "HERO");
    const heroArticles = await resolveArticlePlacements(heroSection.placements);
    const hero = heroArticles[0] ?? (await homepageRepository.fallback.heroArticle());

    const featuredSection = await resolveSection(sections, "FEATURED_ARTICLES");
    const featuredArticles = await resolveArticlePlacements(featuredSection.placements);
    const featured = featuredArticles.length ? featuredArticles : await homepageRepository.fallback.featuredArticles(6);

    const storyRailSection = await resolveSection(sections, "STORY_RAIL");
    const storyRailArticles = await resolveArticlePlacements(storyRailSection.placements);
    const storyRail = storyRailArticles.length ? storyRailArticles : await homepageRepository.fallback.storyRailArticles(10);

    const videoSection = await resolveSection(sections, "VIDEO_FEATURE");
    const videoPlacements = await resolveVideoPlacements(videoSection.placements);
    const video = videoPlacements[0] ?? (await homepageRepository.fallback.latestVideo());

    const platformsSection = await resolveSection(sections, "PLATFORM_CARDS");
    const platformPlacements = await resolvePlatformPlacements(platformsSection.placements);
    const platforms = platformPlacements.length ? platformPlacements : await homepageRepository.fallback.platforms(6);

    const eventsSection = await resolveSection(sections, "EVENTS");
    const eventPlacements = await resolveEventPlacements(eventsSection.placements);
    const events = eventPlacements.length ? eventPlacements : await homepageRepository.fallback.upcomingEvents(6);

    const gallerySection = await resolveSection(sections, "GALLERY");
    const galleryPlacement = await resolveGalleryPlacement(gallerySection.placements);
    const gallery = galleryPlacement ?? (await homepageRepository.fallback.latestGallery());

    const localNewsSection = await resolveSection(sections, "LOCAL_NEWS");
    const localNewsArticles = await resolveArticlePlacements(localNewsSection.placements);
    const localNews = localNewsArticles.length ? localNewsArticles : await homepageRepository.fallback.localNewsArticles(6);

    return { hero, featured, storyRail, video, platforms, events, gallery, localNews };
});

export const homepageService = {
  resolveHomepage,
};
