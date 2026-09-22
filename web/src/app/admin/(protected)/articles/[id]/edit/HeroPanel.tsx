"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import styles from "./HeroPanel.module.css";
import type { HeroConfigInput } from "@/server/validation/heroConfig";

type Bp = "desktop" | "mobile";

const DEFAULT_D = { x: 50, y: 42 };
const TEXT_D = { x: 1, y: 26, w: 47, scale: 1 };
const OVERLAYS: { key: NonNullable<HeroConfigInput["overlay"]>; label: string }[] = [
  { key: "soft", label: "Nhẹ" },
  { key: "medium", label: "Vừa" },
  { key: "strong", label: "Đậm" },
];

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function isEmpty(v: HeroConfigInput): boolean {
  const t = v.text ?? {};
  return (
    !v.focalDesktop &&
    !v.focalMobile &&
    (!v.overlay || v.overlay === "medium") &&
    (!v.overlaySide || v.overlaySide === "left") &&
    (!v.theme || v.theme === "dark") &&
    !v.caption?.trim() &&
    !v.titleAccent?.trim() &&
    t.x === undefined &&
    t.y === undefined &&
    t.w === undefined &&
    (t.scale === undefined || t.scale === 1)
  );
}

export function HeroPanel({
  coverMediaId,
  title,
  value,
  onChange,
}: {
  coverMediaId: string | null;
  title: string;
  value: HeroConfigInput | null;
  onChange: (v: HeroConfigInput | null) => void;
}) {
  const [bp, setBp] = useState<Bp>("desktop");
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<null | { kind: "focal" | "move" | "resize"; ox: number; oy: number }>(null);

  const cfg = value ?? {};
  const focalD = cfg.focalDesktop ?? DEFAULT_D;
  const focalM = cfg.focalMobile ?? { x: focalD.x, y: clamp(focalD.y - 8) };
  const focal = bp === "desktop" ? focalD : focalM;
  const side: "left" | "right" = cfg.overlaySide === "right" ? "right" : "left";
  const tw = cfg.text?.w ?? TEXT_D.w;
  const T = {
    x: cfg.text?.x ?? (side === "right" ? Math.max(0, 100 - tw) : TEXT_D.x),
    y: cfg.text?.y ?? TEXT_D.y,
    w: tw,
    scale: cfg.text?.scale ?? TEXT_D.scale,
  };

  const src = coverMediaId ? `/api/media/${coverMediaId}` : null;

  const patch = useCallback(
    (next: Partial<HeroConfigInput>) => {
      const merged: HeroConfigInput = { ...(value ?? {}), ...next };
      onChange(isEmpty(merged) ? null : merged);
    },
    [value, onChange],
  );
  const patchText = useCallback(
    (next: Partial<NonNullable<HeroConfigInput["text"]>>) => patch({ text: { ...cfg.text, ...next } }),
    [cfg.text, patch],
  );

  const setFocal = useCallback(
    (x: number, y: number) => {
      const p = { x: clamp(x), y: clamp(y) };
      patch(bp === "desktop" ? { focalDesktop: p } : { focalMobile: p });
    },
    [bp, patch],
  );

  const pct = useCallback((clientX: number, clientY: number) => {
    const el = boxRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * 100, y: ((clientY - r.top) / r.height) * 100 };
  }, []);

  const onMove = useCallback(
    (clientX: number, clientY: number) => {
      const d = drag.current;
      const p = pct(clientX, clientY);
      if (!d || !p) return;
      if (d.kind === "focal") setFocal(p.x, p.y);
      else if (d.kind === "move") {
        patchText({ x: clamp(p.x - d.ox, 0, 100 - T.w), y: clamp(p.y - d.oy, 0, 90) });
      } else if (d.kind === "resize") {
        patchText({ w: clamp(p.x - T.x, 22, 78) });
      }
    },
    [pct, setFocal, patchText, T.w, T.x],
  );

  const titleAccentValid = useMemo(
    () => !cfg.titleAccent?.trim() || title.includes(cfg.titleAccent.trim()),
    [cfg.titleAccent, title],
  );

  if (!src) {
    return (
      <p className={styles.hint} style={{ marginTop: 12 }}>
        Chọn <strong>Ảnh cover</strong> ở trên để chỉnh cách bài hiển thị trên Hero trang chủ.
      </p>
    );
  }

  const scalePctLabel = `${Math.round(T.scale * 100)}%`;

  return (
    <details className={styles.panel}>
      <summary className={styles.summary}>
        Hiển thị trên Hero trang chủ
        {value && !isEmpty(value) ? <span className={styles.badge}>đã tuỳ chỉnh</span> : <span className={styles.badgeMuted}>tự động</span>}
      </summary>

      <div className={styles.body}>
        <div className={styles.tabs} role="tablist" aria-label="Khung hình">
          {(["desktop", "mobile"] as Bp[]).map((b) => (
            <button
              key={b}
              type="button"
              role="tab"
              aria-selected={bp === b}
              className={bp === b ? styles.tabOn : styles.tab}
              onClick={() => setBp(b)}
            >
              {b === "desktop" ? "Máy tính" : "Điện thoại"}
            </button>
          ))}
        </div>

        <div
          ref={boxRef}
          className={`${styles.stage} ${bp === "mobile" ? styles.stageMobile : ""}`}
          onPointerMove={(e) => onMove(e.clientX, e.clientY)}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            className={styles.img}
            style={{ objectPosition: `${focal.x}% ${focal.y}%` }}
            draggable={false}
          />
          <span className={styles.scrim} data-theme={cfg.theme ?? "dark"} data-overlay={cfg.overlay ?? "medium"} data-side={side} />

          {/* draggable / resizable text block (desktop only) */}
          {bp === "desktop" && (
            <div
              className={styles.textBox}
              style={{ left: `${T.x}%`, top: `${T.y}%`, width: `${T.w}%` }}
              onPointerDown={(e) => {
                const p = pct(e.clientX, e.clientY);
                if (!p) return;
                (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                drag.current = { kind: "move", ox: p.x - T.x, oy: p.y - T.y };
              }}
            >
              <span className={styles.tbLabel}>Khối chữ</span>
              <span className={styles.tbFake} style={{ fontSize: `${13 * T.scale}px` }}>
                Tiêu đề bài viết
              </span>
              <span className={styles.tbFakeSm}>mô tả ngắn · metadata · CTA</span>
              <span
                className={styles.tbHandle}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                  drag.current = { kind: "resize", ox: 0, oy: 0 };
                }}
              />
            </div>
          )}
          {bp === "mobile" && (
            <span className={styles.mobileNote}>Trên điện thoại, khối chữ luôn là panel bên dưới ảnh — chỉ cỡ chữ áp dụng.</span>
          )}

          {/* focal marker */}
          <button
            type="button"
            className={styles.marker}
            style={{ left: `${focal.x}%`, top: `${focal.y}%` }}
            aria-label={`Điểm lấy nét (${focal.x}%, ${focal.y}%) — phím mũi tên để chỉnh`}
            onPointerDown={(e) => {
              (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
              drag.current = { kind: "focal", ox: 0, oy: 0 };
              const p = pct(e.clientX, e.clientY);
              if (p) setFocal(p.x, p.y);
            }}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 5 : 2;
              if (e.key === "ArrowLeft") { e.preventDefault(); setFocal(focal.x - step, focal.y); }
              else if (e.key === "ArrowRight") { e.preventDefault(); setFocal(focal.x + step, focal.y); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setFocal(focal.x, focal.y - step); }
              else if (e.key === "ArrowDown") { e.preventDefault(); setFocal(focal.x, focal.y + step); }
            }}
          />
        </div>
        <p className={styles.hint}>
          Kéo <strong>chấm trắng</strong> để đặt điểm lấy nét
          {bp === "desktop" && <> · kéo <strong>khối chữ</strong> để đổi vị trí, kéo cạnh phải để đổi bề rộng</>}.
        </p>

        <div className={styles.controls}>
          <label className={styles.field}>
            <span className={styles.ctrlLabel}>Cỡ chữ tiêu đề — {scalePctLabel}</span>
            <input
              type="range"
              min={75}
              max={135}
              step={5}
              value={Math.round(T.scale * 100)}
              onChange={(e) => patchText({ scale: Number(e.target.value) / 100 })}
            />
          </label>

          <div className={styles.ctrlRow}>
            <span className={styles.ctrlLabel}>Hướng gradient</span>
            <span className={styles.seg}>
              <button type="button" className={side === "left" ? styles.segOn : styles.segBtn} onClick={() => patch({ overlaySide: "left" })}>
                Tối bên trái
              </button>
              <button type="button" className={side === "right" ? styles.segOn : styles.segBtn} onClick={() => patch({ overlaySide: "right" })}>
                Tối bên phải
              </button>
            </span>
          </div>

          <div className={styles.ctrlRow}>
            <span className={styles.ctrlLabel}>Độ phủ gradient</span>
            <span className={styles.seg}>
              {OVERLAYS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  className={(cfg.overlay ?? "medium") === o.key ? styles.segOn : styles.segBtn}
                  onClick={() => patch({ overlay: o.key })}
                >
                  {o.label}
                </button>
              ))}
            </span>
          </div>

          <div className={styles.ctrlRow}>
            <span className={styles.ctrlLabel}>Màu chữ</span>
            <span className={styles.seg}>
              <button type="button" className={(cfg.theme ?? "dark") === "dark" ? styles.segOn : styles.segBtn} onClick={() => patch({ theme: "dark" })}>
                Sáng (trên ảnh tối)
              </button>
              <button type="button" className={cfg.theme === "light" ? styles.segOn : styles.segBtn} onClick={() => patch({ theme: "light" })}>
                Tối (trên ảnh sáng)
              </button>
            </span>
          </div>

          <label className={styles.field}>
            <span className={styles.ctrlLabel}>Chú thích ảnh (góc phải dưới)</span>
            <input
              type="text"
              className={styles.input}
              value={cfg.caption ?? ""}
              maxLength={180}
              placeholder="VD: Trung tâm Hội nghị Quốc gia, Hà Nội"
              onChange={(e) => patch({ caption: e.target.value })}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.ctrlLabel}>Cụm chữ nhấn màu trong tiêu đề</span>
            <input
              type="text"
              className={styles.input}
              value={cfg.titleAccent ?? ""}
              maxLength={140}
              placeholder="một cụm nằm trong tiêu đề, VD: khai mạc tại Hà Nội"
              onChange={(e) => patch({ titleAccent: e.target.value })}
            />
            {!titleAccentValid && <span className={styles.warn}>Cụm này không có trong tiêu đề — sẽ không được nhấn.</span>}
          </label>

          {value && !isEmpty(value) && (
            <button type="button" className={styles.reset} onClick={() => onChange(null)}>
              Đặt lại toàn bộ về mặc định (tự động)
            </button>
          )}
        </div>
      </div>
    </details>
  );
}
