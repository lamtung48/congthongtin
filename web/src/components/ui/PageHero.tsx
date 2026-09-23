import type { ReactNode } from "react";
import styles from "./PageHero.module.css";
import { Breadcrumb, type BreadcrumbItem } from "./Breadcrumb";
import { Reveal } from "./Reveal";

export interface PageHeroStat {
  label: string;
  value: ReactNode;
}

/**
 * Hero band for the public listing / landing routes (`/tin-tuc`,
 * `/chuyen-muc/[slug]`, `/tai-lieu`, `/gioi-thieu`) — same visual language
 * as `/dia-phuong/[slug]`'s header: dotted backdrop with soft colour blobs,
 * pill eyebrow, big editorial H1 whose `mark` part gets a hand-drawn gold
 * underline, then glassy stat tiles. `tone="brand"` is the navy variant used
 * where the page is a campaign/identity page rather than a plain listing.
 *
 * Rendered outside the page's constrained `.wrap` so the backdrop can run
 * edge to edge; page content follows in its own container.
 */
export function PageHero({
  breadcrumb,
  eyebrow,
  icon,
  title,
  mark,
  description,
  stats,
  tone = "light",
  children,
}: {
  breadcrumb: BreadcrumbItem[];
  eyebrow: string;
  icon?: ReactNode;
  /** Plain text before the highlighted part (may be empty). */
  title?: string;
  /** The highlighted part of the H1 — underlined with the gold stroke. */
  mark: string;
  description?: string;
  stats?: PageHeroStat[];
  tone?: "light" | "brand";
  /** Extra hero content under the stats — CTA buttons, filters. */
  children?: ReactNode;
}) {
  return (
    <header className={styles.hero} data-tone={tone}>
      <span aria-hidden className={styles.backdrop} />
      <Breadcrumb items={breadcrumb} />
      <Reveal className={styles.inner}>
        <span className={styles.eyebrow}>
          {icon}
          {eyebrow}
        </span>
        <h1 className={styles.title}>
          {title && <>{title} </>}
          <span className={styles.mark}>
            {mark}
            <svg aria-hidden viewBox="0 0 300 24" preserveAspectRatio="none" className={styles.markSvg}>
              <path d="M4 16 C 60 6, 120 20, 180 11 S 270 8, 296 13" pathLength={1} className={styles.markPath} />
            </svg>
          </span>
        </h1>
        {description && <p className={styles.desc}>{description}</p>}
        {stats && stats.length > 0 && (
          <dl className={styles.stats}>
            {stats.map((s) => (
              <div key={s.label} className={styles.stat}>
                <dt>{s.label}</dt>
                <dd>{s.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {children}
      </Reveal>
    </header>
  );
}
