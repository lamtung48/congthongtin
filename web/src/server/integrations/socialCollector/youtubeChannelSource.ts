import "server-only";
import { fetchRaw } from "./httpClient";
import { extractHashtags } from "./normalize";
import type { SourceFetcher, SourceFetchInput, SourceFetchResult, NormalizedExternalPost } from "./types";

interface SearchItem {
  id?: { videoId?: string };
  snippet?: { title?: string; description?: string; publishedAt?: string };
}

interface SearchErrorBody {
  error?: { code?: number; message?: string; errors?: { reason?: string }[] };
}

/**
 * Brief section 2: `YOUTUBE` — monitoring an *external* channel's public
 * uploads as collector content, unrelated to `src/server/integrations/
 * youtube.ts` (this app's own OAuth-connected upload channel for hosting
 * article video). Uses the public YouTube Data API v3 `search` endpoint
 * with a simple API key (`input.credential`) — no OAuth, since reading a
 * public channel's public videos needs no user consent, only a project
 * API key with the YouTube Data API enabled.
 */
export const youtubeChannelSource: SourceFetcher = {
  async fetchPosts(input: SourceFetchInput): Promise<SourceFetchResult> {
    if (!input.externalId || !input.credential) {
      return { ok: false, reason: "invalid_source", message: "Thiếu Channel ID hoặc API key cho nguồn YouTube." };
    }

    const params = new URLSearchParams({
      part: "snippet",
      channelId: input.externalId,
      order: "date",
      type: "video",
      maxResults: "15",
      key: input.credential,
    });
    const outcome = await fetchRaw(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
    if (outcome.kind === "timeout") {
      return { ok: false, reason: "network_error", message: "Hết thời gian chờ phản hồi từ YouTube Data API." };
    }
    if (outcome.kind === "network_error") {
      return { ok: false, reason: "network_error", message: outcome.message };
    }

    let body: unknown;
    try {
      body = JSON.parse(outcome.text);
    } catch {
      return { ok: false, reason: "invalid_source", message: "YouTube Data API trả về dữ liệu không phải JSON hợp lệ." };
    }

    if (!outcome.ok) {
      const err = (body as SearchErrorBody).error;
      const reason = err?.errors?.[0]?.reason;
      if (reason === "quotaExceeded" || reason === "dailyLimitExceeded" || reason === "rateLimitExceeded") {
        return { ok: false, reason: "quota_exceeded", message: "YouTube Data API đã đạt giới hạn quota." };
      }
      if (reason === "keyInvalid" || reason === "forbidden" || reason === "badRequest") {
        return { ok: false, reason: "token_expired", message: "API key YouTube không hợp lệ hoặc đã bị thu hồi." };
      }
      return { ok: false, reason: "invalid_source", message: err?.message ?? `YouTube Data API trả lỗi (HTTP ${outcome.status}).` };
    }

    const rows = (body as { items?: SearchItem[] }).items ?? [];
    const posts: NormalizedExternalPost[] = rows
      .filter((i): i is SearchItem & { id: { videoId: string }; snippet: { title: string } } => !!i.id?.videoId && !!i.snippet?.title)
      .map((i) => {
        const description = i.snippet.description ?? "";
        const contentText = `${i.snippet.title}${description ? `\n\n${description}` : ""}`;
        return {
          externalId: i.id.videoId,
          url: `https://www.youtube.com/watch?v=${i.id.videoId}`,
          title: i.snippet.title,
          excerpt: description.length > 200 ? `${description.slice(0, 200)}…` : description || undefined,
          contentText,
          publishedAt: i.snippet.publishedAt ? new Date(i.snippet.publishedAt) : undefined,
          hashtags: extractHashtags(contentText),
        };
      });

    return { ok: true, posts };
  },
};
