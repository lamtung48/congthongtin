"use client";

import { useMemo, useState } from "react";
import styles from "./ActivityMapSection.module.css";
import { VietnamMapSvg } from "./activity-map/VietnamMapSvg";
import { useActivityMapData } from "./activity-map/useActivityMapData";
import { provinceValue } from "./activity-map/provinceValue";
import { useViewport } from "@/lib/hooks/useViewport";
import { IconArrowRight, IconChevronDown, IconClose, IconSearch } from "@/components/icons";
import type { ActivityMapOverseasCountry } from "@/domain/activity";
import { unitHref } from "@/lib/routes";
import { slugifyOverseasName } from "@/lib/slug";

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

const DEFAULT_CATEGORIES = [
  { slug: "all", label: "Tất cả" },
  { slug: "sv5tot", label: "Sinh viên 5 tốt" },
  { slug: "tinhnguyen", label: "Tình nguyện" },
  { slug: "nckh", label: "Nghiên cứu khoa học" },
  { slug: "hoinhap", label: "Hội nhập" },
];

export function ActivityMapSection() {
  const { state, data, vnFeature, nearFeatures } = useActivityMapData();
  const { mobile } = useViewport();
  const [filter, setFilter] = useState("all");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [selectedOverseas, setSelectedOverseas] = useState<ActivityMapOverseasCountry | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [retryTick, setRetryTick] = useState(0);

  const categories = data?.categories ?? DEFAULT_CATEGORIES;
  const allCats = filter === "all";
  const catLabel = categories.find((c) => c.slug === filter)?.label ?? "Tất cả";
  const provinces = useMemo(() => data?.provinces ?? [], [data]);

  const withData = useMemo(
    () => provinces.filter((p) => provinceValue(p, filter) != null),
    [provinces, filter]
  );
  const catTotal = withData.reduce((s, p) => s + (provinceValue(p, filter) ?? 0), 0);
  const period = data?.reporting_period?.label ?? "";
  const mapStats = !provinces.length
    ? []
    : allCats
      ? [
          { value: fmt(catTotal), label: "Tổng hoạt động" },
          { value: fmt(withData.reduce((s, p) => s + (p.article_count || 0), 0)), label: "Tin bài" },
          { value: fmt(withData.reduce((s, p) => s + (p.student_count || 0), 0)), label: "Sinh viên tham gia" },
          { value: `${withData.length}/${provinces.length}`, label: "Đơn vị đã báo cáo" },
        ]
      : [
          { value: fmt(catTotal), label: `Hoạt động · ${catLabel}` },
          { value: String(withData.length), label: "Tỉnh, thành có dữ liệu" },
          { value: String(provinces.length - withData.length), label: "Chưa có dữ liệu" },
        ];
  const updatedAt =
    data?.updated_at && state === "loaded"
      ? new Date(data.updated_at).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
      : "";
  const periodLine = [period ? `Kỳ thống kê: ${period}` : "", updatedAt ? `Cập nhật ${updatedAt}` : ""].filter(Boolean).join(" · ");

  function byValue(a: (typeof provinces)[number], b: (typeof provinces)[number]) {
    const va = provinceValue(a, filter);
    const vb = provinceValue(b, filter);
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
  const selVal = selP ? provinceValue(selP, filter) : null;
  const selMetrics: { value: string; label: string }[] = [];
  if (selP && selVal != null) {
    selMetrics.push({ value: fmt(selVal), label: allCats ? "hoạt động" : `hoạt động ${catLabel.toLowerCase()}` });
    if (allCats && selP.article_count != null) selMetrics.push({ value: fmt(selP.article_count), label: "tin bài" });
    if (allCats && selP.student_count != null) selMetrics.push({ value: fmt(selP.student_count), label: "sinh viên" });
  }
  const selNews = selP?.latest_article && selVal != null ? [selP.latest_article] : [];

  const ovList = data?.overseas?.countries ?? [];
  const ovVal = selectedOverseas && allCats ? selectedOverseas.activity_count : null;
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
  const detailPeriodLine = selectedOverseas
    ? `Khối ngoài nước${period ? ` · Kỳ thống kê: ${period}` : ""}`
    : selP
      ? `Kỳ thống kê: ${selP.period || period}`
      : "";
  const activeMetrics = selectedOverseas ? ovMetrics : selMetrics;
  const noData = selectedOverseas ? ovMetrics.length === 0 : !!selP && selVal == null;
  const noDataMsg = selectedOverseas
    ? allCats
      ? "Hội này chưa gửi số liệu trong kỳ thống kê này."
      : `Khối ngoài nước chỉ có số liệu tổng, chưa tách theo chuyên mục “${catLabel}”.`
    : selP
      ? selP.reported === false
        ? "Đơn vị chưa gửi báo cáo trong kỳ thống kê này."
        : `Chuyên mục “${catLabel}” chưa có dữ liệu của đơn vị này.`
      : "";
  const activities = selectedOverseas ? (ovVal == null ? "—" : fmt(ovVal)) : selVal == null ? "—" : fmt(selVal);
  const articles = selectedOverseas ? "—" : selP && selP.article_count != null ? fmt(selP.article_count) : "—";
  const latestTitle = !selectedOverseas && selNews.length ? selNews[0].title : "Chưa có tin bài trong kỳ này";
  const selUrl = selectedOverseas
    ? unitHref(slugifyOverseasName(selectedOverseas.name))
    : selP
      ? selP.unit_url || unitHref(selP.slug)
      : "/";

  return (
    <section aria-label="Hoạt động sinh viên trên toàn quốc" className={styles.section}>
      <div className={styles.inner}>
        <div className={styles.head}>
          <div className={styles.headText}>
            <span className={styles.eyebrow}>Bản đồ phong trào</span>
            <h2 className={styles.title}>Hoạt động sinh viên trên toàn quốc</h2>
            <p className={styles.desc}>
              Chọn một tỉnh, thành trên bản đồ để xem hoạt động, tin bài và tin mới nhất của đơn vị đó. Chọn chuyên mục để xem riêng từng mảng phong trào.
            </p>
          </div>
          <div role="group" aria-label="Lọc hoạt động theo chuyên mục" className={styles.filters}>
            {categories.map((c) => (
              <button
                key={c.slug}
                type="button"
                onClick={() => setFilter(c.slug)}
                aria-pressed={filter === c.slug}
                className={filter === c.slug ? styles.filterBtnOn : styles.filterBtn}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div data-l="map" className={styles.grid}>
          <div className={styles.mapCard}>
            <VietnamMapSvg
              state={state}
              data={data}
              vnFeature={vnFeature}
              nearFeatures={nearFeatures}
              filter={filter}
              selectedSlug={selectedSlug}
              selectedOverseasName={selectedOverseas?.name ?? null}
              onSelectProvince={selectProvince}
              onSelectOverseas={selectOverseas}
              onRetry={() => setRetryTick((n) => n + 1)}
              key={retryTick}
            />
            <p className={styles.mapFootnote}>
              Quần đảo Hoàng Sa và quần đảo Trường Sa thuộc chủ quyền Việt Nam. Vị trí hai quần đảo trên bản đồ mang tính chất minh hoạ, không theo tỷ lệ và không phải đơn vị hành chính cấp tỉnh. Hội Sinh viên Việt Nam ở ngoài nước được tính riêng, ngoài 34 tỉnh, thành.
            </p>
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
                <span className={styles.periodLine}>{periodLine}</span>
              </div>
            )}

            {showAside ? (
              <div className={styles.detailCard} aria-live="polite">
                <div className={styles.detailHead}>
                  <span>
                    <span className={styles.detailEyebrow}>Đang chọn</span>
                    <div className={styles.detailName}>{detailName}</div>
                    <span className={styles.detailPeriod}>{detailPeriodLine}</span>
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
                    <span className={styles.newsEmpty}>Đơn vị chưa có tin bài trong kỳ này.</span>
                  )}
                </div>

                <div className={styles.detailActions}>
                  <a href={selUrl} className={styles.ctaPrimary}>
                    Xem hoạt động của đơn vị
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
                    <a key={p.slug} href={p.unit_url || unitHref(p.slug)} className={styles.unselectedLink}>
                      <span className={styles.unselectedPlace}>{p.province_name}</span>
                      <span className={styles.unselectedTitle}>{p.latest_article?.title}</span>
                      <span className={styles.unselectedDate}>{p.latest_article?.published_at}</span>
                    </a>
                  ))}
                  <span className={styles.unselectedHint}>Chọn một tỉnh, thành trên bản đồ để xem số liệu và tin bài của đơn vị đó.</span>
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
                  const v = provinceValue(p, filter);
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
                        {none ? (p.reported === false ? "Chưa báo cáo" : "Chưa có dữ liệu") : `${fmt(v)} hoạt động`}
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
          <div role="dialog" aria-label="Chi tiết địa phương" className={styles.sheet}>
            <span className={styles.sheetGrab} />
            <span className={styles.sheetHead}>
              <span className={styles.sheetTitle}>{detailName}</span>
              <button type="button" onClick={clearSelection} aria-label="Đóng" className={styles.sheetCloseBtn}>
                <IconClose size={16} />
              </button>
            </span>
            <span className={styles.sheetStats}>
              <span className={styles.sheetStat}>
                <span className={styles.sheetStatValue}>{activities}</span>
                <span className={styles.sheetStatLabel}>hoạt động</span>
              </span>
              <span className={styles.sheetStat}>
                <span className={styles.sheetStatValue}>{articles}</span>
                <span className={styles.sheetStatLabel}>tin bài</span>
              </span>
            </span>
            <span className={styles.sheetNewsBlock}>
              <span className={styles.sheetNewsLabel}>Tin mới nhất</span>
              <span className={styles.sheetNewsTitle}>{latestTitle}</span>
            </span>
            <a href={selUrl} className={styles.sheetCta}>Xem hoạt động của đơn vị</a>
          </div>
        </>
      )}
    </section>
  );
}
