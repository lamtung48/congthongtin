import styles from "./IntroCurtain.module.css";
import { IntroCurtainStage } from "./IntroCurtainStage";
import { INTRO_COUNT_KEY, INTRO_SEEN_CLASS } from "./introCurtainKeys";

/**
 * Homepage opening curtain: a navy screen with the Hội Sinh viên emblem,
 * split into 9 vertical strips whose top and bottom halves meet at the
 * middle of the screen. After ~800 ms the emblem goes and the strips open
 * from the centre outwards (top half up, bottom half down), 0.82 s each with
 * a 90 ms stagger, revealing the already-rendered homepage; at ~2.02 s the
 * overlay is gone.
 *
 * Server-rendered and driven by CSS, so it covers the page from the very
 * first paint (no flash of content before hydration) and still finishes —
 * and stops blocking clicks — if JavaScript never runs. Plays on the 1st
 * load to the homepage in this tab, stays silent for the next 2 (a plain
 * reload included), then plays again on the 4th — and repeats every 3rd
 * load after that (user request 2026-09-22: "cứ 2 lần refresh liên tiếp
 * không chạy thì lần thứ 3 chạy lại", not a strict once-per-session cap).
 * The inline script below is the ONLY place that reads/increments the
 * counter — hiding for a silent load happens before paint, by adding
 * `INTRO_SEEN_CLASS` to `<html>`; `IntroCurtainStage` only ever READS that
 * class, so there is exactly one source of truth and no chance of the two
 * disagreeing. Never shown with `prefers-reduced-motion` (see the CSS).
 */
export function IntroCurtain() {
  return (
    <>
      <script
        // Runs while the HTML is parsed, before the curtain below is painted. CSP allows inline scripts (next.config.ts).
        dangerouslySetInnerHTML={{
          __html: `try{var k=${JSON.stringify(INTRO_COUNT_KEY)},n=(parseInt(sessionStorage.getItem(k),10)||0)+1;sessionStorage.setItem(k,n);if(n%3!==1)document.documentElement.classList.add(${JSON.stringify(INTRO_SEEN_CLASS)})}catch(e){}`,
        }}
      />
      <IntroCurtainStage className={styles.curtain} />
    </>
  );
}
