import Link from "next/link";
import styles from "./AdjacentArticleNav.module.css";
import { IconArrowLeft, IconArrowRight } from "@/components/icons";
import type { ArticleSummary } from "@/domain/article";

/** Item 13, "nếu phù hợp": renders nothing when the current article is at
 *  both ends of reading order at once (only possible when it's the sole
 *  article), and only the side that exists otherwise. */
export function AdjacentArticleNav({ previous, next }: { previous: ArticleSummary | null; next: ArticleSummary | null }) {
  if (!previous && !next) return null;
  return (
    <nav aria-label="Điều hướng bài viết trước/sau" data-l="article-adjacent" className={styles.grid}>
      {previous ? (
        <Link href={previous.url} className={styles.item}>
          <span className={styles.dir}>
            <IconArrowLeft size={13} />
            Bài trước
          </span>
          <span className={styles.title}>{previous.title}</span>
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
      {next ? (
        <Link href={next.url} className={`${styles.item} ${styles.next}`}>
          <span className={styles.dir}>
            Bài sau
            <IconArrowRight size={13} />
          </span>
          <span className={styles.title}>{next.title}</span>
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
    </nav>
  );
}
