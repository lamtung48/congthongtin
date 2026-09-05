import "server-only";
import type { SourceType } from "@/generated/prisma/client";
import { facebookPageSource } from "./facebookPageSource";
import { rssSource } from "./rssSource";
import { websiteSource } from "./websiteSource";
import { youtubeChannelSource } from "./youtubeChannelSource";
import type { SourceFetcher } from "./types";

/**
 * `MANUAL_EXTERNAL` has no fetcher — every item under it is pasted by
 * hand through the Social Inbox UI (`socialInboxService.createManual`),
 * never `sync()`ed. `sourceService.sync()` refuses cleanly ("not
 * configured") if ever called for it, rather than this map needing a
 * dummy entry.
 */
const FETCHERS: Partial<Record<SourceType, SourceFetcher>> = {
  FACEBOOK_PAGE: facebookPageSource,
  RSS: rssSource,
  WEBSITE: websiteSource,
  YOUTUBE: youtubeChannelSource,
};

export function getFetcherForSourceType(type: SourceType): SourceFetcher | undefined {
  return FETCHERS[type];
}
