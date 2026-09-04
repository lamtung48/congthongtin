import Link from "next/link";
import styles from "./EmptyState.module.css";

/**
 * Empty-state contract: any listing/detail page that has nothing to show
 * (no articles in a topic, no local news for a place, no search results)
 * renders this instead of an empty container or debug text. See
 * `docs/ROUTES.md`.
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className={styles.box}>
      <span className={styles.title}>{title}</span>
      <p className={styles.desc}>{description}</p>
      {action && (
        <Link href={action.href} className={styles.action}>{action.label} →</Link>
      )}
    </div>
  );
}
