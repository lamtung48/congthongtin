"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./LocalNews.module.css";
import { MediaPlaceholder } from "@/components/ui/MediaPlaceholder";
import { Reveal } from "@/components/ui/Reveal";
import { IconArrowRight, IconOffline, IconProvince, IconSchool, IconGlobe } from "@/components/icons";
import { localSource } from "@/lib/data/homepage";
import { articleHref } from "@/lib/data/news";
import type { LocalNewsLevel } from "@/lib/types";

const LEVELS: LocalNewsLevel[] = ["Tỉnh/thành", "Trường", "Hội ở nước ngoài"];

export function LocalNews() {
  const [filter, setFilter] = useState<LocalNewsLevel>("Tỉnh/thành");
  const rows = localSource.filter((n) => n.level === filter);

  return (
    <section aria-label="Tin từ cơ sở" className={styles.section}>
      <div data-l="local" className={styles.grid}>
        <div className={styles.side}>
          <div className={styles.sideHead}>
            <span className={styles.eyebrow}>Mạng lưới cơ sở</span>
            <h2 className={styles.title}>Tin từ cơ sở</h2>
          </div>
          <p className={styles.desc}>Mạng lưới Hội Sinh viên tại các tỉnh, thành, nhà trường và tổ chức của sinh viên Việt Nam ở nước ngoài.</p>
          <div role="group" aria-label="Lọc theo cấp đơn vị" className={styles.filters}>
            {LEVELS.map((label) => {
              const count = String(localSource.filter((n) => n.level === label).length).padStart(2, "0");
              const on = filter === label;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setFilter(label)}
                  aria-pressed={on}
                  className={on ? styles.filterBtnOn : styles.filterBtn}
                >
                  {label}
                  <span className={on ? styles.filterCountOn : styles.filterCount}>{count}</span>
                </button>
              );
            })}
          </div>
          <span aria-live="polite" className={styles.srOnly}>Nhóm {filter}: {rows.length} tin</span>
        </div>

        <div>
          {rows.length === 0 ? (
            <div className={styles.emptyBox}>
              <span className={styles.emptyTitle}>Chưa có tin ở nhóm này</span>
              <span className={styles.emptyDesc}>Nhóm “{filter}” chưa có tin trong dữ liệu hiện có. Bạn có thể chọn nhóm khác ở cột bên.</span>
            </div>
          ) : (
            <div className={styles.list}>
              {rows.map((n) => (
                <Reveal key={n.slug} as="article" className={styles.row}>
                  <span aria-hidden="true" className={styles.avatar}>
                    {n.level === "Tỉnh/thành" && <IconProvince size={20} />}
                    {n.level === "Trường" && <IconSchool size={20} />}
                    {n.level === "Hội ở nước ngoài" && <IconGlobe size={20} />}
                  </span>
                  <span className={styles.rowBody}>
                    <span className={styles.rowMeta}>
                      <span className={styles.org}>{n.org}</span>
                      <span className={styles.dot} />
                      <span className={styles.place}>{n.place}</span>
                    </span>
                    <Link href={articleHref(n.slug)} prefetch={false} className={styles.rowTitle}>{n.title}</Link>
                    <span className={styles.rowFoot}>
                      <span className={styles.date}>{n.date}</span>
                      {n.unitUrl ? (
                        <a href={n.unitUrl} className={styles.unitLink}>Trang đơn vị →</a>
                      ) : (
                        <span className={styles.noUnit}>
                          <IconOffline size={12} />
                          Trang đơn vị chưa có
                        </span>
                      )}
                    </span>
                  </span>
                  <span className={styles.thumb}>
                    <MediaPlaceholder need={n.need} />
                  </span>
                </Reveal>
              ))}
              <Link href="/tin-tuc" prefetch={false} className={styles.seeMore}>
                Toàn bộ tin từ cơ sở
                <IconArrowRight size={15} />
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
