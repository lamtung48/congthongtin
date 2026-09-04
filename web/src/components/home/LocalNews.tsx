"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./LocalNews.module.css";
import { MediaImage } from "@/components/ui/MediaImage";
import { Reveal } from "@/components/ui/Reveal";
import { IconArrowRight, IconOffline, IconProvince, IconSchool, IconGlobe } from "@/components/icons";
import type { LocalNewsEntry } from "@/data-access/types";
import type { OrganizationLevel } from "@/domain/people";
import { formatDateVi } from "@/lib/formatDate";

const LEVELS: { value: OrganizationLevel; label: string }[] = [
  { value: "province", label: "Tỉnh/thành" },
  { value: "university", label: "Trường" },
  { value: "overseas", label: "Hội ở nước ngoài" },
];

export function LocalNews({ items }: { items: LocalNewsEntry[] }) {
  const [filter, setFilter] = useState<OrganizationLevel>("province");
  const rows = items.filter((n) => n.level === filter);

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
            {LEVELS.map(({ value, label }) => {
              const count = String(items.filter((n) => n.level === value).length).padStart(2, "0");
              const on = filter === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  aria-pressed={on}
                  className={on ? styles.filterBtnOn : styles.filterBtn}
                >
                  {label}
                  <span className={on ? styles.filterCountOn : styles.filterCount}>{count}</span>
                </button>
              );
            })}
          </div>
          <span aria-live="polite" className={styles.srOnly}>Nhóm {LEVELS.find((l) => l.value === filter)?.label}: {rows.length} tin</span>
        </div>

        <div>
          {rows.length === 0 ? (
            <div className={styles.emptyBox}>
              <span className={styles.emptyTitle}>Chưa có tin ở nhóm này</span>
              <span className={styles.emptyDesc}>Nhóm “{LEVELS.find((l) => l.value === filter)?.label}” chưa có tin trong dữ liệu hiện có. Bạn có thể chọn nhóm khác ở cột bên.</span>
            </div>
          ) : (
            <div className={styles.list}>
              {rows.map((n) => (
                <Reveal key={n.slug} as="article" className={styles.row}>
                  <span aria-hidden="true" className={styles.avatar}>
                    {n.level === "province" && <IconProvince size={20} />}
                    {n.level === "university" && <IconSchool size={20} />}
                    {n.level === "overseas" && <IconGlobe size={20} />}
                  </span>
                  <span className={styles.rowBody}>
                    <span className={styles.rowMeta}>
                      <span className={styles.org}>{n.orgName}</span>
                      <span className={styles.dot} />
                      <span className={styles.place}>{n.place}</span>
                    </span>
                    <Link href={n.url} prefetch={false} className={styles.rowTitle}>{n.title}</Link>
                    <span className={styles.rowFoot}>
                      <span className={styles.date}>{formatDateVi(n.publishedAt)}</span>
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
                    <MediaImage media={n.media} />
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
