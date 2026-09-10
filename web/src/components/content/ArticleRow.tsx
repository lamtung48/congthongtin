import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./ArticleRow.module.css";
import { MediaImage } from "@/components/ui/MediaImage";
import type { MediaAsset } from "@/domain/media";

const FALLBACK_MEDIA: MediaAsset = {
  id: "article-row-fallback",
  provider: "local-placeholder",
  type: "image",
  status: "missing",
  placeholder: "Ảnh bài viết",
};

export interface ArticleRowItem {
  url: string;
  title: string;
  /** Short standfirst under the headline; omitted rows just show the title. */
  lead?: string;
  media?: MediaAsset;
  /** Small meta line above the headline — a place, an org name, a category
   *  chip, a date, however the calling page wants to label the row. */
  meta?: ReactNode;
}

/**
 * One article as a horizontal row — headline + short lead on the left, a
 * small thumbnail on the right (dropped on narrow screens). The unit
 * (`/don-vi/[slug]`) and locality (`/dia-phuong/[slug]`) pages use it so
 * their article lists read like the homepage's "Tin từ cơ sở" block
 * instead of a bare text list.
 */
export function ArticleRow({ url, title, lead, media, meta }: ArticleRowItem) {
  return (
    <article className={styles.row}>
      <div className={styles.body}>
        {meta ? <div className={styles.meta}>{meta}</div> : null}
        <h3 className={styles.title}>
          <Link href={url}>{title}</Link>
        </h3>
        {lead ? <p className={styles.lead}>{lead}</p> : null}
      </div>
      <Link href={url} aria-hidden="true" tabIndex={-1} className={styles.thumb}>
        <MediaImage media={media ?? FALLBACK_MEDIA} sizes="140px" />
      </Link>
    </article>
  );
}

/** The list wrapper — keeps the row separators and spacing in one place. */
export function ArticleRowList({ items }: { items: ArticleRowItem[] }) {
  return (
    <div className={styles.list}>
      {items.map((it) => (
        <ArticleRow key={it.url} {...it} />
      ))}
    </div>
  );
}
