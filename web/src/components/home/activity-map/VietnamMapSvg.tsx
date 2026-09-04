"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Feature, Geometry } from "geojson";
import styles from "./VietnamMapSvg.module.css";
import { IconClose } from "@/components/icons";
import type { ActivityMapData, ActivityMapOverseasCountry, ActivityMapProvince } from "@/domain/activity";
import type { MapLoadState } from "./useActivityMapData";
import { mapDims, makeProjection, radiusScale } from "./mapMath";
import { provinceValue } from "./provinceValue";

function fmt(n: number) {
  return n.toLocaleString("vi-VN");
}

/**
 * Center-anchored SVG text near a canvas edge spills past it and gets
 * clipped (`.stage svg { overflow: hidden }`) — most visible once the map
 * actually shrinks to a narrow mobile width. Switching to an edge anchor
 * once the point is close enough keeps the label growing inward instead.
 */
function edgeAnchor(x: number, w: number, margin = 60): { x: number; anchor: "start" | "middle" | "end" } {
  if (x < margin) return { x: 4, anchor: "start" };
  if (x > w - margin) return { x: w - 4, anchor: "end" };
  return { x, anchor: "middle" };
}

interface Props {
  state: MapLoadState;
  data: ActivityMapData | null;
  vnFeature: Feature<Geometry> | null;
  nearFeatures: Feature<Geometry>[];
  filter: string;
  selectedSlug: string | null;
  selectedOverseasName: string | null;
  onSelectProvince: (slug: string | null) => void;
  onSelectOverseas: (country: ActivityMapOverseasCountry | null) => void;
  onRetry: () => void;
}

