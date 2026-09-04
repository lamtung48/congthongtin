import Link from "next/link";
import styles from "./Breadcrumb.module.css";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/**
 * Breadcrumb contract: every route below the homepage renders one of these,
 * starting with "Trang chủ" and ending with the current page (no `href` on
 * the last item — it's not a link to itself). See `docs/ROUTES.md`.
 *
 * Emits a `BreadcrumbList` JSON-LD block alongside the visible trail so
 * search engines get the same hierarchy without a second data source.
 */
export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: item.href } : {}),
    })),
  };

  return (
    <nav aria-label="Breadcrumb" className={styles.nav}>
      <ol className={styles.list}>
        {items.map((item, i) => (
          <li key={item.label} className={styles.item}>
            {i > 0 && <span className={styles.sep} aria-hidden="true">/</span>}
            {item.href ? (
              <Link href={item.href} className={styles.link}>{item.label}</Link>
            ) : (
              <span aria-current="page" className={styles.current}>{item.label}</span>
            )}
          </li>
        ))}
      </ol>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </nav>
  );
}
