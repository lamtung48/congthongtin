"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import styles from "./ActivityMapSection.module.css";
import { VietnamMapSvg } from "./activity-map/VietnamMapSvg";
import { useActivityMapData } from "./activity-map/useActivityMapData";
import { provinceValue, provinceValueLabel } from "./activity-map/provinceValue";
import { useViewport } from "@/lib/hooks/useViewport";
import { useModalDialog } from "@/lib/hooks/useModalDialog";
import { IconActivity, IconArrowRight, IconChevronDown, IconClose, IconExternal, IconGlobe, IconPen, IconSearch } from "@/components/icons";
import type { ActivityMapOverseasCountry, PlatformActivityItem } from "@/domain/activity";
import { HOAT_DONG_URL } from "@/lib/siteChrome";
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

type Phase = "static" | "armed" | "in";

/**
 * Entrance choreography for the whole section, keyed off the map/aside grid:
 * "armed" (hidden, waiting) once it is known to be below the fold, "in" when
 * it scrolls into view — the map's slab rises, markers pop, numbers count up,
 * the coverage ring fills. Stays "static" (everything simply shown) under
 * reduced motion or without IntersectionObserver. Every state change happens
 * in the observer callback, never synchronously in the effect.
 */
function useEntrancePhase<T extends HTMLElement>(): [React.RefObject<T | null>, Phase] {
  const ref = useRef<T | null>(null);
  const [phase, setPhase] = useState<Phase>("static");
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setPhase("in");
            io.disconnect();
          } else {
            setPhase((p) => (p === "static" ? "armed" : p));
          }
        }
      },
      { threshold: 0.18 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, phase];
}

/** Counts from 0 up to `target` (ease-out, ~1.2s) once `phase` is "in";
 *  shows 0 while "armed" (so nothing flashes before it starts) and the plain
 *  value when "static". State only changes inside animation frames. */
function useCountUp(target: number, phase: Phase): number {
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (phase !== "in") return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1200);
      setShown(t >= 1 ? null : Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, target]);
  if (phase === "armed") return 0;
  return shown ?? target;
}

