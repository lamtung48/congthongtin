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
