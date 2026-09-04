import Link from "next/link";
import styles from "./Pagination.module.css";
import { IconArrowLeft, IconArrowRight } from "@/components/icons";
import { pagedHref } from "@/lib/routes";

/**
 * Real prev/next pagination — plain links to statically-generated pages
 * (`basePath`, `basePath/trang/2`, ...), never a "load more" button that
 * fakes a network fetch. Renders nothing when there's only one page, so a
 * caller can render it unconditionally. See `docs/LISTING_PAGES.md`.
 */
export function Pagination({ basePath, page, pageCount }: { basePath: string; page: number; pageCount: number }) {
  if (pageCount <= 1) return null;
  const prevHref = page > 1 ? pagedHref(basePath, page - 1) : undefined;
  const nextHref = page < pageCount ? pagedHref(basePath, page + 1) : undefined;

  return (
    <nav aria-label="Phân trang" className={styles.nav}>
      {prevHref ? (
        <Link href={prevHref} className={styles.btn}>
          <IconArrowLeft size={14} />
          Trang trước
        </Link>
      ) : (
        <span aria-disabled="true" className={styles.btnDisabled}>
          <IconArrowLeft size={14} />
          Trang trước
        </span>
      )}
      <span className={styles.status}>Trang {page} / {pageCount}</span>
      {nextHref ? (
        <Link href={nextHref} className={styles.btn}>
          Trang sau
          <IconArrowRight size={14} />
        </Link>
      ) : (
        <span aria-disabled="true" className={styles.btnDisabled}>
          Trang sau
          <IconArrowRight size={14} />
        </span>
      )}
    </nav>
  );
}
