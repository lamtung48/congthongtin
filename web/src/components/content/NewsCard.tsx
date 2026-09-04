import Link from "next/link";
import styles from "./NewsCard.module.css";
import { MediaImage } from "@/components/ui/MediaImage";
import { categoryHref } from "@/lib/routes";
import { formatDateVi } from "@/lib/formatDate";
import type { ArticleSummary } from "@/domain/article";
import type { MediaAsset } from "@/domain/media";

const FALLBACK_MEDIA: MediaAsset = { id: "news-card-fallback", provider: "local-placeholder", type: "image", status: "missing", placeholder: "Ảnh bài viết" };

/**
 * Grid tile for a listing page's main article grid (`/tin-tuc`,
 * `/chu-de/[slug]`). `wide` spans two grid columns, uses a wider image, and
 * shows the lead paragraph — dropping a few of these into an otherwise
 * uniform grid is what keeps the page from reading as a monotonous repeat
 * of the same card. See `docs/LISTING_PAGES.md`.
 */
export function NewsCard({ article, wide = false }: { article: ArticleSummary; wide?: boolean }) {
  return (
    <article data-wide={wide || undefined} className={wide ? `${styles.card} ${styles.wide}` : styles.card}>
      <Link href={article.url} aria-hidden="true" tabIndex={-1} className={styles.media}>
        <MediaImage media={article.coverImage ?? FALLBACK_MEDIA} />
      </Link>
      <div className={styles.body}>
        <div className={styles.metaRow}>
          <Link href={categoryHref(article.category.slug)} className={styles.cat}>{article.category.name}</Link>
          <span className={styles.date}>{formatDateVi(article.publishedAt)}</span>
        </div>
        <h3 className={styles.title}>
          <Link href={article.url}>{article.title}</Link>
        </h3>
        {wide && article.lead && <p className={styles.lead}>{article.lead}</p>}
      </div>
    </article>
  );
}
