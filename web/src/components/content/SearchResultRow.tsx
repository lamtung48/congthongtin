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
 * navigation, and only apply there — `/tim-kiem` renders results as plain
 * page content (a `<ul>` of links), which needs no ARIA at all beyond what
 * `<a>`/`<li>` already give it; forcing `role="option"` there breaks the
 * ARIA option/listbox parent requirement instead of helping. See
 * `docs/SEARCH_ARCHITECTURE.md`.
 */
export function SearchResultRow({
  item,
  full = false,
  highlighted = false,
  id,
  asOption = false,
}: {
  item: SearchResultItem;
  full?: boolean;
  highlighted?: boolean;
  id?: string;
  /** Set only by a `role="listbox"` container (the search overlay's combobox). */
  asOption?: boolean;
}) {
  return (
    <Link
      id={id}
      href={item.url}
      role={asOption ? "option" : undefined}
      aria-selected={asOption ? highlighted : undefined}
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
