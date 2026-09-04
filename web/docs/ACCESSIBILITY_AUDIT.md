# Accessibility audit

Method: automated scanning with `axe-core` (WCAG 2 A/AA + best-practice
rules) against 10 route types — home, article, news index, category,
topic, search, locality, unit, event, video index — plus live keyboard
interaction tests with Playwright for every dialog/drawer/lightbox/modal
and the ActivityMap. Automated scanning catches structural and contrast
issues; it cannot verify screen-reader announcement quality, so that's
called out explicitly below as manual-test territory.

## Fixed

### Landmarks & semantic structure

- **No `<main>` landmark anywhere on the site.** `RootLayout`
  (`src/app/layout.tsx`) rendered `<Header/>{children}<Footer/>` with no
  wrapping landmark, so every single page failed `landmark-one-main` and
  most of their content failed `region` ("content must be contained by a
  landmark"). Fixed by wrapping `{children}` in `<main>` — this one change
  cleared the `landmark-one-main`/`region` violations across every route.
- **Article page had two `<header>` (banner) and two `<footer>`
  (contentinfo) landmarks.** `/tin-tuc/[slug]` wrapped its content in a
  plain `<div>`, so its own title-block `<header>` and blockquote-citation
  `<footer>` (a legitimate HTML5 pattern on its own) weren't scoped inside
  any sectioning element and were promoted to page-level banner/contentinfo
  landmarks — colliding with the real site `Header`/`Footer`. Fixed by
  changing the wrapper to `<article>`, which is also the more correct tag
  for what it is; both nested elements now correctly scope to the article
  instead of leaking to the page.
- **Hero and Featured News shared the identical `aria-label="Tin tiêu
  điểm"`**, so two `<section>` "region" landmarks collided
  (`landmark-unique`). Hero now uses `aria-labelledby` pointing at its own
  `<h1>` (the actual headline), which is both more correct and can never
  collide with another section's label. Added the same `aria-labelledby`
  pattern to StoryRail's previously-unlabelled `<section>` (its own visible
  `<h2>`) — an unnamed `<section>` isn't exposed as a landmark at all,
  which was why axe flagged StoryRail's content as "not contained by a
  landmark" even though it visually sits inside one.

### Heading hierarchy

- ActivityMap's country-tooltip and overseas-panel headings were `<h4>`
  directly under the section's `<h2>`, skipping `<h3>`. Changed both to
  `<h3>`.
- `/chu-de/[slug]` (topic) and `/video` render a card grid directly under
  the page's `<h1>` with no heading in between, jumping to `<h3>`
  (`NewsCard`'s title level). Every other listing page (news index,
  category) has a `FeaturedNewsCard` — `<h2>` — before the grid, so they
  were already fine; these two weren't. Added a screen-reader-only `<h2>`
  ("Danh sách bài viết" / "Danh sách video") before each grid — no visible
  change, just a real heading for anyone navigating by heading level. New
  `.srOnly` utility in `globals.css` for this.

### Search: incorrect ARIA on `/tim-kiem` (critical)

`SearchResultRow` always rendered `role="option"`/`aria-selected`,
correct only inside the header overlay's `role="listbox"` combobox. On
`/tim-kiem` — a plain page of results, not a combobox — the same rows
sat inside a `<div role="list">`, which is an invalid ARIA parent/child
pair on both ends (`aria-required-children`/`aria-required-parent`,
both **critical** severity): a screen reader has no correct way to
announce an "option" with no "listbox" ancestor. Fixed the actual root
cause per the brief's own rule ("không thêm ARIA nếu semantic HTML gốc
đã đủ"):
- `SearchResultRow` now takes an explicit `asOption` prop; only
  `SearchOverlay` passes it. `/tim-kiem`'s rows are plain `<a>` links —
  no ARIA needed at all.
- `/tim-kiem`'s results wrapper changed from `<div role="list">` to a
  real `<ul>`/`<li>` — native list semantics instead of an ARIA
  role doing the same job worse.

### Modal / dialog / drawer — focus trap, Escape, focus return

Audited all five dialog-like surfaces against the WAI-ARIA APG modal
pattern (Tab-trap, Escape closes, focus moves in on open and back to the
trigger on close):

