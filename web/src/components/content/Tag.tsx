import Link from "next/link";
import styles from "./Tag.module.css";

/**
 * Single pill chip — an article's tag, a topic, or a category, depending on
 * what `href`/`label` the caller passes in. The caller decides the label
 * text verbatim (e.g. a `#` prefix for a tag, none for a topic/category),
 * so this stays a plain presentational atom instead of knowing about any
 * one domain type. See `TagList` for a row of these.
 */
export function Tag({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className={styles.chip}>{label}</Link>
  );
}
