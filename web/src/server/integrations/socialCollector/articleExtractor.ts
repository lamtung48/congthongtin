import "server-only";
import { parse, type HTMLElement } from "node-html-parser";

/**
 * Best-effort extraction of an article's real body from its HTML page —
 * used by the collector when a `Source` has `fetchFullBody` (the RSS feed
 * itself carries only a summary). Not a headless browser: `node-html-parser`
 * over the server-rendered HTML, then a walk that keeps paragraphs,
 * H2/H3s and images and drops everything else. Images are kept as absolute
 * source URLs (hot-linked, never downloaded).
 *
 * The result is `ArticleBlockInput`-shaped so `socialInboxService`'s
 * convert step can drop it straight into a DRAFT for a human to clean up.
 */

export type ExtractedBlock =
  | { type: "PARAGRAPH"; data: { runs: { text: string }[] } }
  | { type: "HEADING"; data: { text: string; level: 2 | 3 } }
  | { type: "IMAGE"; data: { externalUrl: string; caption: string } };

export interface ExtractedArticle {
  blocks: ExtractedBlock[];
  coverImageUrl?: string;
}

const BODY_SELECTORS = [
  '[itemprop="articleBody"]',
  ".article__body",
  ".cms-body",
  ".article-content",
  ".detail-content",
  ".content-detail",
  "article",
];

const DROP_ANCESTOR = /(related|tag|share|social|comment|advert|banner|newsletter|breadcrumb|meta|author|source-|box-)/i;

function absolutize(src: string | undefined, base: string): string | undefined {
  if (!src) return undefined;
  try {
    const u = new URL(src, base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

function metaContent(root: HTMLElement, prop: string): string | undefined {
  const el =
    root.querySelector(`meta[property="${prop}"]`) ?? root.querySelector(`meta[name="${prop}"]`);
  return el?.getAttribute("content")?.trim() || undefined;
}

/** Pick the body container: a configured selector, then known ones, then
 *  the element with the most direct `<p>` children. */
function findBodyContainer(root: HTMLElement, contentSelector?: string): HTMLElement | null {
  if (contentSelector) {
    const el = root.querySelector(contentSelector);
    if (el) return el;
  }
  for (const sel of BODY_SELECTORS) {
    const el = root.querySelector(sel);
    if (el && el.querySelectorAll("p").length >= 2) return el;
  }
  // Fallback: the most specific (fewest descendants) block that still holds
  // ≥3 paragraphs — avoids grabbing a whole-page wrapper.
  const candidates = root
    .querySelectorAll("main, section, div")
    .filter((d) => d.querySelectorAll("p").length >= 3);
  candidates.sort((a, b) => a.querySelectorAll("*").length - b.querySelectorAll("*").length);
  return candidates[0] ?? null;
}

function insideDropZone(el: HTMLElement): boolean {
  let cur: HTMLElement | null = el;
  let hops = 0;
  while (cur && hops < 6) {
    const cls = `${cur.getAttribute("class") ?? ""} ${cur.getAttribute("id") ?? ""}`;
    if (DROP_ANCESTOR.test(cls)) return true;
    cur = cur.parentNode as HTMLElement | null;
    hops++;
  }
  return false;
}

export function extractArticle(html: string, pageUrl: string, opts: { contentSelector?: string } = {}): ExtractedArticle {
  const root = parse(html, { blockTextElements: { script: false, style: false, noscript: false } });
  const coverImageUrl = absolutize(metaContent(root, "og:image"), pageUrl);

  const container = findBodyContainer(root, opts.contentSelector);
  if (!container) return { blocks: [], coverImageUrl };

  const blocks: ExtractedBlock[] = [];
  const seenImg = new Set<string>();
  let textLen = 0;

  const nodes = container.querySelectorAll("p, h2, h3, img, figure, figcaption");
  for (const node of nodes) {
    if (blocks.length >= 140 || textLen > 40_000) break;
    const tag = node.tagName?.toLowerCase();

    if (tag === "img" || tag === "figure") {
      const img = tag === "img" ? node : node.querySelector("img");
      if (!img || insideDropZone(node)) continue;
      const src =
        absolutize(img.getAttribute("src"), pageUrl) ??
        absolutize(img.getAttribute("data-src"), pageUrl) ??
        absolutize(img.getAttribute("data-original"), pageUrl);
      if (!src || seenImg.has(src)) continue;
      seenImg.add(src);
      const cap =
        node.querySelector("figcaption")?.structuredText?.trim() ||
        img.getAttribute("alt")?.trim() ||
        "";
      blocks.push({ type: "IMAGE", data: { externalUrl: src, caption: cap.slice(0, 300) } });
      continue;
    }

    if (tag === "figcaption") continue; // handled with its <figure>

    if (insideDropZone(node)) continue;
    const text = node.structuredText.replace(/\s+/g, " ").trim();
    if (!text) continue;

    if (tag === "h2" || tag === "h3") {
      blocks.push({ type: "HEADING", data: { text: text.slice(0, 200), level: tag === "h2" ? 2 : 3 } });
    } else {
      // skip boilerplate one-liners a body sometimes ends with
      if (/^(theo|nguồn|ảnh|clip)[:.]/i.test(text) && text.length < 60) continue;
      blocks.push({ type: "PARAGRAPH", data: { runs: [{ text }] } });
      textLen += text.length;
    }
  }

  return { blocks, coverImageUrl };
}