function StatTile({ icon, value, label, phase, tone }: { icon: React.ReactNode; value: number; label: string; phase: Phase; tone: string }) {
  const n = useCountUp(value, phase);
  return (
    <div className={styles.statTile} data-tone={tone}>
      <span className={styles.statIcon} aria-hidden>
        {icon}
      </span>
      <span className={styles.statValue}>{fmt(n)}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = { UPCOMING: "Sắp diễn ra", ONGOING: "Đang diễn ra", COMPLETED: "Đã kết thúc" };

/** dd/mm/yyyy in Vietnam time (the map's own dates are ISO strings). */
function vnDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * An activity from the Hoạt động platform, listed like an article: image,
 * title, date · organiser, status. Opens the activity's landing page on Hoạt
 * động (new tab).
 */
function ActivityItem({ a, compact = false }: { a: PlatformActivityItem; compact?: boolean }) {
  const [imgBroken, setImgBroken] = useState(false);
  const showImg = !!a.thumbnail_url && !imgBroken;
  return (
    <a href={a.url} target="_blank" rel="noopener noreferrer" className={compact ? `${styles.actItem} ${styles.actItemCompact}` : styles.actItem}>
      <span className={styles.actThumb} aria-hidden>
        {showImg ? (
          // eslint-disable-next-line @next/next/no-img-element -- external image (Hoạt động / Google Drive), unoptimized on purpose
          <img src={a.thumbnail_url!} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setImgBroken(true)} />
        ) : (
          <IconActivity size={18} />
        )}
      </span>
      <span className={styles.actBody}>
        {a.place && <span className={styles.actPlace}>{a.place}</span>}
        <span className={styles.actTitle}>{a.title}</span>
        <span className={styles.actMeta}>
          <span className={styles.actStatus} data-status={a.status}>
            {STATUS_LABEL[a.status] ?? a.status}
          </span>
          {vnDate(a.start_at)} · {a.organization_name}
        </span>
      </span>
      <IconExternal size={13} className={styles.actExt} />
    </a>
  );
}

function ActivityBlock({ items, count, compact = false }: { items: PlatformActivityItem[]; count: number; compact?: boolean }) {
  return (
    <div className={styles.actBlock}>
      <span className={styles.newsLabel}>
        Hoạt động trên nền tảng Hoạt động{count > 0 ? ` (${count.toLocaleString("vi-VN")})` : ""}
      </span>
      {items.length > 0 ? (
        items.map((a) => <ActivityItem key={a.id} a={a} compact={compact} />)
      ) : (
        <span className={styles.newsEmpty}>Chưa có hoạt động nào của đơn vị trên nền tảng Hoạt động.</span>
      )}
      <a href={HOAT_DONG_URL} target="_blank" rel="noopener noreferrer" className={styles.actMore}>
        {count > items.length ? "Xem tất cả trên nền tảng Hoạt động" : "Khám phá hoạt động"} <IconArrowRight size={13} />
      </a>
    </div>
  );
}

export function ActivityMapSection() {
  const { state, data, vnFeature, nearFeatures } = useActivityMapData();
  const { mobile } = useViewport();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [selectedOverseas, setSelectedOverseas] = useState<ActivityMapOverseasCountry | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [retryTick, setRetryTick] = useState(0);
  const [gridRef, phase] = useEntrancePhase<HTMLDivElement>();

  const provinces = useMemo(() => data?.provinces ?? [], [data]);
  const withData = useMemo(() => provinces.filter((p) => provinceValue(p) != null), [provinces]);
  const totalArticles = provinces.reduce((s, p) => s + (p.article_count ?? 0), 0);
  const totalActivities = data?.summary?.total_platform_activities ?? provinces.reduce((s, p) => s + (p.platform_activity_count ?? 0), 0);
  const latestActivities = data?.platform_activities_latest ?? [];

  const overseasCount = data?.overseas?.countries?.length ?? 0;
  const litCount = useCountUp(withData.length, phase);
  const coverageFrac = provinces.length ? withData.length / provinces.length : 0;
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
  // "Sôi nổi nhất" — only meaningful once there is someone to compare with.
  const leaders = withData.length >= 2 ? withData.slice().sort(byValue).slice(0, 3) : [];
  const leaderMax = Math.max(1, ...leaders.map((p) => provinceValue(p) ?? 0));

  const listAll = provinces.slice().sort(byValue);
  const q = norm(query.trim());
  const listShown = q ? listAll.filter((p) => norm(p.province_name).includes(q)) : listAll;

  const selP = selectedSlug ? provinces.find((p) => p.slug === selectedSlug) ?? null : null;
  const selVal = selP ? provinceValue(selP) : null;
  const selMetrics: { value: string; label: string }[] = [];
  if (selP && selVal != null) {
    if (selP.article_count) selMetrics.push({ value: fmt(selP.article_count), label: "tin bài" });
    if (selP.platform_activity_count) selMetrics.push({ value: fmt(selP.platform_activity_count), label: "hoạt động" });
  }
  const selNews = selP?.latest_article ? [selP.latest_article] : [];

  const ovList = data?.overseas?.countries ?? [];
  const ovVal = selectedOverseas ? selectedOverseas.activity_count : null;
  const ovMetrics: { value: string; label: string }[] = [];
  if (selectedOverseas && ovVal) {
    const rank =
      ovList
        .slice()
        .sort((a, b) => (b.activity_count || 0) - (a.activity_count || 0))
        .findIndex((c) => c.name === selectedOverseas.name) + 1;
    if (selectedOverseas.platform_activity_count) ovMetrics.push({ value: fmt(selectedOverseas.platform_activity_count), label: "hoạt động" });
    if (selectedOverseas.article_count) ovMetrics.push({ value: fmt(selectedOverseas.article_count), label: "tin bài" });
    ovMetrics.push({ value: `${rank}/${ovList.length}`, label: "xếp trong khối" });
  }
  const selActivities = selectedOverseas ? (selectedOverseas.platform_activities ?? []) : (selP?.platform_activities ?? []);
  const selActivityCount = selectedOverseas ? (selectedOverseas.platform_activity_count ?? 0) : (selP?.platform_activity_count ?? 0);

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
    ? "Hội này chưa có hoạt động hay tin bài."
    : selP
      ? "Đơn vị này chưa có tin bài hay hoạt động."
      : "";
  const articles = selectedOverseas ? (selectedOverseas.article_count ? fmt(selectedOverseas.article_count) : "—") : selP && selP.article_count != null ? fmt(selP.article_count) : "—";
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
    <section aria-labelledby="map-title" className={styles.section} data-phase={phase}>
      <span aria-hidden className={styles.bg} />
      <div className={styles.inner}>
        <div className={styles.head}>
          <div className={styles.headText}>
            <span className={styles.eyebrow}>
              <span className={styles.liveDot} />
              Bản đồ phong trào
            </span>
            <h2 id="map-title" className={styles.title}>
              Hoạt động sinh viên trên <span className={styles.titleAccent}>toàn quốc</span>
            </h2>
            <p className={styles.desc}>
              Chọn một tỉnh, thành hoặc Hội Sinh viên ở nước ngoài để xem tin bài và các hoạt động của đơn vị trên nền tảng Hoạt động.
            </p>
          </div>
        </div>

        <div ref={gridRef} data-l="map" className={styles.grid}>
          <div className={styles.mapCard}>
            {!unitSelected && state === "loaded" && (
              <span className={styles.mapHint} aria-hidden>
                <span className={styles.mapHintDot} />
                Chạm vào điểm sáng để khám phá
              </span>
            )}
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
              phase={phase}
              key={retryTick}
            />
          </div>

          <aside aria-label="Số liệu hoạt động" className={styles.aside}>
            {provinces.length > 0 && (
              <div className={styles.statsBlock}>
                <div className={styles.statsGrid}>
                  <StatTile icon={<IconPen size={16} />} value={totalArticles} label="Tin bài" phase={phase} tone="blue" />
                  <StatTile icon={<IconActivity size={16} />} value={totalActivities} label="Hoạt động" phase={phase} tone="red" />
                  {overseasCount > 0 && <StatTile icon={<IconGlobe size={16} />} value={overseasCount} label="Hội ngoài nước" phase={phase} tone="gold" />}
                </div>
                {periodLine && <span className={styles.periodLine}>{periodLine}</span>}
              </div>
            )}

            {provinces.length > 0 && !unitSelected && (
              <div className={styles.coverCard}>
                <span className={styles.coverRing} aria-hidden>
                  <svg viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" className={styles.coverTrack} />
                    <circle cx="50" cy="50" r="42" pathLength={100} className={styles.coverFill} style={{ "--frac": coverageFrac } as CSSProperties} />
                  </svg>
                  <span className={styles.coverNum}>
                    {litCount}
                    <small>/{provinces.length}</small>
                  </span>
                </span>
                <span className={styles.coverBody}>
                  <span className={styles.coverTitle}>Thắp sáng bản đồ</span>
                  <span className={styles.coverText}>
                    {withData.length}/{provinces.length} tỉnh, thành đã sáng đèn. Mỗi tin bài, mỗi hoạt động của Hội Sinh viên địa phương thắp thêm một điểm trên bản đồ.
                  </span>
                  <a href={HOAT_DONG_URL} target="_blank" rel="noopener noreferrer" className={styles.coverCta}>
                    Tạo hoạt động trên nền tảng Hoạt động
                    <IconExternal size={12} />
                  </a>
                </span>
              </div>
            )}

            {showAside ? (
              <div key={detailName} className={styles.detailCard} aria-live="polite">
                <span aria-hidden className={styles.detailGlow} />
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
                        <span className={styles.newsDate}>{vnDate(n.published_at)}</span>
                      </span>
                    ))
                  ) : (
                    <span className={styles.newsEmpty}>Đơn vị chưa có tin bài.</span>
                  )}
                </div>

                <ActivityBlock items={selActivities} count={selActivityCount} />

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
                  {leaders.length > 0 && (
                    <div className={styles.leaderBlock}>
                      <span className={styles.unselectedLabel}>Sôi nổi nhất</span>
                      <ol className={styles.leaderList}>
                        {leaders.map((p, i) => {
                          const v = provinceValue(p) ?? 0;
                          return (
                            <li key={p.slug}>
                              <button type="button" className={styles.leaderRow} onClick={() => selectProvince(p.slug)}>
                                <span className={styles.leaderRank} data-rank={i + 1}>{i + 1}</span>
                                <span className={styles.leaderName}>{p.province_name}</span>
                                <span className={styles.leaderBar} aria-hidden>
                                  <span style={{ "--w": v / leaderMax, "--i": i } as CSSProperties} />
                                </span>
                                <span className={styles.leaderValue}>{provinceValueLabel(p)}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  )}
                  <span className={styles.unselectedLabel}>Tin mới nhất từ các địa phương</span>
                  {mapLatest.map((p) => (
                    <a key={p.slug} href={localityHref(p.slug)} className={styles.unselectedLink}>
                      <span className={styles.unselectedPlace}>{p.province_name}</span>
                      <span className={styles.unselectedTitle}>{p.latest_article?.title}</span>
                      <span className={styles.unselectedDate}>{p.latest_article ? vnDate(p.latest_article.published_at) : ""}</span>
                      <span className={styles.unselectedGo} aria-hidden>
                        <IconArrowRight size={14} />
                      </span>
                    </a>
                  ))}
                  {latestActivities.length > 0 && (
                    <div className={styles.actBlock}>
                      <span className={styles.unselectedLabel}>Hoạt động mới trên nền tảng Hoạt động</span>
                      {latestActivities.map((a) => (
                        <ActivityItem key={a.id} a={a} />
                      ))}
                    </div>
                  )}
                  <span className={styles.unselectedHint}>Chọn một tỉnh, thành hoặc Hội ở nước ngoài trên bản đồ để xem tin bài và hoạt động của đơn vị đó.</span>
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
                      <span className={none ? styles.listItemNoValue : styles.listItemValue}>{provinceValueLabel(p)}</span>
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
              <span className={styles.sheetStat}>
                <span className={styles.sheetStatValue}>{selActivityCount ? fmt(selActivityCount) : "—"}</span>
                <span className={styles.sheetStatLabel}>hoạt động</span>
              </span>
            </span>
            <span className={styles.sheetNewsBlock}>
              <span className={styles.sheetNewsLabel}>Tin mới nhất</span>
              <span className={styles.sheetNewsTitle}>{latestTitle}</span>
            </span>
            <ActivityBlock items={selActivities.slice(0, 2)} count={selActivityCount} compact />
            <a href={selUrl} className={styles.sheetCta}>{selCtaLabel}</a>
          </div>
        </>
      )}
    </section>
  );
}
