# Motion/scroll audit

Full sweep of every scroll and hover interaction on the homepage. Goal
per the brief: keep the site feeling modern without jank, lag, or motion
overload — **not** a redesign, and **not** a mechanical migration to
GSAP. GSAP was already removed from the project in an earlier cleanup
pass (`docs/AUDIT` history) and stays removed: nothing here needed it.

For every area: what runs it today, whether that's the right tool, and
what changed.

## Method used per area

| Area | Mechanism | Verdict |
|---|---|---|
| Header scroll state | plain `scroll` listener + `setState` | **kept** |
| Hero motion | rAF-throttled `scroll` listener | **kept** |
| Featured News hover | CSS `:hover` transition | **kept** |
| StoryRail | custom scroll-jack (rAF) + native fallback | **kept, 2 listeners fixed** |
| Video hover | CSS `:hover` transition | **kept** |
| ActivityMap interaction | `ResizeObserver` (debounced) + CSS | **kept** |
| Platform Bento hover | CSS `:hover` transition | **kept** |
| Event rail | native `scrollBy`/`scrollTo` + scroll listener | **kept, listeners fixed** |
| Gallery/lightbox | React state + CSS transition | **kept** |
| Shared page/image transition | View Transition API + CSS fallback | **kept** |
| `useViewport` (shared by Header + ActivityMap) | plain `resize` listener | **fixed (debounced)** |

No GSAP was added. No area needed it — every interaction here is
either a hover/opacity/transform the browser already accelerates, or a
scroll-position readout that a debounce/rAF gate handles for free.

## 1. Header scroll state (`Header.tsx`)

```ts
const onScroll = () => setCompact(window.scrollY > 96);
window.addEventListener("scroll", onScroll, { passive: true });
```

**Kept as-is.** `window.scrollY` is a property read the browser already
tracks — no forced layout. `setCompact(true)` called repeatedly while
already `true` is a no-op re-render (React bails out on an unchanged
primitive). The CSS side (`.bar` → `.bar.compact`) is a token-driven
`transition: height, box-shadow, background` — already reduced-motion-safe
via the global `--dur-*` collapse. Wrapping this one in `requestAnimationFrame`
would add code for no measurable benefit, so it stays.

## 2. Hero motion (`Hero.tsx`)

```ts
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (reduced) return; // no listener at all
let raf = 0;
const onScroll = () => {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    const shift = Math.min(window.scrollY * 0.09, 32);
    el.style.transform = `translate3d(0,${shift.toFixed(1)}px,0)`;
  });
};
```

**Kept as-is.** Already exactly the shape this audit would have asked
for: rAF-throttled, passive listener, capped magnitude (max 32px), no
listener attached at all under reduced motion, proper cleanup
(`removeEventListener` + `cancelAnimationFrame`). Nothing to change.

## 3. Featured News hover (`FeaturedNews.module.css`)

```css
.mainMediaInner { transition: transform var(--dur-slow) var(--ease-standard); }
.main:hover .mainMediaInner { transform: scale(1.025); }
```

**Kept as-is.** Pure CSS, `transform`-only (compositor-accelerated, no
layout/paint), token-driven duration/easing so reduced-motion collapses
it to 1ms automatically. This is the right tool for a hover scale — a
JS library would be strictly worse here.

## 4. StoryRail — the deep-dive item

`StoryRail.tsx` implements a sticky-pin scroll-jack on desktop
(≥1024px) that maps vertical scroll onto horizontal `translateX`, and
falls back to a plain native horizontal scroller with `scroll-snap`
everywhere else (mobile, tablet, or reduced motion).

Evaluated against all six criteria from the brief:

- **Frame rate.** The desktop scroll-jack path (`window` `scroll` →
  `updateFlow()`) was already rAF-throttled — one measure+write per
  frame, `translate3d` only. **Fine as shipped.**
