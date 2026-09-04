import Link from "next/link";
import styles from "./SearchResultRow.module.css";
import { MediaImage } from "@/components/ui/MediaImage";
import { formatDateVi } from "@/lib/formatDate";
import { SEARCH_RESULT_TYPE_LABEL } from "@/lib/searchResultType";
import type { SearchResultItem } from "@/domain/search";

/**
 * The one row every search surface renders a `SearchResultItem` with — the
 * search overlay (`compact`, no image/excerpt, tighter) and `/tim-kiem`
 * (full, image + excerpt) pass the same item through the same component,
 * just with `full` toggled, the way `NewsCard`'s `wide` prop works. `id` +
 * `highlighted` back the overlay's arrow-key/`aria-activedescendant`
 * navigation — unused (and harmless to omit) on the results page, which
 * has no such list-box behavior. See `docs/SEARCH_ARCHITECTURE.md`.
 */
export function SearchResultRow({
  item,
  full = false,
  highlighted = false,
  id,
}: {
  item: SearchResultItem;
  full?: boolean;
  highlighted?: boolean;
  id?: string;
}) {
  return (
    <Link
      id={id}
      href={item.url}
      role="option"
      aria-selected={highlighted}
      className={`${styles.row} ${full ? styles.full : ""} ${highlighted ? styles.highlighted : ""}`}
    >
      {full && item.image && (
        <span className={styles.media}>
          <MediaImage media={item.image} />
        </span>
      )}
      <span className={styles.body}>
        <span className={styles.metaRow}>
          <span className={styles.typeBadge}>{SEARCH_RESULT_TYPE_LABEL[item.type]}</span>
          <span className={styles.category}>{item.category}</span>
          {item.publishedAt && <span className={styles.date}>{formatDateVi(item.publishedAt)}</span>}
        </span>
        <span className={styles.title}>{item.title}</span>
        {full && item.excerpt && <span className={styles.excerpt}>{item.excerpt}</span>}
      </span>
    </Link>
  );
}
