import Link from "next/link";
import styles from "./FeaturedNewsCard.module.css";
import { MediaImage } from "@/components/ui/MediaImage";
import { categoryHref } from "@/lib/routes";
import { formatDateVi } from "@/lib/formatDate";
import type { ArticleSummary } from "@/domain/article";
import type { MediaAsset } from "@/domain/media";

const FALLBACK_MEDIA: MediaAsset = { id: "featured-news-card-fallback", provider: "local-placeholder", type: "image", status: "missing", placeholder: "Ảnh bài viết" };

/**
 * The single large "lead story" card at the top of a listing page
 * (`/tin-tuc`, `/chuyen-muc/[slug]`) — same role and visual language as
 * Homepage V2's `FeaturedNews` main card, generalized so listing pages
 * don't reimplement it. Title renders as H2 — the page's own H1 is
 * `PageShell`'s title.
 */
export function FeaturedNewsCard({ article, eyebrow }: { article: ArticleSummary; eyebrow?: string }) {
  return (
    <article data-l="featured-card" className={styles.card}>
      <Link href={article.url} className={styles.media}>
        <MediaImage media={article.coverImage ?? FALLBACK_MEDIA} />
      </Link>
      <div className={styles.body}>
        {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
        <div className={styles.metaRow}>
          <Link href={categoryHref(article.category.slug)} className={styles.cat}>{article.category.name}</Link>
          <span className={styles.date}>{formatDateVi(article.publishedAt)}</span>
        </div>
        <h2 className={styles.title}>
          <Link href={article.url}>{article.title}</Link>
        </h2>
        {article.lead && <p className={styles.lead}>{article.lead}</p>}
        <Link href={article.url} className={styles.cta}>Đọc bài viết →</Link>
      </div>
    </article>
  );
}
