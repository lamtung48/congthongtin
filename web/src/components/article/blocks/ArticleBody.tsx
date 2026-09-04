import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./ArticleBody.module.css";
import { MediaImage } from "@/components/ui/MediaImage";
import { YoutubeBlockView } from "./YoutubeBlockView";
import type {
  ArticleBlock,
  EmbedBlock,
  GalleryBlock,
  HeadingBlock,
  ImageBlock,
  ParagraphBlock,
  QuoteBlock,
  TableBlock,
  TextRun,
} from "@/domain/articleContent";

/** Blocks that are allowed to fill the full article column; everything
 *  else is held to the narrower reading measure — see `ArticleBody.module.css`. */
const WIDE_BLOCK_TYPES = new Set<ArticleBlock["type"]>(["image", "gallery", "table", "embed", "youtube"]);

function TextRunView({ run }: { run: TextRun }) {
  let node: ReactNode = run.text;
  if (run.italic) node = <em>{node}</em>;
  if (run.bold) node = <strong>{node}</strong>;
  if (run.href) {
    node = /^https?:\/\//.test(run.href) ? (
      <a href={run.href} target="_blank" rel="noopener noreferrer" className={styles.inlineLink}>{node}</a>
    ) : (
      <Link href={run.href} className={styles.inlineLink}>{node}</Link>
    );
  }
  return <>{node}</>;
}

function ParagraphBlockView({ block }: { block: ParagraphBlock }) {
  return (
    <p className={styles.paragraph}>
      {block.runs.map((run, i) => (
        <TextRunView key={i} run={run} />
      ))}
    </p>
  );
}

function HeadingBlockView({ block }: { block: HeadingBlock }) {
  return block.level === 2 ? (
    <h2 id={block.id} className={styles.heading2}>{block.text}</h2>
  ) : (
    <h3 id={block.id} className={styles.heading3}>{block.text}</h3>
  );
}

function ImageBlockView({ block }: { block: ImageBlock }) {
  return (
    <figure className={styles.figure}>
      <div className={styles.imageFrame}>
        <MediaImage media={block.media} />
      </div>
      {block.caption && <figcaption className={styles.caption}>{block.caption}</figcaption>}
    </figure>
  );
}

function GalleryBlockView({ block }: { block: GalleryBlock }) {
  return (
    <figure className={styles.figure}>
      <div data-l="article-gallery" className={styles.galleryGrid}>
        {block.items.map((item) => (
          <div key={item.id} className={styles.galleryTile}>
            <div className={styles.galleryFrame}>
              <MediaImage media={item} />
            </div>
            {item.caption && <p className={styles.galleryItemCaption}>{item.caption}</p>}
          </div>
        ))}
      </div>
      {block.caption && <figcaption className={styles.caption}>{block.caption}</figcaption>}
    </figure>
  );
}

function QuoteBlockView({ block }: { block: QuoteBlock }) {
  return (
    <blockquote className={styles.quote}>
      <p className={styles.quoteText}>{block.text}</p>
      {block.cite && (
        <footer className={styles.quoteCite}>
          — <cite>{block.cite}</cite>
        </footer>
      )}
    </blockquote>
  );
}

function TableBlockView({ block }: { block: TableBlock }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        {block.caption && <caption>{block.caption}</caption>}
        <thead>
          <tr>
            {block.headers.map((h) => (
              <th key={h} scope="col">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmbedBlockView({ block }: { block: EmbedBlock }) {
  if (block.status === "ready" && block.url) {
    return (
      <div className={styles.embedFrameWrap} style={{ aspectRatio: block.aspectRatio ?? 16 / 9 }}>
        <iframe
          src={block.url}
          title={block.title}
          className={styles.embedFrame}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        />
      </div>
    );
  }
  return (
    <div className={styles.embedPlaceholder}>
      <span className={styles.embedPlaceholderTitle}>{block.title}</span>
      <span className={styles.embedPlaceholderNote}>Nội dung nhúng chưa được kết nối — sẽ hiển thị tại đây khi có đường dẫn chính thức.</span>
    </div>
  );
}

function renderBlock(block: ArticleBlock) {
  switch (block.type) {
    case "paragraph":
      return <ParagraphBlockView block={block} />;
    case "heading":
      return <HeadingBlockView block={block} />;
    case "image":
      return <ImageBlockView block={block} />;
    case "gallery":
      return <GalleryBlockView block={block} />;
    case "youtube":
      return <YoutubeBlockView block={block} />;
    case "quote":
      return <QuoteBlockView block={block} />;
    case "table":
      return <TableBlockView block={block} />;
    case "embed":
      return <EmbedBlockView block={block} />;
    default: {
      const exhaustive: never = block;
      return exhaustive;
    }
  }
}

/** Renders a full article body from its typed `ArticleBlock[]` — the only
 *  entry point that turns content into markup, and the only place that
 *  needs to change if a new block type is added. Never uses
 *  `dangerouslySetInnerHTML`. See `docs/ARTICLE_DETAIL.md`. */
export function ArticleBody({ blocks }: { blocks: ArticleBlock[] }) {
  return (
    <div className={styles.stack}>
      {blocks.map((block) => (
        <div key={block.id} className={WIDE_BLOCK_TYPES.has(block.type) ? styles.wideBlock : styles.narrowBlock}>
          {renderBlock(block)}
        </div>
      ))}
    </div>
  );
}
