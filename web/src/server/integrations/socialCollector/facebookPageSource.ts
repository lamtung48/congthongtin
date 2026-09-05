import "server-only";
import { fetchRaw } from "./httpClient";
import { extractHashtags } from "./normalize";
import type { SourceFetcher, SourceFetchInput, SourceFetchResult, NormalizedExternalPost } from "./types";

const GRAPH_API_VERSION = "v19.0";
const FIELDS = "id,message,permalink_url,created_time";

interface GraphPost {
  id: string;
  message?: string;
  permalink_url?: string;
  created_time?: string;
}

interface GraphErrorBody {
  error?: { message: string; code?: number };
}

/**
 * Brief section 4: "Dùng Meta API hợp lệ... Không giả định search toàn
 * Facebook theo hashtag. Mô hình: whitelist Page → fetch hợp lệ →
 * normalize → filter hashtag/category." Calls exactly one Graph API
 * endpoint — `/{page-id}/posts` for the Page this `Source` whitelists
 * (`input.externalId`) — using a Page access token
 * (`input.credential`). There is no Graph API endpoint for "search all of
 * Facebook by hashtag" with a normal Page token, and this fetcher makes
 * no attempt to fake one; hashtag/category filtering happens afterward,
 * in `sourceService.sync()`, against posts this call already legitimately
 * returned.
 */
export const facebookPageSource: SourceFetcher = {
  async fetchPosts(input: SourceFetchInput): Promise<SourceFetchResult> {
    if (!input.externalId || !input.credential) {
      return { ok: false, reason: "invalid_source", message: "Thiếu Page ID hoặc access token cho nguồn Facebook." };
    }

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(input.externalId)}/posts?fields=${FIELDS}&access_token=${encodeURIComponent(input.credential)}`;
    const outcome = await fetchRaw(url);
    if (outcome.kind === "timeout") {
      return { ok: false, reason: "network_error", message: "Hết thời gian chờ phản hồi từ Facebook Graph API." };
    }
    if (outcome.kind === "network_error") {
      return { ok: false, reason: "network_error", message: outcome.message };
    }

    let body: unknown;
    try {
      body = JSON.parse(outcome.text);
    } catch {
      return { ok: false, reason: "invalid_source", message: "Facebook Graph API trả về dữ liệu không phải JSON hợp lệ." };
    }

    if (!outcome.ok) {
      const err = (body as GraphErrorBody).error;
      // Graph API error codes: 190 = invalid/expired access token; 4, 17,
      // 32, 613 = various application/user rate-limit conditions. See
      // https://developers.facebook.com/docs/graph-api/guides/error-handling.
      if (err?.code === 190) {
        return { ok: false, reason: "token_expired", message: "Access token của Facebook Page đã hết hạn hoặc bị thu hồi." };
      }
      if (err?.code === 4 || err?.code === 17 || err?.code === 32 || err?.code === 613) {
        return { ok: false, reason: "quota_exceeded", message: "Facebook Graph API đã đạt giới hạn tần suất gọi (rate limit)." };
      }
      return { ok: false, reason: "invalid_source", message: err?.message ?? `Facebook Graph API trả lỗi (HTTP ${outcome.status}).` };
    }

    const rows = (body as { data?: GraphPost[] }).data ?? [];
    const posts: NormalizedExternalPost[] = rows
      .filter((p): p is GraphPost & { message: string } => !!p.message)
      .map((p) => ({
        externalId: p.id,
        url: p.permalink_url ?? `https://www.facebook.com/${p.id}`,
        contentText: p.message,
        excerpt: p.message.length > 200 ? `${p.message.slice(0, 200)}…` : p.message,
        publishedAt: p.created_time ? new Date(p.created_time) : undefined,
        hashtags: extractHashtags(p.message),
      }));

    return { ok: true, posts };
  },
};
