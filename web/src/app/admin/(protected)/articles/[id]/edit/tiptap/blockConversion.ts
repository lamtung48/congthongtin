import type { JSONContent } from "@tiptap/core";

/**
 * The bridge between two worlds that must never need to know about each
 * other: `articleService`/`articleBlockDataSchemas` (server-side, unchanged
 * by this rewrite) only ever sees the same flat `EditorBlock[]`/
 * `ArticleBlockInput[]` shape it always has; the rich-text editor
 * (`ArticleContentEditor.tsx`) only ever thinks in ProseMirror/TipTap
 * documents. Every block type maps to exactly one custom (or built-in) node
 * type — see the table in `nodes.tsx`'s header comment.
 *
 * A block that fails its own minimal "is this actually fillable" check
 * (an IMAGE with no `mediaId` yet, a HEADING left blank, ...) is silently
 * dropped when converting doc -> blocks, rather than persisted and later
 * rejected by `parseArticleBlockData`'s zod `.min(1)` checks — an
 * unfinished placeholder a user inserted and never completed should vanish
 * on save, not surface as a cryptic validation error (see `nodeToBlock`).
 */

export type ArticleBlockType = "PARAGRAPH" | "HEADING" | "IMAGE" | "GALLERY" | "YOUTUBE" | "QUOTE" | "TABLE" | "EMBED";

export interface EditorBlock {
  key: string;
  type: ArticleBlockType;
  data: Record<string, unknown>;
}

interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  href?: string;
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

// ---------------------------------------------------------------------------
// blocks -> doc
// ---------------------------------------------------------------------------

function textRunToNode(run: TextRun): JSONContent | null {
  if (!run.text) return null;
  const marks: { type: string; attrs?: Record<string, unknown> }[] = [];
  if (run.bold) marks.push({ type: "bold" });
  if (run.italic) marks.push({ type: "italic" });
  if (run.href) marks.push({ type: "link", attrs: { href: run.href } });
  return { type: "text", text: run.text, ...(marks.length ? { marks } : {}) };
}

function runsToInlineContent(data: Record<string, unknown>): JSONContent[] | undefined {
  const runs = Array.isArray(data.runs) ? (data.runs as TextRun[]) : [];
  const content = runs.map(textRunToNode).filter((n): n is JSONContent => n !== null);
  return content.length ? content : undefined;
}

function plainTextToInlineContent(text: string): JSONContent[] | undefined {
  return text ? [{ type: "text", text }] : undefined;
}

function blockToNode(block: EditorBlock): JSONContent | null {
  const data = block.data ?? {};
  switch (block.type) {
    case "PARAGRAPH":
      return { type: "paragraph", content: runsToInlineContent(data) };
    case "HEADING":
      return { type: "heading", attrs: { level: data.level === 3 ? 3 : 2 }, content: plainTextToInlineContent(str(data.text)) };
    case "IMAGE":
      return { type: "articleImage", attrs: { mediaId: str(data.mediaId), caption: str(data.caption) } };
    case "GALLERY":
      return { type: "articleGallery", attrs: { mediaIds: strArray(data.mediaIds), caption: str(data.caption) } };
    case "YOUTUBE":
      return { type: "articleYoutube", attrs: { mediaId: str(data.mediaId), title: str(data.title) } };
    case "QUOTE":
      return { type: "articleQuote", attrs: { cite: str(data.cite) }, content: plainTextToInlineContent(str(data.text)) };
    case "TABLE":
      return {
        type: "articleTable",
        attrs: {
          caption: str(data.caption),
          headers: strArray(data.headers),
          rows: Array.isArray(data.rows) ? (data.rows as unknown[]).map((r) => strArray(r)) : [],
        },
      };
    case "EMBED":
      return {
        type: "articleEmbed",
        attrs: { provider: str(data.provider), title: str(data.title), url: str(data.url), aspectRatio: typeof data.aspectRatio === "number" ? data.aspectRatio : null },
      };
    default:
      return null;
  }
}

/** `[]` becomes a single empty paragraph — an editor needs somewhere for
 *  the cursor to land on a brand-new article. */
