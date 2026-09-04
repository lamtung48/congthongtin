import Link from "next/link";
import styles from "./TagList.module.css";
import type { Tag } from "@/domain/taxonomy";
import { searchHref } from "@/lib/routes";

/** Item 11 of the article detail layout. No dedicated `/tag/[slug]` route
 *  exists yet, so each chip reuses `/tim-kiem` instead of inventing one —
 *  see `docs/ARTICLE_DETAIL.md`. */
export function TagList({ tags }: { tags: Tag[] }) {
  if (tags.length === 0) return null;
  return (
    <ul aria-label="Từ khoá liên quan" className={styles.list}>
      {tags.map((tag) => (
        <li key={tag.slug}>
          <Link href={searchHref(tag.name)} className={styles.chip}>#{tag.name}</Link>
        </li>
      ))}
    </ul>
  );
}
