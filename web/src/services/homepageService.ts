import { getContentProvider } from "@/data-access";
import type { ArticleSummary } from "@/domain/article";
import type { Video } from "@/domain/video";
import type { Event } from "@/domain/event";
import type { Platform } from "@/domain/platform";
import type { HomepageConfiguration } from "@/domain/homepage";
import type { ActivityMapDataset } from "@/domain/activity";
import type { Gallery } from "@/domain/media";
import type { FeaturedNewsResult, LocalNewsEntry, StoryRailItem } from "@/data-access/types";

/**
 * Everything a UI component needs sits behind one of these functions —
 * components and `page.tsx` call these, never `getContentProvider()` or a
 * provider class directly. Each function is a thin pass-through today; this
 * is the seam where cross-cutting composition (caching, revalidation,
 * request-scoped auth) would be added later without touching providers or
 * components. See `docs/DATA_ACCESS.md`.
 */

export function getHomepage(): Promise<HomepageConfiguration> {
  return getContentProvider().getHomepage();
}

export function getFeaturedArticles(): Promise<FeaturedNewsResult> {
  return getContentProvider().getFeaturedArticles();
}

export function getLatestArticles(): Promise<ArticleSummary[]> {
  return getContentProvider().getLatestArticles();
}

export function getStoryRail(): Promise<StoryRailItem[]> {
  return getContentProvider().getStoryRail();
}

export function getVideos(): Promise<Video[]> {
  return getContentProvider().getVideos();
}

export function getEvents(): Promise<Event[]> {
  return getContentProvider().getEvents();
}

export function getPlatforms(): Promise<Platform[]> {
  return getContentProvider().getPlatforms();
}

export function getActivityMap(): Promise<ActivityMapDataset> {
  return getContentProvider().getActivityMap();
}

export function getLocalNews(): Promise<LocalNewsEntry[]> {
  return getContentProvider().getLocalNews();
}

export function getGallery(): Promise<Gallery> {
  return getContentProvider().getGallery();
}
