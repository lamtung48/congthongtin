import Link from "next/link";
import styles from "./Listing.module.css";
import { IconArrowRight, IconBolt } from "@/components/icons";
import { categoryHref } from "@/lib/routes";
import { PHONG_TRAO_SV5T_LABEL, PHONG_TRAO_SV5T_SLUG } from "@/lib/siteChrome";
import type { Category, Topic } from "@/domain/taxonomy";

/** Category filter row shared by `/tin-tuc` and `/chuyen-muc/[slug]`: "Tất cả"
 *  plus one chip per category, each with its article count. `activeSlug`
 *  undefined = "Tất cả" is the current page. */
export function CategoryChips({
  categories,
  counts,
  total,
  activeSlug,
}: {
  categories: Category[];
  counts: Map<string, number>;
  total: number;
  activeSlug?: string;
}) {
  return (
    <nav aria-label="Chuyên mục" className={`hsvRail ${styles.chips}`}>
      <Link href="/tin-tuc" className={activeSlug ? styles.chip : styles.chipOn} aria-current={activeSlug ? undefined : "page"}>
        Tất cả <span className={styles.chipCount}>{total}</span>
      </Link>
      {categories.map((c) => {
        const on = c.slug === activeSlug;
        const n = counts.get(c.slug);
        return (
          <Link key={c.slug} href={categoryHref(c.slug)} className={`${on ? styles.chipOn : styles.chip} ${n ? "" : styles.chipSolo}`} aria-current={on ? "page" : undefined}>
            {c.name}
            {n ? <span className={styles.chipCount}>{n}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** Right column beside the lead story: trending #topics + two promo tiles
 *  (the SV5T campaign and the document library). `hideSv5t` drops the
 *  campaign tile on the campaign's own page. */
export function ListingAside({ topics, hideSv5t = false }: { topics: Topic[]; hideSv5t?: boolean }) {
  return (
    <aside className={styles.aside} aria-label="Khám phá thêm">
      {topics.length > 0 && (
        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>
            <IconBolt size={14} />
            Chủ đề đang được quan tâm
          </h2>
          <div className={styles.tags}>
            {topics.slice(0, 10).map((t) => (
              <Link key={t.slug} href={t.url} className={styles.tag}>
                <b>#</b>
                {t.name}
              </Link>
            ))}
          </div>
        </div>
      )}
      {!hideSv5t && (
        <Link href={categoryHref(PHONG_TRAO_SV5T_SLUG)} className={styles.promo}>
          <span className={styles.promoKicker}>Phong trào</span>
          <span className={styles.promoTitle}>{PHONG_TRAO_SV5T_LABEL}</span>
          <span className={styles.promoGo}>
            Khám phá 5 tiêu chí <IconArrowRight size={14} />
          </span>
        </Link>
      )}
      <Link href="/tai-lieu" className={`${styles.promo} ${styles.promoGold}`}>
        <span className={styles.promoKicker}>Văn bản · Biểu mẫu</span>
        <span className={styles.promoTitle}>Kho tài liệu của Hội</span>
        <span className={styles.promoGo}>
          Tải về ngay <IconArrowRight size={14} />
        </span>
      </Link>
    </aside>
  );
}

/** Article count per category slug. */
export function countByCategory(articles: { category: { slug: string } }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of articles) m.set(a.category.slug, (m.get(a.category.slug) ?? 0) + 1);
  return m;
}

/** Which grid tiles are `wide` (2 columns) so a 3-column grid ends on full
 *  rows: rows cycle [wide, 1] · [1, 1, 1] · [1, wide], and a final pair of
 *  items becomes [1, wide] and a final three stay plain. A full 9-item page = four full rows. */
export function wideFlags(count: number): boolean[] {
  const flags: boolean[] = [];
  let row = 0;
  while (flags.length < count) {
    const left = count - flags.length;
    if (left === 2 || (left > 3 && row % 3 === 2)) flags.push(false, true);
    else if (left > 3 && row % 3 === 0) flags.push(true, false);
    else flags.push(...Array<boolean>(Math.min(3, left)).fill(false));
    row++;
  }
  return flags.slice(0, count);
}