| Surface | Before | After |
|---|---|---|
| Gallery lightbox | ✅ already correct | unchanged |
| Search overlay | ✅ already correct | unchanged |
| Header mobile drawer | `aria-modal` present; **no focus trap, no initial focus, no return-to-trigger** — Escape closed it but the browser's default Tab order just walked out into the page or off toward the header buttons | fixed |
| Video player modal | `role="dialog"`, Escape only — **no `aria-modal`, no trap, no return-to-trigger** | fixed |
| ActivityMap mobile bottom sheet | `role="dialog"` with **zero keyboard handling of any kind** — no Escape, no trap, no focus management | fixed |

New shared hook, `src/lib/hooks/useModalDialog.ts` (Tab-trap + Escape +
capture/restore focus), used by the three previously-broken surfaces —
Gallery and SearchOverlay already have their own correct inline
implementations and were left as-is (no reason to touch working code).
Verified live with Playwright keyboard simulation for all five — see the
table's "after" column, each one now: moves focus to its close control on
open, wraps Tab at both ends, closes on Escape, and returns focus to
whatever was focused before it opened.

### ActivityMap

The province-accessible-label and no-hover-dependency requirements from
the brief were **already met** by the existing implementation — verified,
not changed: every province is `role="button" tabIndex={0}
aria-label={...}` computed unconditionally from data (not from hover
state), `aria-pressed` reflects selection, `onFocus`/`onBlur` mirror
`onMouseEnter`/`onMouseLeave` so keyboard focus shows the same tooltip a
mouse hover would, and `Enter`/`Space` select a province exactly like a
click. The one real gap was the bottom sheet dialog behavior above, now
fixed.

### Focus-visible

Three text inputs had `outline: none` with **no replacement focus
indicator at all** — a keyboard (or mouse) user tabbing/clicking into
them got zero visual confirmation of focus: the Footer newsletter email
field, the ActivityMap locality-search field, and the Search overlay's
input. Added `:focus-visible`/`:focus-within` border-color treatment to
each (matching the pattern `/tim-kiem`'s own search field already used).
The ActivityMap's SVG province/globe controls also set `outline: none`,
but that one is intentional and already paired with a purpose-built
`:focus-visible` SVG ring (`circle.ring` with `stroke: var(--focus-ring)`)
— a real focus indicator, just not the browser's default one (which
renders poorly on non-rectangular SVG shapes). Left as-is.

### Color contrast (32–36 failing nodes per page, 7 distinct causes)

All at least 4.5:1 now:

- **`rgba(255,255,255,.42)` on the footer's dark navy** (`.colLinkSoon`,
  `.socialNote`, `.policySoon` — 85 of the ~120 total failing nodes site-
  wide) → raised to `.58`.
- **`--text-faint` (aliased to `--ink-400`, 2.95:1 on white)** used across
  `SearchResultRow`, `Pagination`, `ArticleMeta`, the locality page, and
  several ActivityMap panels — all on light surfaces. `--ink-400` itself
  is also used directly (not through the alias) on several *dark*
  surfaces (Footer, EcosystemBento's featured card, Gallery's lightbox,
  StoryRail, VideoSection) where it already passes comfortably (6.1:1
  against navy) — so instead of touching the shared base token, gave
  `--text-faint` its own value (`#6b7686`, ~4.6:1 on white) independent of
  `--ink-400`. Every light-surface usage got the fix; every dark-surface
  usage is untouched.
- **LiveEvents' completed-event cards applied `opacity: .72` to the whole
  card.** The text colors chosen for that state (`--text-muted`) already
  pass 5:1 on their own — the extra opacity blended them toward the white
  page background and silently dropped them below 4.5:1. Since the muted
  *color* already signals "de-emphasized," the opacity was redundant and
  actively harmful; removed it (`op: "1"`).
- **LocalNews' active-filter count** had the same problem in miniature
  (`opacity: .7` on an otherwise-compliant `--text-brand`) — removed.

### False positive — verified, not "fixed"

