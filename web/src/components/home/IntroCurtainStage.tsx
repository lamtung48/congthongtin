"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import styles from "./IntroCurtain.module.css";
import { INTRO_SEEN_CLASS } from "./introCurtainKeys";

const STRIPS = 9;
const CENTER = (STRIPS - 1) / 2;
/** Strip i starts opening at 800 ms + 90 ms per step away from the centre; the outermost ones finish at 800 + 4·90 + 820 = 1980 ms. */
const OPEN_AT_MS = 800;
const STEP_MS = 90;

/**
 * The animated part of `IntroCurtain`. All timing lives in CSS; this only
 * (1) removes the overlay from the DOM once its own "done" animation has
 * finished (or immediately if this load should stay silent), and (2) holds
 * page scroll while it plays so a swipe doesn't move the homepage underneath.
 *
 * "Should this load stay silent" is decided ONCE, by `IntroCurtain.tsx`'s
 * inline script (it owns the load counter — see that file) — this component
 * only ever READS its verdict, via the `INTRO_SEEN_CLASS` it stamps on
 * `<html>` before paint if this load is silent. It never re-reads
 * `sessionStorage` itself, on purpose: two independent places deciding
 * "seen or not" is exactly the kind of split that can quietly disagree.
 */
export function IntroCurtainStage({ className }: { className: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const el = ref.current;
    const root = document.documentElement;
    if (!el || root.classList.contains(INTRO_SEEN_CLASS)) {
      setGone(true);
      return;
    }

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      root.style.overflow = "";
      // Coming back to "/" later in this tab (client-side navigation) renders the curtain again — this class keeps it hidden.
      root.classList.add(INTRO_SEEN_CLASS);
      setGone(true);
    };

    // The overlay's own animation is the clock (it started at first paint, possibly before hydration).
    const done = el.getAnimations?.()[0];
    if (done && done.playState === "finished") {
      finish();
      return;
    }
    root.style.overflow = "hidden";
    const fallback = window.setTimeout(finish, 2800);
    done?.finished.then(finish, finish);
    return () => {
      window.clearTimeout(fallback);
      root.style.overflow = "";
    };
  }, []);

  if (gone) return null;

  return (
    <div ref={ref} className={className} aria-hidden="true" data-intro>
      {Array.from({ length: STRIPS }, (_, i) => (
        <span key={i} className={styles.strip} style={{ "--delay": `${OPEN_AT_MS + Math.abs(i - CENTER) * STEP_MS}ms` } as React.CSSProperties}>
          <span className={styles.top} />
          <span className={styles.bottom} />
        </span>
      ))}
      <span className={styles.logo}>
        <Image src="/images/hsv-logo.png" alt="" width={396} height={396} priority />
      </span>
    </div>
  );
}
