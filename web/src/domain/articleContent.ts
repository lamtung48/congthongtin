import type { ID } from "./common";
import type { MediaAsset } from "./media";

/**
 * The typed block system an article body is made of. A CMS integration
 * later has to produce this exact union (or a mapper in front of
 * `ContentProvider` does) — nothing downstream of `ArticleBody` ever
 * touches raw HTML (`dangerouslySetInnerHTML`), so a block is the only way
 * to get content into an article.
 */

/** One run of inline text inside a paragraph — the minimum needed for
 *  bold/italic/links without falling back to raw HTML. */
export interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  /** Internal (`/tin-tuc/...`) or external (`https://...`) — the renderer
   *  picks `next/link` vs a plain anchor based on which. */
  href?: string;
}

export interface ParagraphBlock {
  type: "paragraph";
  id: ID;
  runs: TextRun[];
}

/** Body headings only — the article's own H1 is the headline, rendered
 *  outside the block stream, so body headings start at H2. */
export interface HeadingBlock {
  type: "heading";
  id: ID;
  level: 2 | 3;
  text: string;
}

export interface ImageBlock {
  type: "image";
  id: ID;
  media: MediaAsset;
  caption?: string;
}

/** A set of images presented together — distinct from `Gallery` (the
 *  homepage's standalone curated wall): this one is scoped to a single
 *  article and rendered inline, not as its own page/lightbox. */
export interface GalleryBlock {
  type: "gallery";
  id: ID;
  items: MediaAsset[];
  caption?: string;
}

/** `media.provider` is always `"youtube"` here. Reuses the same
 *  click-to-play contract as the homepage's video section (see
 *  `MediaVideo`) rather than auto-playing or embedding unconditionally. */
export interface YoutubeBlock {
  type: "youtube";
  id: ID;
  media: MediaAsset;
  title: string;
}

export interface QuoteBlock {
  type: "quote";
  id: ID;
  text: string;
  cite?: string;
}

export interface TableBlock {
  type: "table";
  id: ID;
  caption?: string;
  headers: string[];
  rows: string[][];
}

/**
 * A third-party embed (e.g. a livestream page, a public form). `status`
 * mirrors `MediaAsset.status`'s "not connected yet" convention: `"missing"`
 * renders a placeholder instead of an iframe, so a block can exist in the
 * content model before a real URL is approved. Rendered as a sandboxed
 * `<iframe src>` when ready — never as injected markup.
 */
export type EmbedStatus = "ready" | "missing";

export interface EmbedBlock {
  type: "embed";
  id: ID;
  provider: string;
  title: string;
  status: EmbedStatus;
  url?: string;
  aspectRatio?: number;
}

export type ArticleBlock =
  | ParagraphBlock
  | HeadingBlock
  | ImageBlock
  | GalleryBlock
  | YoutubeBlock
  | QuoteBlock
  | TableBlock
  | EmbedBlock;
