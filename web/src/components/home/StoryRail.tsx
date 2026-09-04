"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";
import styles from "./StoryRail.module.css";
import { MediaPlaceholder } from "@/components/ui/MediaPlaceholder";
import { IconArrowLeft, IconArrowRight } from "@/components/icons";
import type { StoryRailItem } from "@/data-access/types";
import { formatDateVi } from "@/lib/formatDate";

/**
 * Signature "Dòng chảy sinh viên" section. Desktop (>=1024px, motion on):
 * the section pins via sticky while the vertical scroll it consumes is
 * mapped onto horizontal translateX of the track. Below that breakpoint, or
 * with reduced motion, it's a plain native horizontal scroller with snap.
 *
 * Only the data source changed here (`stories` prop instead of a fixture
 * import) — the sticky-pin/scroll-progress logic below is untouched.
 */
export function StoryRail({ stories }: { stories: StoryRailItem[] }) {
  const outerRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const hintRef = useRef<HTMLSpanElement>(null);
  const prevRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const fadeRef = useRef<HTMLSpanElement>(null);

  const pinRef = useRef(false);
  const rangeRef = useRef(0);
  const travelRef = useRef(0);
  const activeRef = useRef(0);

  const reducedMotion = useCallback(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  useEffect(() => {
    const cards = () => (trackRef.current ? Array.from(trackRef.current.children) as HTMLElement[] : []);

    function layoutFlow() {
      const outer = outerRef.current, sticky = stickyRef.current, vp = viewportRef.current, track = trackRef.current;
      if (!outer || !sticky || !vp || !track) return;
      outer.style.height = "";
      sticky.style.position = "";
      sticky.style.top = "";
      track.style.transform = "";
      const travel = Math.max(track.scrollWidth - vp.clientWidth, 0);
      travelRef.current = travel;
      const pin = window.innerWidth >= 1024 && !reducedMotion() && travel > 120;
      pinRef.current = pin;
      if (pin) {
        sticky.style.position = "sticky";
        sticky.style.top = "var(--header-h-compact)";
        vp.style.overflowX = "hidden";
        vp.style.scrollSnapType = "none";
        vp.scrollLeft = 0;
        // Vertical travel = 0.55x the horizontal travel (clamped 280–900px):
        // an even mapping that's shorter than a naive 1:1 and never leaves a
        // dead zone after the rail finishes.
        rangeRef.current = Math.min(Math.max(Math.round(travel * 0.55), 280), 900);
        outer.style.height = `${sticky.offsetHeight + rangeRef.current}px`;
        if (hintRef.current) hintRef.current.textContent = "Cuộn để khám phá";
      } else {
        vp.style.overflowX = "auto";
        vp.style.scrollSnapType = "x mandatory";
        rangeRef.current = 0;
        if (hintRef.current) hintRef.current.textContent = "Vuốt ngang để xem";
      }
      updateFlow();
    }

    function flowProgress() {
      const outer = outerRef.current, vp = viewportRef.current;
      if (!outer || !vp) return 0;
      if (pinRef.current) {
        if (!rangeRef.current) return 0;
        const top = outer.getBoundingClientRect().top;
        return Math.min(Math.max((64 - top) / rangeRef.current, 0), 1);
      }
      const max = vp.scrollWidth - vp.clientWidth;
      return max > 0 ? Math.min(Math.max(vp.scrollLeft / max, 0), 1) : 0;
    }

    function updateFlow() {
      const vp = viewportRef.current, track = trackRef.current;
      if (!vp || !track) return;
      const list = cards();
      if (!list.length) return;
      const p = flowProgress();
      if (pinRef.current) track.style.transform = `translate3d(${(-p * travelRef.current).toFixed(1)}px,0,0)`;

      let active: number;
      if (pinRef.current) {
        active = Math.round(p * (list.length - 1));
      } else {
        const mid = vp.getBoundingClientRect().left + vp.clientWidth / 2;
        let bestD = Infinity;
        active = 0;
        list.forEach((c, i) => {
          const cr = c.getBoundingClientRect();
          const d = Math.abs(cr.left + cr.width / 2 - mid);
          if (d < bestD) { bestD = d; active = i; }
        });
      }
      activeRef.current = active;
      const reduced = reducedMotion();
      list.forEach((c, i) => {
        const on = i === active;
        c.style.transform = reduced ? "" : on ? "scale(1)" : "scale(.99)";
        c.style.opacity = on ? "1" : ".9";
      });
      if (barRef.current) barRef.current.style.width = `${(p * 100).toFixed(1)}%`;
      if (countRef.current) countRef.current.textContent = `${String(active + 1).padStart(2, "0")} / ${String(list.length).padStart(2, "0")}`;
      if (fadeRef.current) fadeRef.current.style.opacity = p > 0.98 ? "0" : "1";
      if (prevRef.current) { prevRef.current.disabled = active === 0; prevRef.current.style.opacity = active === 0 ? ".38" : "1"; }
      if (nextRef.current) { const last = active >= list.length - 1; nextRef.current.disabled = last; nextRef.current.style.opacity = last ? ".38" : "1"; }
    }

    function goToCard(i: number) {
      const vp = viewportRef.current, outer = outerRef.current;
      const list = cards();
      if (!vp || !list.length) return;
      const idx = Math.min(Math.max(i, 0), list.length - 1);
      const behavior: ScrollBehavior = reducedMotion() ? "auto" : "smooth";
      if (pinRef.current && outer) {
        const base = outer.getBoundingClientRect().top + window.scrollY - 64;
        window.scrollTo({ top: base + (idx / (list.length - 1)) * rangeRef.current, behavior });
      } else {
        vp.scrollTo({ left: list[idx].offsetLeft - list[0].offsetLeft, behavior });
      }
    }

    function railStep(dir: number) {
      goToCard((activeRef.current || 0) + dir);
    }

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; updateFlow(); });
    };
    const onRailScroll = () => { if (!pinRef.current) updateFlow(); };
    const onResize = () => layoutFlow();
    const onFlowFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      const card = target.closest?.("[data-flow-card]") as HTMLElement | null;
      if (!card) return;
      const i = cards().indexOf(card);
      if (i >= 0) {
        if (pinRef.current && viewportRef.current) viewportRef.current.scrollLeft = 0;
        goToCard(i);
      }
    };

    const flowTimer = setTimeout(layoutFlow, 420);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("load", layoutFlow);
    const vpEl = viewportRef.current;
    vpEl?.addEventListener("scroll", onRailScroll, { passive: true });
    vpEl?.addEventListener("focusin", onFlowFocus);

    let ro: ResizeObserver | undefined;
    let roTimer: ReturnType<typeof setTimeout> | undefined;
    if (window.ResizeObserver && trackRef.current) {
      ro = new ResizeObserver(() => {
        clearTimeout(roTimer);
        roTimer = setTimeout(layoutFlow, 140);
      });
      ro.observe(trackRef.current);
    }

    const prevBtn = prevRef.current, nextBtn = nextRef.current;
    const onPrev = () => railStep(-1);
    const onNext = () => railStep(1);
    prevBtn?.addEventListener("click", onPrev);
    nextBtn?.addEventListener("click", onNext);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") { e.preventDefault(); railStep(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); railStep(-1); }
    };
    vpEl?.addEventListener("keydown", onKey);

    return () => {
      clearTimeout(flowTimer);
      clearTimeout(roTimer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("load", layoutFlow);
      vpEl?.removeEventListener("scroll", onRailScroll);
      vpEl?.removeEventListener("focusin", onFlowFocus);
      vpEl?.removeEventListener("keydown", onKey);
      prevBtn?.removeEventListener("click", onPrev);
      nextBtn?.removeEventListener("click", onNext);
      ro?.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reducedMotion]);

  return (
    <section ref={outerRef} className={styles.section}>
      <div ref={stickyRef} className={styles.sticky}>
        <div className={styles.headRow}>
          <div className={styles.headText}>
            <span className={styles.eyebrow}>Phóng sự địa phương</span>
            <h2 className={styles.title}>Dòng chảy sinh viên</h2>
            <p className={styles.desc}>
              Sáu câu chuyện từ các địa phương và du học sinh Việt Nam — mỗi nơi một cách sinh viên có mặt trong đời sống cộng đồng.
            </p>
          </div>
          <div className={styles.controls}>
            <span ref={hintRef} className={styles.hint}>Cuộn để khám phá</span>
            <div className={styles.btnRow}>
              <button ref={prevRef} type="button" aria-label="Câu chuyện trước" className={styles.navBtn}>
                <IconArrowLeft size={18} />
              </button>
              <button ref={nextRef} type="button" aria-label="Câu chuyện sau" className={styles.navBtn}>
                <IconArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className={styles.railWrap}>
          <div ref={viewportRef} role="group" aria-label="Danh sách phóng sự địa phương" className={`hsvRail ${styles.viewport}`} tabIndex={0}>
            <div ref={trackRef} className={styles.track}>
              {stories.map((s, i) => (
                <Link key={s.slug} href={s.url} prefetch={false} data-flow-card className={styles.card}>
                  <span className={styles.cardMedia}>
                    <MediaPlaceholder need="Ảnh phóng sự địa phương" />
                    <span className={styles.cardNumber}>{String(i + 1).padStart(2, "0")}</span>
                  </span>
                  <span className={styles.cardBody}>
                    <span className={styles.cardMetaRow}>
                      <span className={styles.cardPlace}>{s.place}</span>
                      <span className={styles.cardDot} />
                      <span className={styles.cardDate}>{formatDateVi(s.publishedAt)}</span>
                    </span>
                    <span className={styles.cardHeadline}>{s.headline}</span>
                    <span className={styles.cardCategory}>{s.category.name}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
          <span ref={fadeRef} className={styles.fade} />
        </div>

        <div className={styles.progressRow}>
          <div className={styles.progressTrack}>
            <div ref={barRef} className={styles.progressBar} />
          </div>
          <span ref={countRef} aria-live="off" className={styles.counter}>01 / 06</span>
        </div>
      </div>
    </section>
  );
}
