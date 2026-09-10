"use client";

import { useMemo, useRef, useState } from "react";
import styles from "./ActivityMapSection.module.css";
import { VietnamMapSvg } from "./activity-map/VietnamMapSvg";
import { useActivityMapData } from "./activity-map/useActivityMapData";
import { provinceValue } from "./activity-map/provinceValue";
import { useViewport } from "@/lib/hooks/useViewport";
import { useModalDialog } from "@/lib/hooks/useModalDialog";
import { IconArrowRight, IconChevronDown, IconClose, IconSearch } from "@/components/icons";
import type { ActivityMapOverseasCountry } from "@/domain/activity";
import { localityHref, unitHref } from "@/lib/routes";
import { slugifyOverseasName } from "@/lib/slug";
import { formatDateTimeVi } from "@/lib/formatDate";

function fmt(n: number) {
  return n.toLocaleString("vi-VN");
}
function norm(v: string) {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase();
}

export function ActivityMapSection() {
  const { state, data, vnFeature, nearFeatures } = useActivityMapData();
  const { mobile } = useViewport();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [selectedOverseas, setSelectedOverseas] = useState<ActivityMapOverseasCountry | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [retryTick, setRetryTick] = useState(0);

  const provinces = useMemo(() => data?.provinces ?? [], [data]);
  const withData = useMemo(() => provinces.filter((p) => provinceValue(p) != null), [provinces]);
  const totalArticles = withData.reduce((s, p) => s + (provinceValue(p) ?? 0), 0);

  const mapStats = !provinces.length
    ? []
    : [
        { value: fmt(totalArticles), label: "Tổng tin bài" },
        { value: `${withData.length}/${provinces.length}`, label: "Tỉnh, thành có tin bài" },
      ];
  const updatedAt =
    data?.updated_at && state === "loaded" ? formatDateTimeVi(data.updated_at) : "";
  const periodLine = updatedAt ? `Cập nhật ${updatedAt}` : "";

  function byValue(a: (typeof provinces)[number], b: (typeof provinces)[number]) {
    const va = provinceValue(a);
    const vb = provinceValue(b);
    if (va == null && vb == null) return a.province_name.localeCompare(b.province_name, "vi");
    if (va == null) return 1;
    if (vb == null) return -1;
    return vb - va;
  }

  const mapLatest = withData
    .slice()
    .sort(byValue)
    .filter((p) => p.latest_article)
    .slice(0, 3);

  const listAll = provinces.slice().sort(byValue);
  const q = norm(query.trim());
  const listShown = q ? listAll.filter((p) => norm(p.province_name).includes(q)) : listAll;

  const selP = selectedSlug ? provinces.find((p) => p.slug === selectedSlug) ?? null : null;
  const selVal = selP ? provinceValue(selP) : null;
  const selMetrics: { value: string; label: string }[] = [];
  if (selP && selVal != null) {
    selMetrics.push({ value: fmt(selVal), label: "tin bài" });
  }
  const selNews = selP?.latest_article && selVal != null ? [selP.latest_article] : [];

  const ovList = data?.overseas?.countries ?? [];
  const ovVal = selectedOverseas ? selectedOverseas.activity_count : null;
  const ovMetrics: { value: string; label: string }[] = [];
  if (selectedOverseas && ovVal != null) {
    const rank =
      ovList
        .slice()
        .sort((a, b) => (b.activity_count || 0) - (a.activity_count || 0))
        .findIndex((c) => c.name === selectedOverseas.name) + 1;
    ovMetrics.push({ value: fmt(ovVal), label: "hoạt động" });
    ovMetrics.push({ value: `${rank}/${ovList.length}`, label: "xếp trong khối" });
  }

  const unitSelected = !!(selP || selectedOverseas);
  const showAside = unitSelected && !mobile;
  const showSheet = unitSelected && mobile;
  const sheetRef = useRef<HTMLDivElement>(null);
  const sheetCloseRef = useRef<HTMLButtonElement>(null);
  useModalDialog(showSheet, sheetRef, () => clearSelection(), sheetCloseRef);

  function selectProvince(slug: string | null) {
    setSelectedSlug(slug);
    if (slug) setSelectedOverseas(null);
  }
  function selectOverseas(country: ActivityMapOverseasCountry | null) {
    setSelectedOverseas(country);
    if (country) setSelectedSlug(null);
  }
  function clearSelection() {
    setSelectedSlug(null);
    setSelectedOverseas(null);
  }

  const detailName = selectedOverseas ? selectedOverseas.name : selP ? selP.province_name : "";
  const detailPeriodLine = selectedOverseas ? "Khối ngoài nước" : "";
  const activeMetrics = selectedOverseas ? ovMetrics : selMetrics;
  const noData = selectedOverseas ? ovMetrics.length === 0 : !!selP && selVal == null;
  const noDataMsg = selectedOverseas
    ? "Hội này chưa có số liệu hoạt động."
    : selP
      ? "Đơn vị này chưa có tin bài trên cổng."
      : "";
  const articles = selectedOverseas ? "—" : selP && selP.article_count != null ? fmt(selP.article_count) : "—";
  const latestTitle = !selectedOverseas && selNews.length ? selNews[0].title : "Chưa có tin bài";
  // A province click goes to its locality page — see docs/LOCALITY_PAGE.md —
  // while an overseas chapter (not a geographic locality) still goes to its
  // `/don-vi/[slug]` unit page, same as before.
  const selUrl = selectedOverseas
    ? unitHref(slugifyOverseasName(selectedOverseas.name))
    : selP
      ? localityHref(selP.slug)
      : "/";
  const selCtaLabel = selectedOverseas ? "Xem hoạt động của đơn vị" : "Xem trang địa phương";

  return (
    <section aria-label="Hoạt động sinh viên trên toàn quốc" className={styles.section}>
      <div className={styles.inner}>
        <div className={styles.head}>
          <div className={styles.headText}>
            <span className={styles.eyebrow}>Bản đồ phong trào</span>
            <h2 className={styles.title}>Hoạt động sinh viên trên toàn quốc</h2>
            <p className={styles.desc}>
              Chọn một tỉnh, thành trên bản đồ để xem số tin bài và tin mới nhất của đơn vị đó.
            </p>
          </div>
        </div>

        <div data-l="map" className={styles.grid}>
          <div className={styles.mapCard}>
            <VietnamMapSvg
              state={state}
              data={data}
              vnFeature={vnFeature}
              nearFeatures={nearFeatures}
              selectedSlug={selectedSlug}
              selectedOverseasName={selectedOverseas?.name ?? null}
              onSelectProvince={selectProvince}
              onSelectOverseas={selectOverseas}
              onRetry={() => setRetryTick((n) => n + 1)}
              key={retryTick}
            />
          </div>

          <aside aria-label="Số liệu hoạt động" className={styles.aside}>
            {mapStats.length > 0 && (
              <div className={styles.statsBlock}>
                <div className={styles.statsGrid}>
                  {mapStats.map((s) => (
                    <div key={s.label} className={styles.statCell}>
                      <span className={styles.statValue}>{s.value}</span>
                      <span className={styles.statLabel}>{s.label}</span>
                    </div>
                  ))}
                </div>
                {periodLine && <span className={styles.periodLine}>{periodLine}</span>}
              </div>
            )}

            {showAside ? (
              <div className={styles.detailCard} aria-live="polite">
                <div className={styles.detailHead}>
                  <span>
                    <span className={styles.detailEyebrow}>Đang chọn</span>
                    <div className={styles.detailName}>{detailName}</div>
                    {detailPeriodLine && <span className={styles.detailPeriod}>{detailPeriodLine}</span>}
                  </span>
                  <button type="button" onClick={clearSelection} aria-label="Xem toàn quốc, bỏ chọn đơn vị" className={styles.detailCloseBtn}>
                    <IconClose size={15} />
                  </button>
                </div>

                {activeMetrics.length > 0 ? (
                  <div className={styles.detailMetrics}>
                    {activeMetrics.map((m) => (
                      <span key={m.label} className={styles.detailMetric}>
                        <span className={styles.detailMetricValue}>{m.value}</span>
                        <span className={styles.detailMetricLabel}>{m.label}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  noData && (
                    <div className={styles.noDataRow}>
                      <span className={styles.noDataBadge}>Chưa có dữ liệu</span>
                      <span className={styles.noDataText}>{noDataMsg}</span>
                    </div>
                  )
                )}

                <div className={styles.newsBlock}>
                  <span className={styles.newsLabel}>Tin mới nhất</span>
                  {!selectedOverseas && selNews.length > 0 ? (
                    selNews.map((n) => (
                      <span key={n.title} className={styles.newsItem}>
                        <span className={styles.newsTitle}>{n.title}</span>
                        <span className={styles.newsDate}>{n.published_at}</span>
                      </span>
                    ))
                  ) : (
                    <span className={styles.newsEmpty}>Đơn vị chưa có tin bài.</span>
                  )}
                </div>

                <div className={styles.detailActions}>
                  <a href={selUrl} className={styles.ctaPrimary}>
                    {selCtaLabel}
                    <IconArrowRight size={16} />
                  </a>
                  <button type="button" onClick={clearSelection} className={styles.ctaSecondary}>Xem toàn quốc</button>
                </div>
              </div>
            ) : (
              !showSheet && (
                <div className={styles.unselectedCard}>
                  <span className={styles.unselectedLabel}>Tin mới nhất từ các địa phương</span>
                  {mapLatest.map((p) => (
                    <a key={p.slug} href={localityHref(p.slug)} className={styles.unselectedLink}>
                      <span className={styles.unselectedPlace}>{p.province_name}</span>
                      <span className={styles.unselectedTitle}>{p.latest_article?.title}</span>
                      <span className={styles.unselectedDate}>{p.latest_article?.published_at}</span>
                    </a>
                  ))}
                  <span className={styles.unselectedHint}>Chọn một tỉnh, thành trên bản đồ để xem số tin bài và tin mới nhất của đơn vị đó.</span>
                </div>
              )
            )}
          </aside>
        </div>

        <div className={styles.listSection}>
          <button type="button" onClick={() => setListOpen((v) => !v)} aria-expanded={listOpen} className={styles.listToggle}>
            {listOpen ? "Ẩn danh sách tỉnh, thành" : `Xem danh sách tỉnh, thành${provinces.length ? ` (${provinces.length})` : ""}`}
            <IconChevronDown size={15} />
          </button>

          {listOpen && (
            <div className={styles.listBody}>
              <div className={styles.listSearchRow}>
                <label className={styles.searchField}>
                  <IconSearch size={16} />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Tìm tỉnh, thành"
                    aria-label="Tìm tỉnh, thành"
                    className={styles.searchInput}
                  />
                </label>
                <span className={styles.listCount}>
                  {provinces.length ? `Hiển thị ${listShown.length}/${provinces.length} đơn vị` : ""}
                </span>
              </div>

              <div className={styles.listGrid}>
                {listShown.map((p) => {
                  const v = provinceValue(p);
                  const none = v == null;
                  return (
                    <button
                      key={p.slug}
                      type="button"
                      onClick={() => selectProvince(selectedSlug === p.slug ? null : p.slug)}
                      aria-pressed={selectedSlug === p.slug}
                      className={styles.listItem}
                    >
                      <span className={styles.listItemName}>{p.province_name}</span>
                      <span className={none ? styles.listItemNoValue : styles.listItemValue}>
                        {none ? "Chưa có tin bài" : `${fmt(v)} tin bài`}
                      </span>
                    </button>
                  );
                })}
              </div>
              {listShown.length === 0 && (
                <span className={styles.listEmpty}>
                  {provinces.length ? "Không tìm thấy tỉnh, thành phù hợp với từ khoá." : "Danh sách đơn vị chưa tải được. Bạn có thể thử lại ở khung bản đồ phía trên."}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {showSheet && (
        <>
          <div className={styles.backdrop} onClick={clearSelection} />
          <div ref={sheetRef} role="dialog" aria-modal="true" aria-label="Chi tiết địa phương" className={styles.sheet}>
            <span className={styles.sheetGrab} />
            <span className={styles.sheetHead}>
              <span className={styles.sheetTitle}>{detailName}</span>
              <button ref={sheetCloseRef} type="button" onClick={clearSelection} aria-label="Đóng" className={styles.sheetCloseBtn}>
                <IconClose size={16} />
              </button>
            </span>
            <span className={styles.sheetStats}>
              <span className={styles.sheetStat}>
                <span className={styles.sheetStatValue}>{articles}</span>
                <span className={styles.sheetStatLabel}>tin bài</span>
              </span>
            </span>
            <span className={styles.sheetNewsBlock}>
              <span className={styles.sheetNewsLabel}>Tin mới nhất</span>
              <span className={styles.sheetNewsTitle}>{latestTitle}</span>
            </span>
            <a href={selUrl} className={styles.sheetCta}>{selCtaLabel}</a>
          </div>
        </>
      )}
    </section>
  );
}
