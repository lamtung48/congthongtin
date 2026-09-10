import type { Metadata } from "next";
import { Hero } from "@/components/home/Hero";
import { TrendingTopics } from "@/components/home/TrendingTopics";
import { FeaturedNews } from "@/components/home/FeaturedNews";
import { StoryRail } from "@/components/home/StoryRail";
import { VideoSection } from "@/components/home/VideoSection";
import { ActivityMapSection } from "@/components/home/ActivityMapSection";
import { EcosystemBento } from "@/components/home/EcosystemBento";
import { LiveEvents } from "@/components/home/LiveEvents";
import { Gallery } from "@/components/home/Gallery";
import { DocumentsSection } from "@/components/home/DocumentsSection";
import { LocalNews } from "@/components/home/LocalNews";
import {
  getHomepage,
  getFeaturedArticles,
  getStoryRail,
  getVideos,
  getEvents,
  getPlatforms,
  getLocalNews,
  getGallery,
} from "@/services/homepageService";
import { documentService } from "@/server/services/documentService";
import { pageMetadata } from "@/lib/seo";
import { SITE_DEFAULT_DESCRIPTION } from "@/lib/siteConfig";

// The only route that doesn't get its title from `pageMetadata()`'s normal
// templating — see `titleIsAbsolute` in `lib/seo.ts`.
export const metadata: Metadata = pageMetadata({
  title: "Cổng thông tin số — Hội Sinh viên Việt Nam",
  description: SITE_DEFAULT_DESCRIPTION,
  path: "/",
  titleIsAbsolute: true,
});

/** Header/Footer render once in `app/layout.tsx` — this page is only its own
 *  sections. See `docs/ROUTES.md` on why layout isn't duplicated per route.
 *
 *  "Tin mới nhất" (`LatestNews`) is deliberately not rendered: it repeated
 *  the same newest articles "Tin tiêu điểm" already leads with. `/tin-tuc`
 *  remains the full reverse-chronological listing. */
export default async function Home() {
  const [homepage, featured, storyRail, videos, events, platforms, localNews, gallery, documents] =
    await Promise.all([
      getHomepage(),
      getFeaturedArticles(),
      getStoryRail(),
      getVideos(),
      getEvents(),
      getPlatforms(),
      getLocalNews(),
      getGallery(),
      // Six newest published văn bản; the section removes itself when there
      // are none (see DocumentsSection).
      documentService.listPublic({ take: 6 }),
    ]);

  return (
    <>
      <Hero slides={homepage.hero} />
      <TrendingTopics topics={homepage.trendingTopics} />
      <FeaturedNews featured={featured} />
      <StoryRail stories={storyRail} />
      <ActivityMapSection />
      <VideoSection videos={videos} />
      <EcosystemBento platforms={platforms} />
      <LiveEvents events={events} />
      <DocumentsSection documents={documents} />
      {gallery.items.length > 0 && <Gallery gallery={gallery} />}
      <LocalNews items={localNews} />
    </>
  );
}
