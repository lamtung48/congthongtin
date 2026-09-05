import { prisma } from "@/server/db/client";
import type { ArticleWithRelations } from "@/server/repositories/articleRepository";
import { collectMediaIdsFromBlocks } from "@/server/validation/articleBlocks";
import type { ArticleBlock, TextRun } from "@/domain/articleContent";
import type { MediaAsset } from "@/domain/media";
import type { Author } from "@/domain/people";
import type {
  MediaAsset as PrismaMediaAsset,
  MediaProvider as PrismaMediaProvider,
  MediaStatus as PrismaMediaStatus,
  MediaType as PrismaMediaType,
} from "@/generated/prisma/client";

/**
 * Turns a Prisma `Article` (with its `ArticleBlock[]`/`MediaAsset` rows)
 * into the exact domain shapes `ArticleDetailView`/`ArticleBody` already
 * render for the public site — the one piece of glue that lets the CMS's
 * `/admin/articles/[id]/preview` reuse that production component instead of
 * a second, CMS-only renderer (which is explicitly what the brief rules
 * out: "Không tạo một renderer riêng trong CMS gây khác giao diện public").
 * Nothing in `src/data-access/**`/`src/services/**` reads from the
 * database yet (see docs/BACKEND_ARCHITECTURE.md, "What this task does not
 * wire up") — this resolver exists only for this one CMS preview path, not
 * as a general-purpose provider.
 */

const MEDIA_PROVIDER_MAP: Record<PrismaMediaProvider, MediaAsset["provider"]> = {
  GOOGLE_DRIVE: "drive",
  YOUTUBE: "youtube",
  LOCAL_PLACEHOLDER: "local-placeholder",
};

const MEDIA_TYPE_MAP: Record<PrismaMediaType, MediaAsset["type"]> = {
  IMAGE: "image",
  VIDEO: "video",
};

const MEDIA_STATUS_MAP: Record<PrismaMediaStatus, MediaAsset["status"]> = {
  READY: "ready",
  MISSING: "missing",
  REMOVED: "removed",
  PROCESSING: "processing",
};

function mapMedia(media: PrismaMediaAsset): MediaAsset {
  return {
    id: media.id,
    provider: MEDIA_PROVIDER_MAP[media.provider],
    type: MEDIA_TYPE_MAP[media.type],
    sourceId: media.providerFileId ?? undefined,
    alt: media.alt ?? undefined,
    caption: media.caption ?? undefined,
    width: media.width ?? undefined,
    height: media.height ?? undefined,
    mimeType: media.mimeType ?? undefined,
    status: MEDIA_STATUS_MAP[media.status],
  };
}


function mapBlock(block: ArticleWithRelations["blocks"][number], mediaById: Map<string, MediaAsset>): ArticleBlock | null {
  const data = block.data as Record<string, unknown>;
  switch (block.type) {
    case "PARAGRAPH":
      return { type: "paragraph", id: block.id, runs: (data.runs as TextRun[]) ?? [] };
    case "HEADING":
      return { type: "heading", id: block.id, level: data.level as 2 | 3, text: data.text as string };
    case "QUOTE":
      return { type: "quote", id: block.id, text: data.text as string, cite: data.cite as string | undefined };
    case "TABLE":
      return { type: "table", id: block.id, caption: data.caption as string | undefined, headers: data.headers as string[], rows: data.rows as string[][] };
    case "EMBED":
      return {
        type: "embed",
        id: block.id,
        provider: data.provider as string,
        title: data.title as string,
        status: data.status as "ready" | "missing",
        url: data.url as string | undefined,
        aspectRatio: data.aspectRatio as number | undefined,
      };
    case "IMAGE": {
      const media = mediaById.get(data.mediaId as string);
      if (!media) return null;
      return { type: "image", id: block.id, media, caption: data.caption as string | undefined };
    }
    case "YOUTUBE": {
      const media = mediaById.get(data.mediaId as string);
      if (!media) return null;
      return { type: "youtube", id: block.id, media, title: data.title as string };
    }
    case "GALLERY": {
      const items = ((data.mediaIds as string[]) ?? []).map((id) => mediaById.get(id)).filter((m): m is MediaAsset => !!m);
      if (items.length === 0) return null;
      return { type: "gallery", id: block.id, items, caption: data.caption as string | undefined };
    }
    default:
      return null;
  }
}

async function resolveAuthor(article: ArticleWithRelations): Promise<Author | undefined> {
  if (!article.author) return undefined;
  const avatarMedia = article.author.avatarMediaId
    ? await prisma.mediaAsset.findUnique({ where: { id: article.author.avatarMediaId } })
    : null;
  return {
    id: article.author.id,
    name: article.author.displayName,
    title: article.author.title ?? undefined,
    avatar: avatarMedia ? mapMedia(avatarMedia) : undefined,
  };
}

/** The full resolved shape `ArticleDetailView` needs — everything a CMS
 *  preview page has to fetch/derive from one `ArticleWithRelations` row. */
export interface ResolvedArticleContent {
  author?: Author;
  coverImage?: MediaAsset;
  body: ArticleBlock[];
  tags: { key: string; href: string; label: string }[];
}

export async function resolveArticleContent(article: ArticleWithRelations): Promise<ResolvedArticleContent> {
  const blockMediaIds = collectMediaIdsFromBlocks(article.blocks);
  const [author, blockMediaRows] = await Promise.all([
    resolveAuthor(article),
    blockMediaIds.length > 0 ? prisma.mediaAsset.findMany({ where: { id: { in: blockMediaIds } } }) : Promise.resolve([]),
  ]);
  const mediaById = new Map(blockMediaRows.map((m) => [m.id, mapMedia(m)] as const));

  return {
    author,
    coverImage: article.coverMedia ? mapMedia(article.coverMedia) : undefined,
    body: article.blocks.map((b) => mapBlock(b, mediaById)).filter((b): b is ArticleBlock => b !== null),
    tags: article.tags.map((t) => ({ key: t.tag.slug, href: `/tim-kiem?q=${encodeURIComponent(t.tag.name)}`, label: `#${t.tag.name}` })),
  };
}
