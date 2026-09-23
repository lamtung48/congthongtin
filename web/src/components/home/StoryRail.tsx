"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";
import styles from "./StoryRail.module.css";
import { MediaImage } from "@/components/ui/MediaImage";
import { IconArrowLeft, IconArrowRight, IconMapPin } from "@/components/icons";
import type { StoryRailItem } from "@/data-access/types";
import { formatDateVi } from "@/lib/formatDate";

/** Drift speed in CSS pixels per second. Slow enough that a headline stays
 *  readable while it crosses — a ~470px card takes about twelve seconds to
 *  pass — and fast enough that the rail never looks stuck. */
const DRIFT_PX_PER_SEC = 40;

/** After a button press the browser runs its own smooth-scroll animation;
 *  writing `scrollLeft` during it would cancel it mid-way. Drift stays out of
 *  the way for this long, then picks up from wherever the rail landed. */
const NUDGE_PAUSE_MS = 900;

/** Below this many stories the duplicate copy that makes the loop seamless
 *  would be visible as an obvious repeat rather than a continuation. */
const MIN_STORIES_FOR_LOOP = 3;

/**
 * "Dòng chảy sinh viên" — a rail that drifts sideways at a constant speed,
 * the way the section's name suggests, instead of sitting still and jumping
 * one card every few seconds.
 *
 * The loop is seamless rather than a rewind: the cards are rendered twice and
 * the scroll position is folded back by exactly one copy's width the moment
 * it passes it. Because the two copies are identical at that point, the fold
 * is invisible — no snap back to the start, no dead end at the right-hand
 * edge. The clone is `aria-hidden` and its links are removed from the tab
 * order, so assistive technology and keyboard users see each story once.
 *
 * It stays a **native** horizontal scroller underneath, so a trackpad swipe,
 * a touch drag, the arrow keys and the two nav buttons all keep working; the
 * drift simply advances the same `scrollLeft` those do. Motion pauses
 * whenever someone is actually using the rail (pointer over it, focus inside
 * it, mid-drag), while the tab is in the background, and entirely under
 * `prefers-reduced-motion`.
 *
 * It deliberately does NOT hijack vertical scrolling — the section used to
 * pin itself and map page scroll onto the track, which forced it to reserve
 * page height that showed up as a large empty band below the cards.
 */
