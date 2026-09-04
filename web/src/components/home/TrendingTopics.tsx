import Link from "next/link";
import type { Topic } from "@/domain/taxonomy";
import styles from "./TrendingTopics.module.css";

export function TrendingTopics({ topics }: { topics: Topic[] }) {
  return (
    <section aria-label="Chủ đề nổi bật" className={styles.section}>
      <div className={styles.inner}>
        <span className={styles.label}>Chủ đề nổi bật</span>
        <div className={`hsvRail ${styles.rail}`}>
          {topics.map((t) => (
            <Link key={t.slug} href={t.url} prefetch={false} className={styles.chip}>
              <span className={styles.hash}>#</span>
              <span className={styles.name}>{t.name}</span>
              <span className={styles.count}>{t.articleCount}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
