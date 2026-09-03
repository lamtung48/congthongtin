import Link from "next/link";
import styles from "./FeaturedNews.module.css";
import { MediaPlaceholder } from "@/components/ui/MediaPlaceholder";
import { Reveal } from "@/components/ui/Reveal";
import { IconArrowRight } from "@/components/icons";
import { articleHref } from "@/lib/data/news";
import { featured } from "@/lib/data/homepage";

const MAIN_SLUG = "tuyen-duong-112-sv5t";

export function FeaturedNews() {
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
          <Link href={articleHref(MAIN_SLUG)} prefetch={false} className={styles.mainMedia}>
            <div className={styles.mainMediaInner}>
              <MediaPlaceholder need="Ảnh bài tiêu điểm" />
            </div>
          </Link>
          <div className={styles.mainBody}>
            <div className={styles.metaRow}>
              <span className={styles.cat}>Sinh viên 5 tốt</span>
              <span className={styles.dot} />
              <span className={styles.date}>31.08.2026</span>
            </div>
            <h3 className={styles.mainTitle}>
              <Link href={articleHref(MAIN_SLUG)} prefetch={false}>
                Tuyên dương 112 “Sinh viên 5 tốt” cấp Trung ương: những chân dung học tập và cống hiến
              </Link>
            </h3>
            <p className={styles.mainLead}>
              Danh hiệu năm nay ghi nhận nhiều sinh viên vừa đạt thành tích nghiên cứu quốc tế, vừa duy trì hoạt động tình nguyện tại địa phương trong suốt bốn năm học.
            </p>
          </div>
        </Reveal>

        <div className={styles.secList}>
          {featured.map((a) => (
            <Reveal key={a.slug} as="article" data-l="feat-sec" className={styles.secItem}>
              <div className={styles.secBody}>
                <div className={styles.metaRow}>
                  <span className={styles.secCat}>{a.category}</span>
                  <span className={styles.secDate}>{a.date}</span>
                </div>
                <h4 className={styles.secTitle}>
                  <Link href={articleHref(a.slug)} prefetch={false}>{a.title}</Link>
                </h4>
              </div>
              <Link href={articleHref(a.slug)} prefetch={false} aria-hidden="true" tabIndex={-1} className={styles.secMedia}>
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
