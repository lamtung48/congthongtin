"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./Gallery.module.css";
import { MediaPlaceholder } from "@/components/ui/MediaPlaceholder";
import { IconArrowLeft, IconArrowRight, IconClose, IconImageBroken, IconOffline } from "@/components/icons";
import { gallerySource } from "@/lib/data/homepage";

export function Gallery() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [loadingPhase, setLoadingPhase] = useState(false);
  const lbRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const loadTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [feature, ...rest] = gallerySource;

  function openLightbox(i: number, el: HTMLElement) {
    returnFocusRef.current = el;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    setOpenIndex(i);
    setLoadingPhase(true);
    clearTimeout(loadTimer.current);
    loadTimer.current = setTimeout(() => setLoadingPhase(false), 380);
    setTimeout(() => closeBtnRef.current?.focus(), 60);
  }

  function step(dir: number) {
    const n = gallerySource.length;
    setOpenIndex((i) => (((i ?? 0) + dir) % n + n) % n);
    setLoadingPhase(true);
    clearTimeout(loadTimer.current);
    loadTimer.current = setTimeout(() => setLoadingPhase(false), 380);
  }

  function close() {
    clearTimeout(loadTimer.current);
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
    setOpenIndex(null);
    const el = returnFocusRef.current;
    if (el) setTimeout(() => { try { el.focus(); } catch {} }, 40);
  }

  useEffect(() => {
    if (openIndex == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { close(); return; }
      if (e.key === "ArrowRight") { e.preventDefault(); step(1); return; }
      if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); return; }
      if (e.key === "Tab" && lbRef.current) {
        const focusable = Array.from(lbRef.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,[tabindex]:not([tabindex="-1"])')).filter(
          (el) => el.offsetParent !== null
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIndex]);

  const item = openIndex != null ? gallerySource[openIndex] : null;

  return (
    <section aria-label="Ảnh hoạt động" className={styles.section}>
      <div className={styles.head}>
        <div className={styles.headText}>
          <span className={styles.eyebrow}>Thư viện ảnh</span>
          <h2 className={styles.title}>Ảnh hoạt động</h2>
        </div>
        <span className={styles.noPage}>
          <IconOffline size={14} />
          Trang thư viện ảnh chưa có
        </span>
      </div>
      <p className={styles.notice}>
        <IconImageBroken size={17} className={styles.noticeIcon} />
        Các ô dưới đây đang chờ ảnh tư liệu chính thức. Chú thích, địa điểm và ngày là nội dung mẫu; nguồn ảnh sẽ được điền khi ban biên tập cung cấp tệp gốc.
      </p>

      <div data-l="gallery" className={styles.grid}>
        <button
          type="button"
          onClick={(e) => openLightbox(0, e.currentTarget)}
          aria-label={`Mở ảnh lớn: ${feature.caption}`}
          data-gallery-tile
          className={`${styles.tile} ${styles.tileFeature}`}
        >
          <MediaPlaceholder need={feature.need} />
          <span aria-hidden="true" className={styles.tileScrimFeature} />
          <span className={styles.tileInfoFeature}>
            <span data-gcap className={styles.captionFeature}>{feature.caption}</span>
            <span className={styles.metaFeature}>{[feature.place, feature.date].filter(Boolean).join(" · ")}</span>
            <span data-ghint className={styles.hintFeature}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M4 9V4h5M20 15v5h-5M20 9V4h-5M4 15v5h5" /></svg>
              Xem ảnh lớn
            </span>
          </span>
        </button>

        {rest.map((g, idx) => {
          const i = idx + 1;
          return (
            <button
              key={g.caption}
              type="button"
              onClick={(e) => openLightbox(i, e.currentTarget)}
              aria-label={`Mở ảnh lớn: ${g.caption}`}
              data-gallery-tile
              className={styles.tile}
            >
              <MediaPlaceholder need={g.need} />
              <span aria-hidden="true" className={styles.tileScrim} />
              <span className={styles.tileInfo}>
                <span data-gcap className={styles.caption}>{g.caption}</span>
                <span data-ghint className={styles.hint}>{[g.place, g.date].filter(Boolean).join(" · ")}</span>
              </span>
            </button>
          );
        })}
      </div>

      {item && (
        <div
          ref={lbRef}
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label={`Ảnh hoạt động — ${(openIndex ?? 0) + 1} / ${gallerySource.length}`}
          className={styles.lbBackdrop}
        >
          <div onClick={(e) => e.stopPropagation()} className={styles.lbInner}>
            <div className={styles.lbTopRow}>
              <span className={styles.lbCounter}>{(openIndex ?? 0) + 1} / {gallerySource.length}</span>
              <button ref={closeBtnRef} type="button" onClick={close} aria-label="Đóng ảnh lớn" className={styles.lbIconBtn}>
                <IconClose size={18} />
              </button>
            </div>
            <div className={styles.lbMidRow}>
              <button type="button" onClick={() => step(-1)} aria-label="Ảnh trước" className={styles.lbIconBtn}>
                <IconArrowLeft size={18} />
              </button>
              <div className={styles.lbFrame}>
                {loadingPhase ? (
                  <div className={styles.lbLoading}>
                    <span className={styles.lbSpinner} />
                    <span aria-live="polite" className={styles.lbLoadingLabel}>Đang tải ảnh…</span>
                  </div>
                ) : (
                  <MediaPlaceholder need={item.need} />
                )}
              </div>
              <button type="button" onClick={() => step(1)} aria-label="Ảnh sau" className={styles.lbIconBtn}>
                <IconArrowRight size={18} />
              </button>
            </div>
            <div className={styles.lbCaptionBlock}>
              <span className={styles.lbCaption}>{item.caption}</span>
              <span className={styles.lbMeta}>{[item.place, item.date].filter(Boolean).join(" · ")}</span>
              <span className={styles.lbMeta}>Nguồn ảnh: chưa được cung cấp</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
