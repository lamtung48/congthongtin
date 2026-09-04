import { Tag } from "./Tag";
import styles from "./TagList.module.css";

export interface TagListItem {
  key: string;
  href: string;
  label: string;
}

/**
 * A row of `Tag` chips. Used by the article detail page (an article's own
 * tags), `/tin-tuc` (trending topics), and `/chu-de/[slug]` (related tags)
 * — three different domain shapes (`Tag`, `Topic`, aggregated tags), which
 * is why this takes an already-projected `{key,href,label}[]` instead of
 * one domain type. Renders nothing when there's nothing to show, so a
 * caller can render it unconditionally behind a "nếu có" feature.
 */
export function TagList({ items, ariaLabel }: { items: TagListItem[]; ariaLabel: string }) {
  if (items.length === 0) return null;
  return (
    <ul aria-label={ariaLabel} className={styles.list}>
      {items.map((item) => (
        <li key={item.key}>
          <Tag href={item.href} label={item.label} />
        </li>
      ))}
    </ul>
  );
}
