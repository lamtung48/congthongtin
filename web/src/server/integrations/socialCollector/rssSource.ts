import "server-only";
import { XMLParser } from "fast-xml-parser";
import { fetchRaw } from "./httpClient";
import { extractHashtags } from "./normalize";
import type { SourceFetcher, SourceFetchInput, SourceFetchResult, NormalizedExternalPost } from "./types";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

/** Strips HTML tags a feed's `description`/`content:encoded` commonly
 *  wraps its text in — this task needs plain `contentText` for hashtag
 *  extraction and the eventual Article draft body, not a second HTML
 *  parser/sanitizer (out of scope; brief section 5's "biên tập thành
 *  Draft" step is where a human cleans this up before publishing). */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function textOf(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "#text" in value) return String((value as { "#text": unknown })["#text"]);
  return undefined;
}

interface RssItem {
  title?: unknown;
  link?: unknown;
  guid?: unknown;
  description?: unknown;
  "content:encoded"?: unknown;
  pubDate?: unknown;
}

interface AtomEntry {
  title?: unknown;
  link?: { "@_href"?: string } | { "@_href"?: string }[];
  id?: unknown;
  summary?: unknown;
  content?: unknown;
  published?: unknown;
  updated?: unknown;
}

/**
 * Brief section 2: `RSS`. Parses both RSS 2.0 (`<rss><channel><item>`) and
 * Atom (`<feed><entry>`) — the two feed formats real Vietnamese news sites
 * actually publish — with `fast-xml-parser` (a real XML parser, not a
 * regex scrape of tag soup). No browser automation, no headless rendering:
 * a feed is already structured data meant to be machine-read.
 */
export const rssSource: SourceFetcher = {
  async fetchPosts(input: SourceFetchInput): Promise<SourceFetchResult> {
    if (!input.externalUrl) {
      return { ok: false, reason: "invalid_source", message: "Thiếu URL feed RSS/Atom." };
    }

    const outcome = await fetchRaw(input.externalUrl);
    if (outcome.kind === "timeout") {
      return { ok: false, reason: "network_error", message: "Hết thời gian chờ phản hồi từ feed RSS/Atom." };
    }
    if (outcome.kind === "network_error") {
      return { ok: false, reason: "network_error", message: outcome.message };
    }
    if (!outcome.ok) {
      return { ok: false, reason: "invalid_source", message: `Feed trả lỗi HTTP ${outcome.status}.` };
    }

    let parsed: unknown;
    try {
      parsed = parser.parse(outcome.text);
    } catch {
      return { ok: false, reason: "invalid_source", message: "Không parse được feed — không phải XML hợp lệ." };
    }

    const root = parsed as { rss?: { channel?: { item?: RssItem | RssItem[] } }; feed?: { entry?: AtomEntry | AtomEntry[] } };
    const posts: NormalizedExternalPost[] = [];

    if (root.rss?.channel) {
      for (const item of asArray(root.rss.channel.item)) {
        const rawBody = textOf(item["content:encoded"]) ?? textOf(item.description) ?? "";
        const contentText = stripHtml(rawBody);
        const link = textOf(item.link);
        if (!link || !contentText) continue;
        posts.push({
          externalId: textOf(item.guid) ?? link,
          url: link,
          title: textOf(item.title),
          excerpt: contentText.length > 200 ? `${contentText.slice(0, 200)}…` : contentText,
          contentText,
          publishedAt: textOf(item.pubDate) ? new Date(textOf(item.pubDate)!) : undefined,
          hashtags: extractHashtags(contentText),
        });
      }
    } else if (root.feed?.entry) {
      for (const entry of asArray(root.feed.entry)) {
        const rawBody = textOf(entry.content) ?? textOf(entry.summary) ?? "";
        const contentText = stripHtml(rawBody);
        const linkField = Array.isArray(entry.link) ? entry.link[0] : entry.link;
        const link = linkField?.["@_href"];
        if (!link || !contentText) continue;
        posts.push({
          externalId: textOf(entry.id) ?? link,
          url: link,
          title: textOf(entry.title),
          excerpt: contentText.length > 200 ? `${contentText.slice(0, 200)}…` : contentText,
          contentText,
          publishedAt: textOf(entry.published) ? new Date(textOf(entry.published)!) : textOf(entry.updated) ? new Date(textOf(entry.updated)!) : undefined,
          hashtags: extractHashtags(contentText),
        });
      }
    } else {
      return { ok: false, reason: "invalid_source", message: "Không nhận diện được định dạng feed (không phải RSS 2.0 hay Atom)." };
    }

    return { ok: true, posts };
  },
};
