import { Header } from "@/components/home/Header";
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
import { Footer } from "@/components/home/Footer";

export default function Home() {
  return (
    <div style={{ background: "var(--surface-page)", minHeight: "100vh", overflowX: "hidden" }}>
      <Header />
      <Hero />
      <TrendingTopics />
      <FeaturedNews />
      <StoryRail />
      <LatestNews />
      <VideoSection />
      <ActivityMapSection />
      <EcosystemBento />
      <LiveEvents />
      <Gallery />
      <LocalNews />
      <Footer />
    </div>
  );
}
