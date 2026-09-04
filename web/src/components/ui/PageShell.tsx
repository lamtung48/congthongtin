import type { ReactNode } from "react";
import styles from "./PageShell.module.css";
import { Breadcrumb, type BreadcrumbItem } from "./Breadcrumb";

/**
 * Shared shell every non-homepage route renders inside: breadcrumb, eyebrow,
 * H1, optional lead paragraph, then page-specific content as `children`.
 * Keeps every skeleton page visually consistent instead of each one
 * reinventing its own header markup. See `docs/ROUTES.md`.
 */
export function PageShell({
  breadcrumb,
  eyebrow,
  title,
  description,
  children,
}: {
  breadcrumb: BreadcrumbItem[];
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <>
      <Breadcrumb items={breadcrumb} />
      <div className={styles.wrap}>
        <div className={styles.head}>
          <span className={styles.eyebrow}>{eyebrow}</span>
          <h1 className={styles.title}>{title}</h1>
          {description && <p className={styles.desc}>{description}</p>}
        </div>
        {children}
      </div>
    </>
  );
}