export function blocksToDoc(blocks: EditorBlock[]): JSONContent {
  const content = blocks.map(blockToNode).filter((n): n is JSONContent => n !== null);
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}

// ---------------------------------------------------------------------------
// doc -> blocks
// ---------------------------------------------------------------------------

let keySeq = 0;
function nextKey(): string {
  keySeq += 1;
  return `n${Date.now().toString(36)}${keySeq.toString(36)}`;
}

function inlineToRuns(node: JSONContent): TextRun[] {
  const runs: TextRun[] = [];
  for (const child of node.content ?? []) {
    if (child.type === "hardBreak") {
      if (runs.length > 0) runs[runs.length - 1] = { ...runs[runs.length - 1], text: `${runs[runs.length - 1].text}\n` };
      else runs.push({ text: "\n" });
      continue;
    }
    if (child.type !== "text" || !child.text) continue;
    const marks = child.marks ?? [];
    const bold = marks.some((m) => m.type === "bold") || undefined;
    const italic = marks.some((m) => m.type === "italic") || undefined;
    const href = (marks.find((m) => m.type === "link")?.attrs as { href?: string } | undefined)?.href || undefined;
    runs.push({ text: child.text, ...(bold ? { bold } : {}), ...(italic ? { italic } : {}), ...(href ? { href } : {}) });
  }
  return runs.length ? runs : [{ text: "" }];
}

function inlineToPlainText(node: JSONContent): string {
  let text = "";
  for (const child of node.content ?? []) {
    if (child.type === "text") text += child.text ?? "";
    else if (child.type === "hardBreak") text += "\n";
  }
  return text.trim();
}

function nodeToBlock(node: JSONContent): EditorBlock | null {
  const attrs = (node.attrs ?? {}) as Record<string, unknown>;
  switch (node.type) {
    case "paragraph":
      return { key: nextKey(), type: "PARAGRAPH", data: { runs: inlineToRuns(node) } };
    case "heading": {
      const text = inlineToPlainText(node);
      if (!text) return null;
      return { key: nextKey(), type: "HEADING", data: { level: attrs.level === 3 ? 3 : 2, text } };
    }
    case "articleImage": {
      const mediaId = str(attrs.mediaId);
      if (!mediaId) return null;
      const caption = str(attrs.caption);
      return { key: nextKey(), type: "IMAGE", data: { mediaId, ...(caption ? { caption } : {}) } };
    }
    case "articleGallery": {
      const mediaIds = strArray(attrs.mediaIds);
      if (mediaIds.length === 0) return null;
      const caption = str(attrs.caption);
      return { key: nextKey(), type: "GALLERY", data: { mediaIds, ...(caption ? { caption } : {}) } };
    }
    case "articleYoutube": {
      const mediaId = str(attrs.mediaId);
      const title = str(attrs.title);
      if (!mediaId || !title) return null;
      return { key: nextKey(), type: "YOUTUBE", data: { mediaId, title } };
    }
    case "articleQuote": {
      const text = inlineToPlainText(node);
      if (!text) return null;
      const cite = str(attrs.cite);
      return { key: nextKey(), type: "QUOTE", data: { text, ...(cite ? { cite } : {}) } };
    }
    case "articleTable": {
      const caption = str(attrs.caption);
      return {
        key: nextKey(),
        type: "TABLE",
        data: { ...(caption ? { caption } : {}), headers: strArray(attrs.headers), rows: (Array.isArray(attrs.rows) ? attrs.rows : []).map((r) => strArray(r)) },
      };
    }
    case "articleEmbed": {
      const provider = str(attrs.provider);
      const title = str(attrs.title);
      if (!provider || !title) return null;
      const url = str(attrs.url);
      return {
        key: nextKey(),
        type: "EMBED",
        data: { provider, title, status: url ? "ready" : "missing", ...(url ? { url } : {}), ...(typeof attrs.aspectRatio === "number" ? { aspectRatio: attrs.aspectRatio } : {}) },
      };
    }
    default:
      return null;
  }
}

export function docToBlocks(doc: JSONContent): EditorBlock[] {
  const blocks: EditorBlock[] = [];
  for (const node of doc.content ?? []) {
    const block = nodeToBlock(node);
    if (block) blocks.push(block);
  }
  return blocks;
}