export function VietnamMapSvg({
  state,
  data,
  vnFeature,
  nearFeatures,
  filter,
  selectedSlug,
  selectedOverseasName,
  onSelectProvince,
  onSelectOverseas,
  onRetry,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [hostWidth, setHostWidth] = useState(640);
  const [hoverSlug, setHoverSlug] = useState<string | null>(null);
  const [globeOpen, setGlobeOpen] = useState(false);
  const [globeHover, setGlobeHover] = useState(false);
  const gpanelRef = useRef<HTMLDivElement>(null);
  const globeGroupRef = useRef<SVGGElement>(null);

  useEffect(() => {
    // `hostRef` is only attached to a DOM node once the real map renders
    // (the "loading" branch above returns a skeleton with no host element at
    // all) — re-running this whenever `state` changes is what lets it find
    // and observe the element on the loading → loaded transition, instead of
    // only checking once on mount and finding nothing.
    const el = hostRef.current;
    if (!el || !window.ResizeObserver) return;
    let lastW = el.clientWidth;
    setHostWidth(lastW);
    let timer: ReturnType<typeof setTimeout>;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (Math.abs(w - lastW) < 8) return;
      lastW = w;
      clearTimeout(timer);
      timer = setTimeout(() => setHostWidth(w), 140);
    });
    ro.observe(el);
    return () => {
      clearTimeout(timer);
      ro.disconnect();
    };
  }, [state]);

  // Close the pinned globe panel on outside click / Escape.
  useEffect(() => {
    if (!globeOpen) return;
    const onDocClick = (e: MouseEvent) => {
      const path = e.composedPath();
      if (path.includes(gpanelRef.current as EventTarget) || path.includes(globeGroupRef.current as EventTarget)) return;
      setGlobeOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setGlobeOpen(false);
        globeGroupRef.current?.focus();
      }
    };
    document.addEventListener("click", onDocClick, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [globeOpen]);

  const dim = mapDims(hostWidth);
  const { W, H } = dim;

  const { path } = useMemo(() => makeProjection(W, H), [W, H]);

  if (state === "loading") {
    return (
      <div>
        <div className={styles.skeleton} style={{ height: dim.H }} />
        <div className={styles.legend}>
          <div className={styles.skeleton} style={{ height: 14, width: 180 }} />
        </div>
      </div>
    );
  }
  if (state === "error" || state === "empty" || state === "geo") {
    const head =
      state === "empty" ? "Chưa có dữ liệu hoạt động" : state === "geo" ? "Chưa hiển thị được nền bản đồ" : "Chưa tải được số liệu bản đồ";
    const body =
      state === "empty"
        ? "Kỳ thống kê này chưa có đơn vị nào gửi số liệu. Bạn vẫn có thể mở danh sách tỉnh, thành ở dưới để xem từng đơn vị."
        : state === "geo"
          ? "Bản đồ cần nền địa lý để vẽ. Bạn có thể thử lại, hoặc mở danh sách tỉnh, thành ở dưới để xem hoạt động từng đơn vị."
          : "Số liệu hoạt động tạm thời chưa tải được. Bạn có thể thử lại, hoặc mở danh sách tỉnh, thành ở dưới để xem hoạt động từng đơn vị.";
    return (
      <div className={styles.msgBox}>
        <span className={styles.msgLabel} style={{ color: state === "empty" ? "var(--text-faint)" : "var(--status-warning)" }}>
          {head}
        </span>
        <p className={styles.msgBody}>{body}</p>
        {state !== "empty" && (
          <button type="button" onClick={onRetry} className={styles.msgRetry}>
            Thử lại
          </button>
        )}
      </div>
    );
  }

  if (!data || !vnFeature) return null;

  const provinces = data.provinces ?? [];
  const values = provinces.map((p) => provinceValue(p, filter)).filter((v): v is number => v != null);
  const max = Math.max(1, ...values);
  const r = radiusScale(max);
  const hasNone = provinces.some((p) => provinceValue(p, filter) == null);

  const order = provinces
    .map((p, i) => i)
    .sort((a, b) => {
      const va = provinceValue(provinces[a], filter);
      const vb = provinceValue(provinces[b], filter);
      return (vb == null ? -1 : vb) - (va == null ? -1 : va);
    });

  const ov = data.overseas?.countries ?? [];
  // The 46px floor was tuned for the desktop-width map; at the narrow W the
  // map now correctly shrinks to on small screens (see the ResizeObserver
  // fix above), a fixed 46px radius overwhelmed the canvas and collided
  // with the Hoàng Sa archipelago label next to it. A lower floor keeps the
  // globe legible without changing its size on wide screens.
  const gr = ov.length ? Math.max(26, Math.round(W * 0.11)) : 0;
  const gcx = W - gr - 14;
  const gcy = gr + 34;
  const sorted = ov.slice().sort((a, b) => (b.activity_count || 0) - (a.activity_count || 0));
  const gmax = Math.max(1, ...ov.map((c) => c.activity_count || 0));

  const hoverProvince = hoverSlug ? provinces.find((p) => p.slug === hoverSlug) ?? null : null;
  const showGpanel = globeOpen || globeHover;

  function projectPoint(lon: number, lat: number): [number, number] | null {
    const { proj } = makeProjection(W, H);
    return proj([lon, lat]);
  }

  function tooltipFor(p: ActivityMapProvince) {
    const xy = projectPoint(p.lon, p.lat);
    if (!xy) return null;
    const v = provinceValue(p, filter);
    const none = v == null;
    const rad = none ? 4.6 : r(v);
    const tw = 232, th = none ? 90 : 150;
    let x = xy[0] + rad + 16;
    if (x + tw > W - 4) x = xy[0] - rad - 16 - tw;
    if (x < 4) x = Math.min(Math.max(4, xy[0] + rad + 16), Math.max(W - tw - 4, 4));
    const y = Math.max(4, Math.min(xy[1] - th / 2, H - th - 4));
    return { x, y, v, none };
  }

  const tip = hoverProvince ? tooltipFor(hoverProvince) : null;

  return (
    <div ref={hostRef}>
      <div className={styles.stage} style={{ width: W, height: H }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Bản đồ hoạt động sinh viên theo tỉnh, thành phố">
          <rect x={0} y={0} width={W} height={H} fill="transparent" />
          <g aria-hidden="true">
            {nearFeatures.map((f, i) => {
              const d = path(f);
              if (!d) return null;
              return <path key={i} d={d} fill="var(--ink-100)" stroke="var(--white)" strokeWidth={1} />;
            })}
          </g>
          <path d={path(vnFeature) ?? undefined} fill="var(--blue-50)" stroke="var(--blue-300)" strokeWidth={1.1} strokeLinejoin="round" />

          {(data.archipelagos ?? []).map((a) => {
            const c = projectPoint(a.lon, a.lat);
            if (!c) return null;
            return (
              <g key={a.id} className={styles.archLabel} role="img" aria-label={`${a.name} — thuộc chủ quyền Việt Nam, ${a.administered_by || ""} (vị trí minh hoạ)`}>
                {(a.islet_offsets ?? [[0, 0]]).map((o, i) => {
                  const q = projectPoint(a.lon + o[0], a.lat + o[1]);
                  if (!q) return null;
                  return <circle key={i} cx={q[0].toFixed(1)} cy={q[1].toFixed(1)} r={1.7} fill="var(--blue-500)" fillOpacity={0.85} />;
                })}
                <circle cx={c[0].toFixed(1)} cy={c[1].toFixed(1)} r={20} fill="none" stroke="var(--blue-300)" strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.9} />
                {(() => {
                  // A two-line Vietnamese label ("QUẦN ĐẢO ..." / administered-by)
                  // needs a wider edge margin than the shorter globe label below.
                  const { x: tx, anchor } = edgeAnchor(c[0], W, 100);
                  // On a narrow map the two archipelago labels sit close enough
                  // together that showing both lines risks them overlapping —
                  // the administered-by line is supplementary, so drop it below
                  // ~360px of map width and keep only the sovereignty name.
                  const showSub = a.administered_by && W >= 360;
                  return (
                    <>
                      <text x={tx.toFixed(1)} y={(c[1] + 33).toFixed(1)} textAnchor={anchor}>{a.name}</text>
                      {showSub && (
                        <text className="sub" x={tx.toFixed(1)} y={(c[1] + 44).toFixed(1)} textAnchor={anchor}>{a.administered_by}</text>
                      )}
                    </>
                  );
                })()}
              </g>
            );
          })}

          {ov.length > 0 && (
            <g
              ref={globeGroupRef}
              tabIndex={0}
              role="button"
              aria-expanded={globeOpen}
              aria-label={`Hội Sinh viên Việt Nam ở ngoài nước — ${ov.length} nước, tính riêng ngoài 34 tỉnh, thành. Chọn để mở danh sách.`}
              className={[styles.globe, selectedOverseasName ? styles.globeSelected : "", globeOpen ? styles.globeOpen : ""].join(" ")}
              onMouseEnter={() => setGlobeHover(true)}
              onMouseLeave={() => setGlobeHover(false)}
              onFocus={() => setGlobeHover(true)}
              onBlur={() => setGlobeHover(false)}
              onClick={() => setGlobeOpen((v) => !v)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setGlobeOpen((v) => !v);
                }
              }}
            >
              <circle className="sphere" cx={gcx} cy={gcy} r={gr} fill="var(--blue-500)" fillOpacity={0.08} stroke="var(--blue-400)" strokeWidth={1.1} />
              {[0.34, 0.68].map((f) => (
                <ellipse key={f} cx={gcx} cy={gcy} rx={gr * f} ry={gr} fill="none" stroke="var(--blue-300)" strokeWidth={0.9} />
              ))}
              <line x1={gcx} y1={gcy - gr} x2={gcx} y2={gcy + gr} stroke="var(--blue-300)" strokeWidth={0.9} />
              {[-0.62, 0, 0.62].map((f) => {
                const y = gcy + gr * f;
                const hx = gr * Math.sqrt(Math.max(0, 1 - f * f));
                return <line key={f} x1={gcx - hx} y1={y} x2={gcx + hx} y2={y} stroke="var(--blue-300)" strokeWidth={0.9} />;
              })}
              <g className={styles.globeLabel}>
                {(() => {
                  const { x: tx, anchor } = edgeAnchor(gcx, W);
                  return <text x={tx} y={gcy + gr + 14} textAnchor={anchor}>Ngoài nước · {ov.length} nước</text>;
                })()}
              </g>
            </g>
          )}

          {order.map((i) => {
            const p = provinces[i];
            const xy = projectPoint(p.lon, p.lat);
            if (!xy) return null;
            const v = provinceValue(p, filter);
            const sel = selectedSlug === p.slug;
            const none = v == null;
            const rad = none ? 4.6 : r(v);
            const label = none
              ? `${p.province_name}: chưa có số liệu${p.reported === false ? " — đơn vị chưa báo cáo kỳ này" : " cho chuyên mục đang chọn"}`
              : `${p.province_name}: ${v} hoạt động${p.article_count != null ? `, ${p.article_count} tin bài` : ""}`;
            return (
              <g
                key={p.slug}
                className={styles.province}
                transform={`translate(${xy[0].toFixed(1)},${xy[1].toFixed(1)})`}
                tabIndex={0}
                role="button"
                aria-label={label}
                aria-pressed={sel}
                onMouseEnter={() => setHoverSlug(p.slug)}
                onMouseLeave={() => setHoverSlug((s) => (s === p.slug ? null : s))}
                onFocus={() => setHoverSlug(p.slug)}
                onBlur={() => setHoverSlug((s) => (s === p.slug ? null : s))}
                onClick={() => onSelectProvince(selectedSlug === p.slug ? null : p.slug)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectProvince(selectedSlug === p.slug ? null : p.slug);
                  }
                }}
              >
                <circle className="ring" r={rad + 5.5} fill="none" stroke="var(--blue-700)" strokeWidth={sel ? 1.8 : 0} opacity={sel ? 1 : 0} />
                {none ? (
                  <circle className="dot" r={rad} fill="var(--white)" fillOpacity={0.9} stroke="var(--ink-400)" strokeWidth={1.3} strokeDasharray="2.6 2.2" />
                ) : (
                  <circle
                    className="dot"
                    r={rad}
                    fill={sel ? "var(--blue-700)" : "var(--blue-500)"}
                    fillOpacity={sel ? 1 : 0.32 + 0.5 * ((v ?? 0) / max)}
                    stroke="var(--white)"
                    strokeWidth={1}
                  />
                )}
                <circle className="hit" r={Math.max(rad + 9, 16)} />
              </g>
            );
          })}
        </svg>

        {tip && hoverProvince && (
          <div className={`${styles.tip} ${styles.tipOn}`} style={{ left: Math.round(tip.x), top: Math.round(tip.y) }}>
            <h4 className={styles.tipHead}>{hoverProvince.province_name}</h4>
            {tip.none ? (
              <div className={styles.tipNone}>
                {hoverProvince.reported === false ? "Đơn vị chưa báo cáo trong kỳ này." : "Chưa có dữ liệu cho chuyên mục đang chọn."}
              </div>
            ) : (
              <>
                <div className={styles.tipNums}>
                  <div><b>{fmt(tip.v as number)}</b><span>hoạt động</span></div>
                  {hoverProvince.article_count != null && (
                    <div><b>{fmt(hoverProvince.article_count)}</b><span>tin bài</span></div>
                  )}
                </div>
                {hoverProvince.latest_article && (
                  <p className={styles.tipArticle}>
                    <em>Tin mới nhất</em>
                    {hoverProvince.latest_article.title}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {ov.length > 0 && (
          <div
            ref={gpanelRef}
            role="group"
            aria-label="Hội Sinh viên Việt Nam ở ngoài nước"
            className={[styles.gpanel, showGpanel ? styles.gpanelOn : "", globeOpen ? styles.gpanelPinned : ""].join(" ")}
            style={gPanelPlacement(W, H, gcx, gcy, gr)}
          >
            <div className={styles.gpanelHead}>
              <div>
                <h4 className={styles.gpanelH4}>Hội Sinh viên Việt Nam ở ngoài nước</h4>
                <p className={styles.gpanelSub}>{ov.length} nước · tính riêng ngoài 34 tỉnh, thành</p>
              </div>
              <button type="button" className={styles.gpanelClose} aria-label="Đóng danh sách" onClick={() => { setGlobeOpen(false); globeGroupRef.current?.focus(); }}>
                <IconClose size={13} />
              </button>
            </div>
            <ol className={styles.gpanelList}>
              {sorted.map((c) => {
                const v = c.activity_count || 0;
                const f = v / gmax;
                const active = selectedOverseasName === c.name;
                return (
                  <li key={c.name}>
                    <button
                      type="button"
                      aria-pressed={active}
                      className={`${styles.gpanelRowBtn} ${active ? styles.gpanelRowBtnActive : ""}`}
                      onClick={() => onSelectOverseas(active ? null : c)}
                    >
                      <span className={styles.gpanelRow}>
                        <span className={styles.gpanelRowName}>{c.name.replace("Hội Sinh viên Việt Nam tại ", "")}</span>
                        <b className={styles.gpanelRowValue}>{v}</b>
                      </span>
                      <div className={styles.gpanelBar}>
                        <span className={styles.gpanelBarFill} style={{ width: `${Math.max(6, Math.round(f * 100))}%`, opacity: (0.3 + 0.7 * f).toFixed(2) }} />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ol>
            <p className={styles.gpanelHint}>Bấm tên một Hội để xem số liệu chi tiết ở bảng bên cạnh.</p>
          </div>
        )}
      </div>

      <div className={styles.legend}>
        <span className={styles.legendLabel}>Mức hoạt động</span>
        <div className={styles.legendSizes}>
          {[0.15, 0.5, 1].map((f) => {
            const s = Math.round(r(max * f) * 2);
            return (
              <div key={f} className={styles.legendSizeItem}>
                <span className={styles.legendDot} style={{ width: s, height: s }} />
                {Math.round(max * f)}
              </div>
            );
          })}
        </div>
        {hasNone && (
          <span className={styles.legendNone}>
            <i className={styles.legendNoneDot} />
            Chưa có dữ liệu
          </span>
        )}
      </div>
    </div>
  );
}

/** Place the overseas panel left or right of the globe — whichever side has room. */
function gPanelPlacement(W: number, H: number, gcx: number, gcy: number, gr: number): React.CSSProperties {
  const pw = Math.min(290, Math.max(180, W - 16));
  const ph = Math.max(160, H - 16);
  const gap = 14;
  const rightX = gcx + gr + gap;
  const leftX = gcx - gr - gap - pw;
  const fitsLeft = leftX >= 4;
  const fitsRight = rightX + pw <= W - 4;
  let x: number;
  let y = Math.max(4, Math.min(gcy - gr, H - ph - 4));
  if (fitsLeft) x = leftX;
  else if (fitsRight) x = rightX;
  else {
    x = Math.max(4, Math.min(W - pw - 4, gcx - pw / 2));
    y = Math.max(4, Math.min(gcy + gr + 22, H - ph - 4));
  }
  return { left: Math.round(x), top: Math.round(y), width: pw, maxHeight: ph };
}
