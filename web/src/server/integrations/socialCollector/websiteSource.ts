import "server-only";
import { fetchRaw } from "./httpClient";
import { rssSource } from "./rssSource";
import { extractHashtags } from "./normalize";
import type { SourceFetcher, SourceFetchInput, SourceFetchResult, NormalizedExternalPost } from "./types";

function extractMeta(html: string, prop: string): string | undefined {
  // Matches both attribute orders (`property="og:title" content="..."` and
  // `content="..." property="og:title"`), single or double quotes — real
  // HTML in the wild uses either.
  const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`, "i");
  return html.match(re1)?.[1] ?? html.match(re2)?.[1];
}

function extractTitleTag(html: string): string | undefined {
  return html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Brief section 2: `WEBSITE`. This is the "lightweight HTTP fetch, never a
 * headless browser" approach the brief's header applies beyond just
 * Facebook — no DOM rendering, no JS execution, plain `fetch()` + regex
 * over the returned HTML (the same amount of parsing this codebase
 * already does elsewhere for a single well-known tag shape, e.g.
 * `youtubeUrl.ts`'s id parser — not a general-purpose HTML parser).
 *
 * Two behaviors, tried in order:
 * 1. If the page advertises `<link rel="alternate" type="application/rss+xml">`
 *    (most Vietnamese news/CMS sites do), delegate entirely to
 *    `rssSource` against that discovered feed URL — a feed is strictly
 *    better structured data than scraping an index page's links would be.
 * 2. Otherwise, treat the configured URL itself as exactly one
 *    `ExternalItem` candidate, unfurled from its Open Graph / `<title>`
 *    meta tags. Deliberately does **not** attempt to discover and scrape
 *    multiple article links off an index page — matching many different
 *    sites' arbitrary markup reliably is far more scraping than "lightweight
 *    HTTP fetch" can honestly promise; a site that wants proper multi-item
 *    monitoring should be configured as `RSS` instead.
 */
export const websiteSource: SourceFetcher = {
  async fetchPosts(input: SourceFetchInput): Promise<SourceFetchResult> {
    if (!input.externalUrl) {
      return { ok: false, reason: "invalid_source", message: "Thiếu URL website." };
    }

    const outcome = await fetchRaw(input.externalUrl);
    if (outcome.kind === "timeout") {
      return { ok: false, reason: "network_error", message: "Hết thời gian chờ phản hồi từ website." };
    }
    if (outcome.kind === "network_error") {
      return { ok: false, reason: "network_error", message: outcome.message };
    }
    if (!outcome.ok) {
      return { ok: false, reason: "invalid_source", message: `Website trả lỗi HTTP ${outcome.status}.` };
    }

    const feedHrefMatch = outcome.text.match(/<link[^>]+rel=["']alternate["'][^>]+type=["']application\/(rss|atom)\+xml["'][^>]+href=["']([^"']+)["']/i);
    if (feedHrefMatch) {
      const feedUrl = new URL(feedHrefMatch[2], input.externalUrl).toString();
      return rssSource.fetchPosts({ ...input, externalUrl: feedUrl });
    }

    const title = extractMeta(outcome.text, "og:title") ?? extractTitleTag(outcome.text);
    const description = extractMeta(outcome.text, "og:description") ?? extractMeta(outcome.text, "description");
    const contentText = decodeEntities(description ?? title ?? "");
    if (!contentText) {
      return { ok: false, reason: "invalid_source", message: "Không tìm thấy tiêu đề/mô tả (Open Graph hoặc <title>) trên trang." };
    }

    const post: NormalizedExternalPost = {
      url: input.externalUrl,
      title: title ? decodeEntities(title) : undefined,
      excerpt: contentText.length > 200 ? `${contentText.slice(0, 200)}…` : contentText,
      contentText,
      hashtags: extractHashtags(contentText),
    };
    return { ok: true, posts: [post] };
  },
};