export function StoryRail({ stories }: { stories: StoryRailItem[] }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const prevRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const pausedRef = useRef(false);
  const nudgeUntilRef = useRef(0);

  const reducedMotion = useCallback(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  const total = stories.length;
  const looping = total >= MIN_STORIES_FOR_LOOP;

  useEffect(() => {
    const vp = viewportRef.current;
    const track = trackRef.current;
    if (!vp || !track) return;

    const cards = () => Array.from(track.children) as HTMLElement[];

    /** Width of exactly one copy of the story list, measured from the DOM so
     *  the flex `gap` between the last real card and the first cloned one is
     *  included. `0` when there is no clone to fold back to. */
    function loopWidth(): number {
      const list = cards();
      if (!looping || list.length < total * 2) return 0;
      return list[total].offsetLeft - list[0].offsetLeft;
    }

    /** Index of the card nearest the viewport's centre, mapped back onto the
     *  real list so the counter never reads "13 / 09" inside the clone. */
    function activeIndex(): number {
      const list = cards();
      if (!list.length) return 0;
      const mid = vp!.getBoundingClientRect().left + vp!.clientWidth / 2;
      let best = 0;
      let bestD = Infinity;
      list.forEach((c, i) => {
        const r = c.getBoundingClientRect();
        const d = Math.abs(r.left + r.width / 2 - mid);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      return best % total;
    }

    function render() {
      const active = activeIndex();
      if (countRef.current) {
        countRef.current.textContent = `${String(active + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
      }
      if (barRef.current) {
        // Position within one lap rather than "how far to the end" — with a
        // seamless loop there is no end to be a fraction of.
        const lap = loopWidth();
        const max = lap || vp!.scrollWidth - vp!.clientWidth;
        const p = max > 0 ? (vp!.scrollLeft % max) / max : 0;
        barRef.current.style.width = `${(p * 100).toFixed(1)}%`;
      }
    }

    /** Folds the position back by one copy once it has passed it. Identical
     *  pixels either side, so nothing visible happens. */
    function foldIfNeeded() {
      const lap = loopWidth();
      if (lap <= 0) return;
      if (vp!.scrollLeft >= lap) vp!.scrollLeft -= lap;
      else if (vp!.scrollLeft < 0) vp!.scrollLeft += lap;
    }

    // --- constant-speed drift ----------------------------------------
    // `scrollLeft` reads back rounded in several browsers, so sub-pixel
    // movement would be lost every frame and the rail would never advance at
    // this speed. `carry` keeps the fraction between frames.
    let carry = 0;
    let last = 0;
    let raf = 0;

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(now - last, 100) : 0; // clamp: tab wake-ups
      last = now;
      if (dt <= 0) return;
      if (pausedRef.current || now < nudgeUntilRef.current) return;
      if (document.visibilityState !== "visible" || reducedMotion()) return;
      if (vp!.scrollWidth <= vp!.clientWidth) return;

      const move = (DRIFT_PX_PER_SEC * dt) / 1000 + carry;
      const px = Math.floor(move);
      carry = move - px;
      if (px > 0) {
        vp!.scrollLeft += px;
        foldIfNeeded();
      }
    }

    // --- manual controls ----------------------------------------------
    /** One card further along, using the browser's own smooth scroll; drift
     *  steps aside for the duration so the two don't fight. */
    function nudge(dir: number) {
      const list = cards();
      if (list.length < 2) return;
      const stepPx = list[1].offsetLeft - list[0].offsetLeft;
      nudgeUntilRef.current = performance.now() + NUDGE_PAUSE_MS;
      vp!.scrollBy({ left: dir * stepPx, behavior: reducedMotion() ? "auto" : "smooth" });
    }

    let scrollRaf = 0;
    const onScroll = () => {
      // A manual drag can also cross the fold point.
      foldIfNeeded();
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(() => {
        scrollRaf = 0;
        render();
      });
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        nudge(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        nudge(-1);
      }
    };

    const pause = () => {
      pausedRef.current = true;
    };
    const resume = () => {
      pausedRef.current = false;
    };
    const onPrev = () => nudge(-1);
    const onNext = () => nudge(1);

    const prevBtn = prevRef.current;
    const nextBtn = nextRef.current;

    vp.addEventListener("scroll", onScroll, { passive: true });
    vp.addEventListener("keydown", onKey);
    vp.addEventListener("pointerenter", pause);
    vp.addEventListener("pointerleave", resume);
    vp.addEventListener("pointerdown", pause);
    vp.addEventListener("focusin", pause);
    vp.addEventListener("focusout", resume);
    prevBtn?.addEventListener("click", onPrev);
    nextBtn?.addEventListener("click", onNext);
    window.addEventListener("resize", onScroll);

    render();
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      if (scrollRaf) cancelAnimationFrame(scrollRaf);
      vp.removeEventListener("scroll", onScroll);
      vp.removeEventListener("keydown", onKey);
      vp.removeEventListener("pointerenter", pause);
      vp.removeEventListener("pointerleave", resume);
      vp.removeEventListener("pointerdown", pause);
      vp.removeEventListener("focusin", pause);
      vp.removeEventListener("focusout", resume);
      prevBtn?.removeEventListener("click", onPrev);
      nextBtn?.removeEventListener("click", onNext);
      window.removeEventListener("resize", onScroll);
    };
  }, [reducedMotion, total, looping]);

  function card(s: StoryRailItem, i: number, clone: boolean) {
    return (
      <Link
        key={clone ? `${s.slug}-clone` : s.slug}
        href={s.url}
        data-flow-card
        className={styles.card}
        {...(clone ? { tabIndex: -1, "aria-hidden": true } : {})}
      >
        {/* Inner layer: the scroll-driven "focus" scale lives here, the hover lift on the link. */}
        <span className={styles.cardInner}>
          <span className={styles.cardMedia}>
            <MediaImage media={s.media} sizes="(max-width: 700px) 76vw, 340px" />
          </span>
          <span aria-hidden className={styles.cardShade} />
          <span className={styles.cardTop}>
            <span className={styles.cardPlace}>
              <IconMapPin size={12} />
              <span>{s.place}</span>
            </span>
            <span className={styles.cardNumber}>{String(i + 1).padStart(2, "0")}</span>
          </span>
          <span className={styles.cardBottom}>
            <span className={styles.cardCategory}>{s.category.name}</span>
            <span className={styles.cardHeadline}>{s.headline}</span>
            <span className={styles.cardFoot}>
              <span className={styles.cardDate}>{formatDateVi(s.publishedAt)}</span>
              <span className={styles.cardGo} aria-hidden>
                <IconArrowRight size={14} />
              </span>
            </span>
          </span>
        </span>
      </Link>
    );
  }

  return (
    <section aria-labelledby="storyrail-title" className={styles.section}>
      {/* The section's name, literally: slow waves drifting across the back. */}
      <svg aria-hidden className={styles.waves} viewBox="0 0 1440 320" preserveAspectRatio="none">
        <g className={styles.waveSlow}>
          <path d={wave(170, 60, 360)} className={styles.waveBlue} />
          <path d={wave(205, 40, 480)} className={styles.waveBlueSoft} />
        </g>
        <g className={styles.waveFast}>
          <path d={wave(236, 30, 288)} className={styles.waveGold} />
        </g>
      </svg>

      <div aria-hidden className={styles.marquee}>
        <div className={styles.marqueeTrack}>
          {[0, 1].map((k) => (
            <span key={k} className={styles.marqueeText}>
              Dòng chảy sinh viên <i>✦</i> Khắp mọi miền <i>✦</i> Dòng chảy sinh viên <i>✦</i> Khắp mọi miền <i>✦</i>&nbsp;
            </span>
          ))}
        </div>
      </div>

      <div className={styles.inner}>
        <div className={styles.headRow}>
          <div className={styles.headText}>
            <span className={styles.eyebrow}>Câu chuyện · Khắp mọi miền</span>
            <h2 id="storyrail-title" className={styles.title}>
              Dòng chảy <span className={styles.titleGlow}>sinh viên</span>
            </h2>
            <p className={styles.desc}>
              Những câu chuyện từ các địa phương và du học sinh Việt Nam — mỗi nơi một cách sinh viên có mặt trong đời sống cộng đồng.
            </p>
          </div>
          <div className={styles.controls}>
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
              {stories.map((s, i) => card(s, i, false))}
              {looping && stories.map((s, i) => card(s, i, true))}
            </div>
          </div>
          <span className={styles.fadeLeft} />
          <span className={styles.fade} />
        </div>

        <div className={styles.progressRow}>
          <div className={styles.progressTrack}>
            <div ref={barRef} className={styles.progressBar} />
          </div>
          <span ref={countRef} aria-live="off" className={styles.counter}>
            01 / {String(total).padStart(2, "0")}
          </span>
        </div>
      </div>
    </section>
  );
}

/** A horizontal sine wave two viewBox-widths long (0–2880 in a 1440-wide
 *  viewBox). Every period used divides 1440, so the CSS animation's shift by
 *  exactly one viewBox width lands on an identical shape — a seamless loop.
 *  The fade at both ends is a mask on the (static) `<svg>`, not a gradient on
 *  the moving stroke, which would jump at the loop point. */
function wave(y: number, amp: number, period: number): string {
  let d = `M0 ${y}`;
  for (let x = 0; x < 2880; x += period) {
    d += ` q ${period / 4} ${-amp} ${period / 2} 0 t ${period / 2} 0`;
  }
  return d;
}