axe flagged `StoryRail`'s card place/date/category text as failing
contrast against a reported `#ffffff` background. Verified via
`getComputedStyle` walk up the real DOM: the actual ancestor
(`.section`) has `background: var(--ink-1000)` (near-black), and the
light-colored text (`--blue-300`/`--ink-300`) passes comfortably against
it — confirmed visually in earlier screenshots too. This is a known class
of axe-core false positive: the rail's `.card` element carries a
JS-driven `transform: matrix(...)` (the "de-emphasize non-centered
cards" effect from the motion audit), and axe's background-detection
walk doesn't always resolve correctly through a transformed ancestor.
No code change; noted here so it isn't "rediscovered" and re-"fixed"
incorrectly later.

## Already correct (checked, not touched)

- **Semantic HTML**: `Breadcrumb` (`<nav aria-label><ol><li>`,
  `aria-current="page"`), `Pagination` (`<nav aria-label>`), article
  tables (`<th scope="col">` inside a `.tableWrap { overflow-x: auto }`
  so a wide table scrolls within its own box instead of breaking the
  page — confirmed this is real horizontal-scroll behavior, not a
  content-loss bug), embeds (`<iframe title={...}>`).
- **Forms**: Footer newsletter (`<label htmlFor>` correctly tied to the
  input, live-region error/status text via `aria-describedby`), both
  search inputs (visible labels or `aria-label`, `role="combobox"` +
  `aria-expanded`/`aria-controls`/`aria-activedescendant` on the overlay
  only where a real combobox exists).
- **Alt text**: `MediaImage` always renders `alt={media.alt ?? ""}` —
  never omits the attribute — falling back to `MediaPlaceholder` (not an
  `<img>`) whenever a real asset isn't resolvable yet, which today is
  every asset in the fixtures (see `docs/MEDIA_ARCHITECTURE.md`).
- **Reduced motion**: covered exhaustively in the prior motion audit
  (`docs/MOTION_AUDIT.md`) — global token collapse plus per-component JS
  guards where needed; nothing new surfaced here.
- **StoryRail keyboard access**: confirmed live — cards are real `<Link>`
  elements in natural tab order, reachable by Tab regardless of the
  desktop scroll-jack/pin mechanism; arrow-key stepping and the pin
  itself are supplementary, never the only way in.

## Left as-is / needs a manual call

- **ActivityMap's mobile bottom sheet doesn't lock background scroll**
  while open (Gallery and the video modal both do via
  `document.body.style.overflow`). Not a violation of anything in the
  automated scan or the brief's explicit list, but worth a product
  decision: a bottom sheet conventionally blocks background scroll while
  open. Didn't add it speculatively since get­ting the "unintentional
  scroll lock" question wrong in the other direction was explicitly
  something to avoid.
- **Video captions/transcripts**: `MediaVideo`/the article's embed block
  have no caption-track wiring, but there is no real video source in the
  fixtures yet (`provider: "local-placeholder"` throughout, matching the
  responsive/motion audits' findings) — nothing to caption today. Needs
  a decision when real YouTube/Drive video sources are connected: a
  YouTube embed gets creator-provided captions for free; a self-hosted
  `<video>` will need `<track kind="captions">` wired in explicitly.

## Components needing manual screen-reader testing

Automated tools can't verify announcement quality or timing — these are
the highest-value spots for a manual pass with VoiceOver/NVDA:

1. **SearchOverlay** — the debounced async search (350ms) plus
   `aria-live="polite"` results region: confirm results are announced
   without spamming on every keystroke, and that the loading→results
   transition reads sensibly.
2. **ActivityMap** — hover/focus tooltip content and the overseas globe
   panel: confirm the province `aria-label` (name + activity count) reads
   naturally, and that opening the globe panel doesn't strand focus
   (`gpanelRef`'s outside-click/Escape handling) in a screen-reader
   context, not just visually.
3. **StoryRail** — the pinned desktop scroll-jack: confirm a screen
   reader navigating linearly through the page doesn't get a confusing
   read-order during the pin (visual position and DOM order can diverge
   briefly while `translate3d` animates).
4. **The three now-fixed modals** (drawer, video player, ActivityMap
   sheet) — trap/Escape/return-focus are verified mechanically; a
   listening pass confirms the dialog's *name* and *opening announcement*
   are also right, not just the focus mechanics.
5. **Gallery lightbox image-loading state** — the 380ms spinner phase
   between images: confirm `aria-live="polite"` on "Đang tải ảnh…" doesn't
   double-announce on rapid arrow-key stepping.

## Verification

`npm run build`, `npx tsc --noEmit`, `npx eslint .` — all clean.
`axe-core` re-run after every fix across 10 route types: 0 violations
except the one documented false positive above.
