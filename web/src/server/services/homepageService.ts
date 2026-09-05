import { homepageRepository } from "@/server/repositories/homepageRepository";
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

export const homepageService = {
  /**
   * Returns the resolved content for every homepage section: each section
   * key maps to either its configured `HomepagePlacement[]` (the CMS's
   * choice, in `order`) or the automatic fallback query's result — callers
   * don't need to know which one they got, only that something renderable
   * came back. A future `DatabaseProvider.getHomepage()` maps this into the
   * exact `HomepageConfiguration`/`FeaturedNewsResult`/etc. shapes
   * `src/data-access/provider.ts` already declares.
   */
  async resolveHomepage() {
    const config = await homepageRepository.findActiveConfiguration();
    const sections = config?.sections ?? [];

    const hero = await resolveSection(sections, "HERO");
    const featured = await resolveSection(sections, "FEATURED_ARTICLES");
    const storyRail = await resolveSection(sections, "STORY_RAIL");
    const video = await resolveSection(sections, "VIDEO_FEATURE");
    const platforms = await resolveSection(sections, "PLATFORM_CARDS");
    const events = await resolveSection(sections, "EVENTS");
    const gallery = await resolveSection(sections, "GALLERY");
    const localNews = await resolveSection(sections, "LOCAL_NEWS");

    return {
      hero: hero.placements.length ? hero.placements : await homepageRepository.fallback.heroArticle(),
      featured: featured.placements.length ? featured.placements : await homepageRepository.fallback.featuredArticles(6),
      storyRail: storyRail.placements.length ? storyRail.placements : await homepageRepository.fallback.storyRailArticles(10),
      video: video.placements.length ? video.placements : await homepageRepository.fallback.latestVideo(),
      platforms: platforms.placements.length ? platforms.placements : await homepageRepository.fallback.platforms(6),
      events: events.placements.length ? events.placements : await homepageRepository.fallback.upcomingEvents(6),
      gallery: gallery.placements.length ? gallery.placements : await homepageRepository.fallback.latestGallery(),
      localNews: localNews.placements.length ? localNews.placements : await homepageRepository.fallback.localNewsArticles(6),
    };
  },
};
