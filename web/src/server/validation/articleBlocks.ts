import { z } from "zod";

/**
 * Per-block-type validation for `ArticleBlock.data` (brief section 4: "Cần
 * validation theo từng block type"). Postgres `jsonb` has no schema of its
 * own, so this is the actual enforcement point — every write path in
 * `ArticleService` must run new/edited block data through
 * `parseArticleBlockData()` before it reaches `ArticleRepository`.
 *
 * Each shape is kept field-for-field identical to its frontend counterpart
 * in `src/domain/articleContent.ts` (`ParagraphBlock`, `ImageBlock`, ...) so
 * a block a future admin UI submits needs no reshaping to satisfy either
 * side, and a row read back out of the database is already renderable by
 * `ArticleBody` as-is.
 */

const textRunSchema = z.object({
  text: z.string(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  href: z.string().optional(),
});

const paragraphDataSchema = z.object({
  runs: z.array(textRunSchema).min(1),
});

const headingDataSchema = z.object({
  level: z.union([z.literal(2), z.literal(3)]),
  text: z.string().min(1),
});

const mediaRefSchema = z.object({
  mediaId: z.string().min(1),
  caption: z.string().optional(),
});

const imageDataSchema = mediaRefSchema;

const galleryDataSchema = z.object({
  mediaIds: z.array(z.string().min(1)).min(1),
  caption: z.string().optional(),
});

const youtubeDataSchema = z.object({
  mediaId: z.string().min(1),
  title: z.string().min(1),
});

const quoteDataSchema = z.object({
  text: z.string().min(1),
  cite: z.string().optional(),
});

const tableDataSchema = z.object({
  caption: z.string().optional(),
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
});

const embedDataSchema = z.object({
  provider: z.string().min(1),
  title: z.string().min(1),
  status: z.union([z.literal("ready"), z.literal("missing")]),
  url: z.string().optional(),
  aspectRatio: z.number().positive().optional(),
});

/** Keyed by the same `ArticleBlockType` enum values Prisma stores. */
export const articleBlockDataSchemas = {
  PARAGRAPH: paragraphDataSchema,
  HEADING: headingDataSchema,
  IMAGE: imageDataSchema,
  GALLERY: galleryDataSchema,
  YOUTUBE: youtubeDataSchema,
  QUOTE: quoteDataSchema,
  TABLE: tableDataSchema,
  EMBED: embedDataSchema,
} as const;

export type ArticleBlockType = keyof typeof articleBlockDataSchemas;

/**
 * Throws a `z.ZodError` (via `.parse`) on an invalid payload — callers in
 * `ArticleService` let it propagate as a rejected write rather than
 * swallowing it, since a malformed block is a request bug, not a state
 * `ArticleRepository` should ever have to represent.
 */
export function parseArticleBlockData(type: ArticleBlockType, data: unknown) {
  return articleBlockDataSchemas[type].parse(data);
}

/**
 * Every id a block's `data` references a `MediaAsset` by — IMAGE/YOUTUBE's
 * single `mediaId`, GALLERY's `mediaIds` array. Shared by
 * `articleContentResolver.ts` (batch-fetching a block's media for preview)
 * and `articleService.ts` (keeping `MediaUsage` rows in sync with what's
 * actually in an article's content, so the Google Drive media task's
 * "xóa media đang được nhiều bài sử dụng phải cảnh báo/block" can see block
 * usage, not just cover-image usage). Takes a plain `{type, data}[]` rather
 * than a Prisma `ArticleBlock[]` so it works on both a freshly-parsed
 * `ArticleBlockInput[]` (before it's ever been written) and a row already
 * read back from the database.
 */
export function collectMediaIdsFromBlocks(blocks: { type: string; data: unknown }[]): string[] {
  const ids = new Set<string>();
  for (const block of blocks) {
    const data = block.data as Record<string, unknown>;
    if (block.type === "IMAGE" || block.type === "YOUTUBE") {
      if (typeof data.mediaId === "string") ids.add(data.mediaId);
    } else if (block.type === "GALLERY" && Array.isArray(data.mediaIds)) {
      for (const id of data.mediaIds) if (typeof id === "string") ids.add(id);
    }
  }
  return [...ids];
}
