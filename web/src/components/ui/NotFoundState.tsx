import Link from "next/link";
import styles from "./NotFoundState.module.css";
import { IconArrowRight } from "@/components/icons";

/**
 * Not-found contract: every dynamic route (`[slug]`) that can fail to
 * resolve calls `notFound()` from a lookup miss, which renders the nearest
 * `not-found.tsx`. Each of those files renders this component with a
 * section-specific message instead of Next.js's bare default — see
 * `docs/ROUTES.md`. The global `app/not-found.tsx` uses the default copy.
 */
export function NotFoundState({
  eyebrow = "Không tìm thấy",
  title,
  description,
  actionLabel = "Về trang chủ",
  actionHref = "/",
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className={styles.wrap}>
      <span className={styles.eyebrow}>{eyebrow}</span>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.desc}>{description}</p>
      <Link href={actionHref} className={styles.link}>
        {actionLabel}
        <IconArrowRight size={15} />
      </Link>
    </div>
  );
}