- **Event listeners.** Found two that were *not* throttled:
  `viewport.addEventListener("scroll", onRailScroll)` (fires on every
  native-scroll tick during mobile/tablet touch momentum — dozens of
  times per gesture) and `window.addEventListener("resize", onResize)`
  (fires continuously during a window drag-resize). Both called
  `updateFlow()`/`layoutFlow()` directly, and `updateFlow()` runs
  `getBoundingClientRect()` on every card to find the centered one —
  exactly the layout-thrashing pattern the brief asked to check for.
  **Fixed:** `onRailScroll` now goes through the same rAF gate the
  window-scroll handler already uses; `onResize` is now debounced
  140ms, matching the `ResizeObserver` debounce already present two
  lines below it in the same file (`layoutFlow` on track resize).
- **Resize.** The `ResizeObserver` on the track (debounced 140ms) was
  already correct — untouched. The window `resize` listener (layout
  mode recompute — sticky vs. native) was not debounced; now is.
- **Mobile.** Pin is explicitly gated to `window.innerWidth >= 1024` —
  mobile always gets the plain native scroller with `scroll-snap-type:
  x mandatory`, never the scroll-jack. Correct, unchanged.
- **Touch.** Native `overflow-x: auto` + snap on mobile means the
  browser's own touch/momentum scrolling handles it — no synthetic
  touch handlers to fight it. Correct, unchanged.
- **Reduced motion.** `pin = innerWidth >= 1024 && !reducedMotion() &&
  travel > 120` — reduced motion alone is enough to fully disable the
  scroll-jack and drop to the native scroller, independent of viewport
  width. This is the single biggest win in the file and was already
  correct.
- **Memory cleanup.** Every listener, the `ResizeObserver`, both
  `setTimeout`s, and the rAF handle were already cleaned up in the
  effect's return. The new `railRaf` handle and `resizeTimer` are
  cleaned up the same way.

**Verdict: no GSAP migration.** The existing implementation already
satisfies every criterion in the brief once the two unthrottled
listeners are fixed. A ScrollTrigger rewrite would trade ~160 lines of
working, already-optimized, well-guarded code (plus a new npm
dependency) for the same visual result — that's not a "clear benefit,"
it's churn.

## 5. Video hover (`MediaVideo.module.css`)

```css
.playBtn { transition: transform var(--dur-base) var(--ease-standard); }
.playBtn:hover { transform: translate(-50%, -50%) scale(1.06); }
```

**Kept as-is.** Same reasoning as Featured News — CSS transform scale,
no JS involved, reduced-motion-safe via the shared duration tokens.

## 6. ActivityMap interaction (`VietnamMapSvg.tsx`, `ActivityMapSection.tsx`)

- Host-width tracking uses `ResizeObserver`, debounced 140ms — the
  right tool, no listener duplication with `useViewport`. Unchanged.
- Tooltip/panel positioning is hover/focus-driven (`:hover`,
  `:focus-visible`), CSS `opacity`/`transform: translateY(4px)` with a
  140ms transition — no continuous loop, no WebGL, no per-frame work.
- Mobile bottom sheet (`ActivityMapSection.module.css` `.sheet`) enters
  via a single CSS `animation: hsvRise ... both` keyframe — no JS
  animation driver.
- No particles, no 3D, nothing continuously running. **Kept as-is.**

## 7. Platform Bento hover (`EcosystemBento.module.css`)

```css
.card:hover { transform: translateY(var(--hover-lift)); box-shadow: var(--shadow-md); }
```

**Kept as-is.** A subtle lift + shadow, not a tilt — `--hover-lift`
collapses to `0px` under reduced motion. This is deliberately *not* a
3D tilt effect, which the brief explicitly asked to avoid; nothing
here needed changing in that direction.

## 8. Event rail (`LiveEvents.tsx`)

Same class of issue as StoryRail: `updateRail()` (scroll-position +
`getBoundingClientRect()` on every `[data-event-card]`, to compute the
visible-card counter and prev/next disabled state) was bound directly,
unthrottled, to both `scroll` and `resize`.

