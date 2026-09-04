import type { Metadata } from "next";
import { Hero } from "@/components/home/Hero";
import { TrendingTopics } from "@/components/home/TrendingTopics";
import { FeaturedNews } from "@/components/home/FeaturedNews";
import { StoryRail } from "@/components/home/StoryRail";
import { LatestNews } from "@/components/home/LatestNews";
import { VideoSection } from "@/components/home/VideoSection";
import { ActivityMapSection } from "@/components/home/ActivityMapSection";
import { EcosystemBento } from "@/components/home/EcosystemBento";
import { LiveEvents } from "@/components/home/LiveEvents";
import { Gallery } from "@/components/home/Gallery";
import { LocalNews } from "@/components/home/LocalNews";
import {
  getHomepage,
  getFeaturedArticles,
  getLatestArticles,
  getStoryRail,
  getVideos,
  getEvents,
  getPlatforms,
  getLocalNews,
  getGallery,
} from "@/services/homepageService";
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
 *  13 sections. See `docs/ROUTES.md` on why layout isn't duplicated per route. */
export default async function Home() {
  const [homepage, featured, latestArticles, storyRail, videos, events, platforms, localNews, gallery] =
    await Promise.all([
      getHomepage(),
      getFeaturedArticles(),
      getLatestArticles(),
      getStoryRail(),
      getVideos(),
      getEvents(),
      getPlatforms(),
      getLocalNews(),
      getGallery(),
    ]);

  return (
    <>
      <Hero hero={homepage.hero} />
      <TrendingTopics topics={homepage.trendingTopics} />
      <FeaturedNews featured={featured} />
      <StoryRail stories={storyRail} />
      <LatestNews articles={latestArticles} />
      <VideoSection videos={videos} />
      <ActivityMapSection />
      <EcosystemBento platforms={platforms} />
      <LiveEvents events={events} />
      <Gallery gallery={gallery} />
      <LocalNews items={localNews} />
    </>
  );
}
