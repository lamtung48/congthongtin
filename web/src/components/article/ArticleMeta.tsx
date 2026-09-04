import styles from "./ArticleMeta.module.css";
import { MediaImage } from "@/components/ui/MediaImage";
import { IconUser } from "@/components/icons";
import type { Author } from "@/domain/people";
import { formatDateVi } from "@/lib/formatDate";

/** Author + published/updated dates + reading time — items 5–7 of the
 *  article detail layout (see `docs/ARTICLE_DETAIL.md`). `author` is
 *  optional because not every fixture article has one yet. */
export function ArticleMeta({
  author,
  publishedAt,
  updatedAt,
  readingTimeMinutes,
}: {
  author?: Author;
  publishedAt: string;
  updatedAt?: string;
  readingTimeMinutes?: number;
}) {
  return (
    <div className={styles.row}>
      {author && (
        <div className={styles.authorBlock}>
          <span className={styles.avatar}>
            {author.avatar ? <MediaImage media={author.avatar} /> : <IconUser size={16} />}
          </span>
          <span className={styles.authorText}>
            <span className={styles.authorName}>{author.name}</span>
            {author.title && <span className={styles.authorTitle}>{author.title}</span>}
          </span>
        </div>
      )}
      <div className={styles.dates}>
        <time dateTime={publishedAt}>{formatDateVi(publishedAt)}</time>
        {updatedAt && (
          <span>
            · Cập nhật <time dateTime={updatedAt}>{formatDateVi(updatedAt)}</time>
          </span>
        )}
        {readingTimeMinutes && <span>· {readingTimeMinutes} phút đọc</span>}
      </div>
    </div>
  );
}
