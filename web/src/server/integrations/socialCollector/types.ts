/**
 * Social/External Content Collector task, brief section 4/5: the shared
 * contract every source-type fetcher (`facebookPageSource.ts`,
 * `rssSource.ts`, `websiteSource.ts`, `youtubeChannelSource.ts`)
 * implements. `sourceService.sync()` only ever calls `fetchPosts()` and
 * handles the result generically — it never knows Facebook's JSON shape,
 * RSS's XML shape, or YouTube's API response shape; each fetcher owns
 * that parsing entirely and hands back the one normalized shape below.
 * Mirrors `platformAdapters/types.ts`'s split exactly (same reasoning,
 * different domain).
 */

export interface NormalizedExternalPost {
  /** Platform-native id (Facebook post id, RSS guid/link, YouTube video
   *  id) — `undefined` only for `WEBSITE` posts with no stable id of
   *  their own (dedup then falls back to URL/content-hash matching). */
  externalId?: string;
  url: string;
  title?: string;
  excerpt?: string;
  contentText: string;
  publishedAt?: Date;
  /** Extracted from `contentText` (e.g. `#tinhnguyen`) — brief section 9:
   *  hashtag rules run against this, never against a live platform search. */
  hashtags: string[];
}

export interface SourceFetchSuccess {
  ok: true;
  posts: NormalizedExternalPost[];
}

/** Brief section 10's four failure kinds, already carrying a Vietnamese
 *  message ready to show an Admin/Manager directly — `sourceService.sync()`
 *  never has to know which fetcher produced it or why. */
export interface SourceFetchFailure {
  ok: false;
  reason: "token_expired" | "quota_exceeded" | "network_error" | "invalid_source";
  message: string;
}

export type SourceFetchResult = SourceFetchSuccess | SourceFetchFailure;

/** What a fetcher needs from the `Source` row — never the whole Prisma
 *  model, so a fetcher can't accidentally reach for a field that belongs
 *  to a different source type. */
export interface SourceFetchInput {
  externalUrl: string | null;
  externalId: string | null;
  /** Already decrypted by `sourceService.sync()` — a fetcher never touches
   *  `secretBox.ts` itself. `null` when the source has none configured. */
  credential: string | null;
}

export interface SourceFetcher {
  fetchPosts(input: SourceFetchInput): Promise<SourceFetchResult>;
}