**Fixed:** `scroll` now goes through an rAF gate, `resize` is now
debounced 140ms — the same pattern applied to StoryRail above, for the
same reason (native rail scroll during touch fires far more often than
once per frame). `scrollBy`/`scrollTo` navigation was already correctly
gated on `prefers-reduced-motion` (`behavior: reduced ? "auto" :
"smooth"`) and is untouched.

## 9. Gallery/lightbox (`Gallery.tsx`)

State-driven open/close, a 380ms `setTimeout` for a brief loading
spinner between images (properly `clearTimeout`'d on every step/close),
manual Tab focus-trap, `Escape`/arrow-key handling, scroll-lock via
`document.body.style.overflow`. All CSS transitions for hover/caption
reveal. No rAF, no animation library, nothing continuously running.
**Kept as-is** — this is exactly the right weight for a lightbox.

## 10. Shared page/image transition (`viewTransition.ts`,
`useArticleTransitionClick.ts`)

`document.startViewTransition` for the Hero/Featured-News cover →
article-hero morph, with a CSS opacity+scale fallback
(`hsvMediaIn`) for browsers without support, and the default
full-page root cross-fade suppressed so only the named element
morphs. Native browser API, not JS-animated, already reduced-motion-
aware (the API itself no-ops the transition under reduced motion in
supporting browsers, and the fallback keyframe collapses to 1ms via
the global token rule). **Kept as-is.**

## 11. `useViewport` — the one shared bug

Used by `Header` and `ActivityMapSection` to derive layout mode
(`navMode`, `narrow`, `mobile`). Its `resize` listener called
`setState(compute())` directly on every resize tick; `compute()`
returns a new object literal every call, so React couldn't bail out on
an unchanged value the way it does for Header's boolean `compact`
state — every tick of a window drag-resize re-rendered every consumer.

**Fixed:** the same 120ms debounce pattern used everywhere else in the
codebase for resize (`StoryRail`'s `ResizeObserver`, `VietnamMapSvg`'s
`ResizeObserver`). Final settled state after a resize is unchanged;
only the update cadence during an active drag is smoothed.

## prefers-reduced-motion coverage — verified, not assumed

- **Global fallback** (`globals.css`): all `--dur-*` tokens collapse to
  `1ms`, `--stagger` to `0ms`, `--hover-lift`/`--press-scale` neutralized
  — covers every CSS-token-driven transition/animation across the site
  (Header compact bar, all hover lifts/scales, shimmer skeletons stay
  functionally instant, `[data-reveal]` forced to its final state with
  `!important`).
- **JS-driven motion**, checked individually — each already guards itself,
  none relied on the CSS collapse alone:
  - Hero: `matchMedia("(prefers-reduced-motion: reduce)")` early-return,
    no scroll listener attached at all.
  - StoryRail: reduced motion is one of the three conditions gating the
    scroll-jack; also disables the per-card `scale(.99)` micro-transform
    in `updateFlow()`.
  - LiveEvents / StoryRail / Header navigation: `scrollBy`/`scrollTo`
    calls pass `behavior: reduced ? "auto" : "smooth"`.
  - `useReveal`: reduced motion skips arming the element entirely — it's
    simply visible, IntersectionObserver never attaches.
- No area in this audit was found relying on `prefers-reduced-motion`
  without an actual code path honoring it.

## Explicitly confirmed absent

Strong bounce/elastic easing, 3D tilt, WebGL, particles, or any
animation looping with no end state and no purpose. The only two
`infinite` CSS animations on the site are a live-status pulse dot
(`hsvPulse`, ~2s, communicates real "this is live" state) and loading
shimmers (`hsvShimmer`, only rendered while content is actually
loading) — both purposeful, both bounded to a real state, neither is
decorative motion running for its own sake.

## Verification

`npm run build`, `npx tsc --noEmit`, `npx eslint .` — all clean after
the changes above.
