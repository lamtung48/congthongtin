"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import styles from "./Hero.module.css";
import { MediaPlaceholder } from "@/components/ui/MediaPlaceholder";
import { IconArrowRight, IconMapPin } from "@/components/icons";
import type { HeroSlide } from "@/domain/homepage";
import { formatDateTimeVi } from "@/lib/formatDate";
import { resolveImageUrl } from "@/lib/media/resolveMedia";
import { articleCoverTransitionName } from "@/lib/viewTransition";
import { useArticleTransitionClick } from "@/lib/hooks/useArticleTransitionClick";

/** ms the controls stay locked after a change is triggered — long enough to
 *  cover the image crossfade (spec: 700–850ms). */
const CHANGE_LOCK_MS = 820;
/** How long the outgoing copy takes to fade out + lift before the swap. */
const COPY_OUT_MS = 180;

function splitAccent(title: string, accent?: string): [string, string, string] | null {
  if (!accent) return null;
  const i = title.indexOf(accent);
  if (i < 0) return null;
  return [title.slice(0, i), accent, title.slice(i + accent.length)];
}

export function Hero({ slides }: { slides: HeroSlide[] }) {
  const list = slides.slice(0, 4);
  const count = list.length;

  const [active, setActive] = useState(0);
  const [copyPhase, setCopyPhase] = useState<"in" | "out">("in");
  const [locked, setLocked] = useState(false);
  const [ready, setReady] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRefs = useRef<(HTMLImageElement | null)[]>([]);
  const baseId = useId();

  // Entrance motion runs only after mount — content is visible in SSR/no-JS.
  useEffect(() => {
    const t = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const goTo = useCallback(
    (next: number) => {
      if (locked || count < 2) return;
      const target = (next + count) % count;
      if (target === active) return;
      setLocked(true);
      setCopyPhase("out");
      // preload the image we're about to show + the one after it
      [target, (target + 1) % count].forEach((i) => {
        const src = resolveImageUrl(list[i].media);
        if (src) {
          const p = new Image();
          p.src = src;
        }
      });
      window.setTimeout(() => {
        setActive(target);
        setCopyPhase("in");
      }, COPY_OUT_MS);
      window.setTimeout(() => setLocked(false), CHANGE_LOCK_MS);
    },
    [active, count, list, locked],
  );

  // Very light desktop parallax; paused while the Hero is out of view.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const narrow = window.matchMedia("(max-width: 900px)");
    if (mq.matches || narrow.matches) return;

    let visible = true;
    let raf = 0;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0 });
    io.observe(stage);

    const onScroll = () => {
      if (raf || !visible) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const rect = stage.getBoundingClientRect();
        const p = Math.max(-1, Math.min(1, -rect.top / (rect.height || 1)));
        stage.style.setProperty("--par-img", `${(p * 36).toFixed(1)}px`);
        stage.style.setProperty("--par-copy", `${(p * 12).toFixed(1)}px`);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Per-image contrast probe for the text-safe area — bumps the scrim when
  // the copy would sit on a bright part of the picture.
  const probeContrast = useCallback((idx: number) => {
    const stage = stageRef.current;
    const img = imgRefs.current[idx];
    if (!stage || !img || idx !== active || !img.naturalWidth) return;
    try {
      const cv = document.createElement("canvas");
      cv.width = 40;
      cv.height = 24;
      const ctx = cv.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      // text-safe box: left 58%, bottom 55%
      const x0 = 0;
      const x1 = Math.floor(cv.width * 0.58);
      const y0 = Math.floor(cv.height * 0.45);
      const { data } = ctx.getImageData(x0, y0, x1 - x0, cv.height - y0);
      let sum = 0;
      let n = 0;
      for (let i = 0; i < data.length; i += 4) {
        sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        n++;
      }
      const mean = n ? sum / n / 255 : 0;
      stage.dataset.contrast = mean > 0.52 ? "boost" : "ok";
    } catch {
      // cross-origin taint or a blocked read — leave the configured scrim as-is
    }
  }, [active]);

  useEffect(() => {
    probeContrast(active);
  }, [active, probeContrast]);

  const current = list[Math.min(active, Math.max(count - 1, 0))];
  const onCoverClick = useArticleTransitionClick(current?.articleUrl ?? "");

  if (!current) return null;
  const accentParts = splitAccent(current.title, current.titleAccent);
  const headingId = `${baseId}-headline`;
  // Step the title down for longer headlines so the whole thing shows — the
  // Hero never truncates the title or ends it with "…".
  const titleLen = current.title.length;
  const titleLen100 = titleLen <= 64 ? "s" : titleLen <= 96 ? "m" : titleLen <= 132 ? "l" : "xl";

  return (
    <section aria-labelledby={headingId} aria-roledescription="băng chuyền" className={styles.hero}>
      <div
        ref={stageRef}
        className={styles.stage}
        data-ready={ready || undefined}
        data-theme={current.theme}
        data-overlay={current.overlay}
        data-side={current.overlaySide}
      >
        {/* stacked full-bleed image layers — all mounted so changes crossfade */}
        <div className={styles.layers} aria-hidden="true">
          {list.map((s, i) => {
            const src = resolveImageUrl(s.media);
            return (
              <div key={s.id} className={styles.layer} data-active={i === active || undefined}>
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    ref={(el) => {
                      imgRefs.current[i] = el;
                    }}
                    src={src}
                    alt=""
                    className={styles.layerImg}
                    loading={i === 0 ? "eager" : "lazy"}
                    fetchPriority={i === 0 ? "high" : "auto"}
                    decoding={i === 0 ? "sync" : "async"}
                    onLoad={() => probeContrast(i)}
                    style={
                      {
                        "--fx-d": `${s.focalDesktop.x}%`,
                        "--fy-d": `${s.focalDesktop.y}%`,
                        "--fx-m": `${s.focalMobile.x}%`,
                        "--fy-m": `${s.focalMobile.y}%`,
                      } as CSSProperties
                    }
                  />
                ) : (
                  <MediaPlaceholder need={s.media.placeholder ?? s.alt} />
                )}
              </div>
            );
          })}
          <span className={styles.scrimH} />
          <span className={styles.scrimV} />
        </div>

        {/* editorial copy, positioned + sized by the per-slide text box */}
        <div
          className={styles.canvas}
          style={
            {
              "--tx": current.text.x,
              "--ty": current.text.y,
              "--tw": current.text.w,
              "--tscale": current.text.scale,
            } as CSSProperties
          }
        >
          <div key={active} className={styles.copy} data-phase={copyPhase}>
            <p className={styles.kicker}>{current.category}</p>
            <h1 id={headingId} className={styles.title} data-len={titleLen100}>
              {accentParts ? (
                <>
                  {accentParts[0]}
                  <span className={styles.titleAccent}>{accentParts[1]}</span>
                  {accentParts[2]}
                </>
              ) : (
                current.title
              )}
            </h1>
            {current.summary && <p className={styles.summary}>{current.summary}</p>}
            <div className={styles.metaRow}>
              <span className={styles.metaBits}>
                {current.author && <span>{current.author}</span>}
                {current.author && <span className={styles.dot} />}
                <span>{formatDateTimeVi(current.publishedAt)}</span>
                {current.readingTimeMinutes ? (
                  <>
                    <span className={styles.dot} />
                    <span>{current.readingTimeMinutes} phút đọc</span>
                  </>
                ) : null}
              </span>
              <Link
                href={current.articleUrl}
                onClick={onCoverClick}
                className={styles.cta}
                style={{ viewTransitionName: articleCoverTransitionName(current.articleUrl) }}
              >
                {current.ctaLabel}
                <IconArrowRight size={17} />
              </Link>
            </div>
          </div>
        </div>

        {/* baseline connecting the metadata (left) with the caption (right) */}
        <span className={styles.baseline} aria-hidden="true" />
        {current.caption && (
          <span className={styles.caption}>
            <IconMapPin size={12} />
            {current.caption}
          </span>
        )}

        {count > 1 && (
          <div className={styles.controls} role="group" aria-label="Chuyển bài nổi bật">
            <span className={styles.counter} aria-hidden="true">
              {String(active + 1).padStart(2, "0")}
              <span className={styles.counterSep}>/</span>
              {String(count).padStart(2, "0")}
            </span>
            <span className={styles.progress} aria-hidden="true">
              {list.map((s, i) => (
                <span key={s.id} className={styles.tick} data-on={i === active || undefined} />
              ))}
            </span>
            <span className={styles.navBtns}>
              <button
                type="button"
                className={styles.navBtn}
                onClick={() => goTo(active - 1)}
                disabled={locked}
                aria-label="Bài nổi bật trước"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 5l-7 7 7 7" />
                </svg>
              </button>
              <button
                type="button"
                className={styles.navBtn}
                onClick={() => goTo(active + 1)}
                disabled={locked}
                aria-label="Bài nổi bật kế tiếp"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
