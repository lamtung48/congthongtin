import Link from "next/link";
import { tags } from "@/lib/data/homepage";
import styles from "./TrendingTopics.module.css";

export function TrendingTopics() {
  return (
    <section aria-label="Chủ đề nổi bật" className={styles.section}>
      <div className={styles.inner}>
        <span className={styles.label}>Chủ đề nổi bật</span>
        <div className={`hsvRail ${styles.rail}`}>
          {tags.map((t) => (
            <Link key={t.name} href={t.href} prefetch={false} className={styles.chip}>
              <span className={styles.hash}>#</span>
              <span className={styles.name}>{t.name}</span>
              <span className={styles.count}>{t.count}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
