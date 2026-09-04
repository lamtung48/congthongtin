"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import styles from "./LatestNews.module.css";
import { MediaImage } from "@/components/ui/MediaImage";
import { Reveal } from "@/components/ui/Reveal";
import { IconSpinner } from "@/components/icons";
import type { ArticleSummary } from "@/domain/article";
import type { MediaAsset } from "@/domain/media";
import { formatDateVi } from "@/lib/formatDate";

const FILTERS = ["Tất cả", "Tình nguyện", "Nghiên cứu", "Sinh viên 5 tốt", "Hội nhập"] as const;
const CARD_MEDIA: MediaAsset = { id: "latest-news-card", provider: "local-placeholder", type: "image", status: "missing", placeholder: "Ảnh bài viết" };

export function LatestNews({ articles }: { articles: ArticleSummary[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Tất cả");
  const [loading, setLoading] = useState(false);
  const [extraFor, setExtraFor] = useState<string | null>(null);
  const [moreLoading, setMoreLoading] = useState(false);
  const [announce, setAnnounce] = useState("");
  const filterTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const moreTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const pool = useMemo(
    () => articles.filter((n) => filter === "Tất cả" || n.category.name === filter),
    [articles, filter]
  );
  const baseN = filter === "Tất cả" ? 8 : 6;
  const base = pool.slice(0, baseN);
  const extraPool = pool.slice(baseN, baseN + 3);
  const shown = extraFor === filter ? base.concat(extraPool) : base;
  const rest = shown.slice(4);
  const lead = shown[0];
  const quick = shown.slice(1, 4);
  const cards = rest.filter((n) => !n.isTextOnly);
  const textCards = rest.filter((n) => n.isTextOnly);
  const isEmpty = !loading && shown.length === 0;
  const isLoaded = !loading && !isEmpty;
  const moreAvailable = !moreLoading && extraPool.length > 0 && extraFor !== filter;
  const moreDone = !moreLoading && (extraPool.length === 0 || extraFor === filter);

  function selectFilter(label: (typeof FILTERS)[number]) {
    if (label === filter) return;
    clearTimeout(filterTimer.current);
    setFilter(label);
    setExtraFor(null);
    setLoading(true);
    setAnnounce(`Đang tải tin mục ${label}`);
    filterTimer.current = setTimeout(() => {
      setLoading(false);
      setAnnounce(`Đã tải tin mục ${label}`);
    }, 320);
  }

  function loadMore() {
    if (moreLoading) return;
    setMoreLoading(true);
    setAnnounce("Đang tải thêm tin");
    clearTimeout(moreTimer.current);
    moreTimer.current = setTimeout(() => {
      setMoreLoading(false);
      setExtraFor(filter);
      setAnnounce("Đã tải thêm tin vào danh sách");
    }, 620);
  }

  return (
    <section aria-label="Tin mới nhất" className={styles.section}>
      <div className={styles.inner}>
        <div className={styles.head}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span className={styles.eyebrow}>Cập nhật liên tục</span>
            <h2 className={styles.title}>Tin mới nhất</h2>
          </div>
          <div role="group" aria-label="Lọc theo chuyên mục" className={styles.filters}>
            {FILTERS.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => selectFilter(label)}
                aria-pressed={label === filter}
                className={label === filter ? styles.filterBtnOn : styles.filterBtn}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <p aria-live="polite" className={styles.srOnly}>{announce}</p>

        {loading && (
          <div aria-busy="true" className={styles.skeletonGrid}>
            {Array.from({ length: 6 }).map((_, k) => (
              <div key={k} className={styles.skelCard}>
                <div className={styles.skelImg} />
                <div className={styles.skelLabel} />
                <div className={styles.skelLine} />
                <div className={styles.skelLineShort} />
              </div>
            ))}
          </div>
        )}

        {isEmpty && (
          <div className={styles.emptyBox}>
            <span className={styles.emptyTitle}>Chưa có tin trong mục này</span>
            <span className={styles.emptyDesc}>Hãy chọn một chuyên mục khác, hoặc xem toàn bộ tin mới nhất của cổng thông tin.</span>
            <button type="button" onClick={() => selectFilter("Tất cả")} className={styles.resetBtn}>Xem tất cả</button>
          </div>
        )}

        {isLoaded && (
          <>
            <div data-l="latest" className={styles.grid}>
              <Reveal as="article" className={styles.lead}>
                <Link href={lead.url} prefetch={false} aria-hidden="true" tabIndex={-1} className={styles.leadMedia}>
                  <MediaImage media={CARD_MEDIA} />
                </Link>
                <div className={styles.metaRow}>
                  <span className={styles.cat}>{lead.category.name}</span>
                  <span className={styles.date}>{formatDateVi(lead.publishedAt)}</span>
                </div>
                <h3 className={styles.leadTitle}>
                  <Link href={lead.url} prefetch={false}>{lead.title}</Link>
                </h3>
                <p className={styles.leadDesc}>{lead.lead}</p>
              </Reveal>

              <Reveal className={styles.quick}>
                <span className={styles.quickLabel}>Đọc nhanh</span>
                {quick.map((q, i) => (
                  <Link key={q.slug} href={q.url} prefetch={false} className={styles.quickItem}>
                    <span className={styles.quickN}>{String(i + 1).padStart(2, "0")}</span>
                    <span>
                      <span className={styles.quickTitle}>{q.title}</span>
                      <span className={styles.quickMeta}>{q.category.name} · {formatDateVi(q.publishedAt).slice(0, 5)}</span>
                    </span>
                  </Link>
                ))}
              </Reveal>

              {cards.map((c) => (
                <Reveal key={c.slug} as="article" className={styles.card}>
                  <Link href={c.url} prefetch={false} aria-hidden="true" tabIndex={-1} className={styles.cardMedia}>
                    <MediaImage media={CARD_MEDIA} />
                  </Link>
                  <div className={styles.metaRow}>
                    <span className={styles.cat}>{c.category.name}</span>
                    <span className={styles.date}>{formatDateVi(c.publishedAt)}</span>
                  </div>
                  <h3 className={styles.cardTitle}>
                    <Link href={c.url} prefetch={false}>{c.title}</Link>
                  </h3>
                </Reveal>
              ))}

              {textCards.map((t) => (
                <Reveal key={t.slug} as="article" className={styles.textCard}>
                  <span className={styles.cat}>{t.category.name}</span>
                  <h3 className={styles.textCardTitle}>
                    <Link href={t.url} prefetch={false}>{t.title}</Link>
                  </h3>
                  <p className={styles.textCardLead}>{t.lead}</p>
                  <Link href={t.url} prefetch={false} className={styles.textCardLink}>Đọc tiếp →</Link>
                </Reveal>
              ))}
            </div>

            <div className={styles.moreRow}>
              {moreAvailable && (
                <button type="button" onClick={loadMore} className={styles.moreBtn}>Xem thêm tin</button>
              )}
              {moreLoading && (
                <span aria-live="polite" className={styles.moreLoading}>
                  <IconSpinner size={14} />
                  Đang tải thêm tin…
                </span>
              )}
              {moreDone && (
                <span className={styles.moreDone}>
                  Đã hiển thị toàn bộ tin mới nhất của mục này
                  <Link href="/tin-tuc" prefetch={false} style={{ fontWeight: "var(--fw-semibold)" }}>Mở trang tin tức →</Link>
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
