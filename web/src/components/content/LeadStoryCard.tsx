import Link from "next/link";
import styles from "./LeadStoryCard.module.css";
import { MediaImage } from "@/components/ui/MediaImage";
import { ArticleCoverLink } from "@/components/content/ArticleCoverLink";
import { IconArrowRight, IconSparkle } from "@/components/icons";
import { categoryHref } from "@/lib/routes";
import { formatDateVi } from "@/lib/formatDate";
import { articleCoverTransitionName } from "@/lib/viewTransition";
import type { ArticleSummary } from "@/domain/article";
import type { MediaAsset } from "@/domain/media";

const FALLBACK_MEDIA: MediaAsset = { id: "lead-story-fallback", provider: "local-placeholder", type: "image", status: "missing", placeholder: "Ảnh bài viết" };

/**
 * The big "spotlight" story at the top of a listing page (`/tin-tuc`,
 * `/chuyen-muc/[slug]`): full-bleed cover with the copy over a bottom scrim,
 * same treatment as `/dia-phuong/[slug]`'s lead card. Title is an H2 — the
 * page's H1 lives in `PageHero`.
 */
export function LeadStoryCard({ article, eyebrow }: { article: ArticleSummary; eyebrow?: string }) {
  return (
    <article className={styles.card}>
      <ArticleCoverLink href={article.url} className={styles.link}>
        <span className={styles.media} style={{ viewTransitionName: articleCoverTransitionName(article.url) }}>
          <MediaImage media={article.coverImage ?? FALLBACK_MEDIA} priority sizes="(max-width: 1024px) 100vw, 66vw" />
        </span>
        <span aria-hidden className={styles.scrim} />
        <span className={styles.body}>
          {eyebrow && (
            <span className={styles.eyebrow}>
              <IconSparkle size={12} />
              {eyebrow}
            </span>
          )}
          <h2 className={styles.title}>{article.title}</h2>
          {article.lead && <p className={styles.lead}>{article.lead}</p>}
          <span className={styles.meta}>
            {formatDateVi(article.publishedAt)}
            <span className={styles.readMore}>
              Đọc bài <IconArrowRight size={14} />
            </span>
          </span>
        </span>
      </ArticleCoverLink>
      <Link href={categoryHref(article.category.slug)} className={styles.cat}>{article.category.name}</Link>
    </article>
  );
}
