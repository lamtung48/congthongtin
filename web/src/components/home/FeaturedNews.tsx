import Link from "next/link";
import styles from "./FeaturedNews.module.css";
import { MediaPlaceholder } from "@/components/ui/MediaPlaceholder";
import { Reveal } from "@/components/ui/Reveal";
import { IconArrowRight } from "@/components/icons";
import type { FeaturedNewsResult } from "@/data-access/types";
import { formatDateVi } from "@/lib/formatDate";

export function FeaturedNews({ featured }: { featured: FeaturedNewsResult }) {
  const { main, secondary } = featured;
  return (
    <section aria-label="Tin tiêu điểm" className={styles.section}>
      <div className={styles.head}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span className={styles.eyebrow}>Tiêu điểm</span>
          <h2 className={styles.title}>Tin tiêu điểm</h2>
        </div>
        <Link href="/tin-tuc" prefetch={false} className={styles.allLink}>
          Tất cả tin tức
          <IconArrowRight size={15} />
        </Link>
      </div>

      <div data-l="feat" className={styles.grid}>
        <Reveal as="article" className={styles.main}>
          <Link href={main.url} prefetch={false} className={styles.mainMedia}>
            <div className={styles.mainMediaInner}>
              <MediaPlaceholder need={main.coverImage?.placeholderNote ?? ""} />
            </div>
          </Link>
          <div className={styles.mainBody}>
            <div className={styles.metaRow}>
              <span className={styles.cat}>{main.category.name}</span>
              <span className={styles.dot} />
              <span className={styles.date}>{formatDateVi(main.publishedAt)}</span>
            </div>
            <h3 className={styles.mainTitle}>
              <Link href={main.url} prefetch={false}>{main.title}</Link>
            </h3>
            <p className={styles.mainLead}>{main.lead}</p>
          </div>
        </Reveal>

        <div className={styles.secList}>
          {secondary.map((a) => (
            <Reveal key={a.slug} as="article" data-l="feat-sec" className={styles.secItem}>
              <div className={styles.secBody}>
                <div className={styles.metaRow}>
                  <span className={styles.secCat}>{a.category.name}</span>
                  <span className={styles.secDate}>{formatDateVi(a.publishedAt)}</span>
                </div>
                <h4 className={styles.secTitle}>
                  <Link href={a.url} prefetch={false}>{a.title}</Link>
                </h4>
              </div>
              <Link href={a.url} prefetch={false} aria-hidden="true" tabIndex={-1} className={styles.secMedia}>
                <MediaPlaceholder need="Ảnh bài viết" />
              </Link>
            </Reveal>
          ))}
          <Link href="/tin-tuc" prefetch={false} className={styles.seeMore}>
            Xem thêm tin tiêu điểm
            <IconArrowRight size={15} />
          </Link>
        </div>
      </div>
    </section>
  );
}
