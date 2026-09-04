# Responsive audit — 1440 / 1280 / 768 / 390 (+ 320)

Full sweep of every homepage section and the four secondary page types,
tested at the four target breakpoints plus a 320px minimum-width check,
using Playwright to load real pages (not devtools scaling) and inspect
actual layout box sizes, not just take screenshots.

## Method

For each of 5 routes (`/`, an article, `/tin-tuc`, `/tim-kiem?q=...`, a
locality page) at 5 widths (1440/1280/768/390/320): loaded the page,
measured `document.documentElement.scrollWidth` vs `window.innerWidth`
for page-level overflow, and for suspect components read the actual
computed box sizes (`getBoundingClientRect`, `getBBox` for SVG text)
rather than trusting a screenshot alone — a screenshot crop turned out
to be misleading in two cases below, so DOM measurement was the
deciding evidence every time a fix was made.

## Bugs found and fixed

### 1. ActivityMap: map overflowed its card below ~1024px (critical)

**Root cause, `VietnamMapSvg.tsx`:** the `ResizeObserver` that's supposed
to measure the map's available width ran once on mount with an empty
dependency array — but at that exact moment the component is still in
its `"loading"` state, rendering a skeleton with no host element to
observe at all (`hostRef.current` was `null`). By the time the real map
mounted (once the async fixture fetch resolved), the effect never
re-ran, so `hostWidth` stayed at its hardcoded default of `640` for
every session, on every viewport, forever.

A second, independent bug compounded it: even fixing the re-run timing
wouldn't have been enough, because `hostRef` was attached to the `.stage`
div — the same element whose `width` is set via inline style computed
*from* `hostWidth`. That's circular: the observer was watching an
element sized by state, not by its parent's actual CSS-constrained
width, so it could never see the container shrink.

Net effect: the SVG always rendered at a fixed 580×620 (the dimensions
`mapDims(640)` produces), regardless of the real card width. On desktop
(card wider than 580) this was invisible — the map just sat centered
with a bit of spare margin, looking intentional. Below ~1024px, where
the card is actually narrower than 580, the map visually overflowed its
own rounded-corner card by up to ~260px (confirmed via
`mapCard.clientWidth: 340` vs `stage width: 580px` at 390px viewport).

**Fix:**
- Moved `ref={hostRef}` to the outer, unstyled wrapper div (which is
  naturally block-level and fills its parent's real width) instead of
  the inline-styled `.stage` div.
- Added `state` to the `ResizeObserver` effect's dependency array so it
  re-attaches once the real map (with the host element) actually mounts,
  instead of only trying once during the loading skeleton.

Verified via DOM measurement across all 5 target widths — `stage`
width now exactly matches the card's real available width at 390/320,
and stays sensibly capped at 580 (existing `maxHeight: 620` design
intent) on wider screens where there's room to spare.

### 2. ActivityMap: archipelago/globe labels overlapped or clipped at 320–390px

A side effect of the map suddenly rendering at its *correct*, much
smaller size on mobile — width and font-size mismatches that were
invisible at the old fixed 580px canvas became visible:

- The "Ngoài nước" globe had a hard 46px radius floor
  (`Math.max(46, W * 0.11)`) tuned for the desktop-size canvas; at a
  true 240–300px mobile canvas that floor dominated the space and
  collided with the Hoàng Sa archipelago label next to it. Lowered the
  floor to 26px — desktop is unaffected (`0.11 * W` already exceeds 26
  well before it exceeds 46), mobile gets a proportionate globe.
- Both archipelago labels and the globe's own label are
  `textAnchor="middle"` SVG `<text>` elements positioned by real
  lon/lat projection — near the right edge of the map on a narrow
  canvas, half the centered text ran past the SVG's own bounds and was
  silently clipped (`.stage svg { overflow: hidden }`). Added a small
  `edgeAnchor()` helper: once a label's anchor point is within a margin
  of an edge, it switches to `start`/`end` anchoring so the text grows
  inward instead of overflowing outward. Applied to all three labels.
- The two-line archipelago labels (name + "administered by" sub-line)
  sit close enough together on a ~240–300px canvas that showing both
  risked the two labels overlapping each other. The sub-line
  ("TP. Đà Nẵng" / "Tỉnh Khánh Hoà") is supplementary — dropped it below
  360px of map width, keeping the sovereignty-assertion name line
  (the legally/editorially load-bearing part) always visible.

Verified with `getBBox()` on every text node at 390 and 320 — all three
labels now stay fully inside `[0, W]` with no overlap.

### 3. Footer: newsletter heading/paragraph wrapped one word per line below 680px (critical)

**Root cause, `Footer.module.css`:** `.nlForm` is a two-column CSS grid
(`grid-template-columns: minmax(0, 1fr) minmax(0, 420px)`) placing the
"Bản tin tuần của Hội" heading + disclaimer text on the left and the
email input + submit button on the right. Every other multi-column grid
on the page (`.cols`/`[data-l="footer"]`, bento, gallery, latest, etc.)
collapses to a single column via the site's centralized breakpoint block
in `globals.css` — but `.nlForm` was never given a `data-l` tag, so it
was never included in that block and stayed two-column forever.

At 390/320px, the right column's own content (an input with
`min-width: 200px` plus a button with `min-width: 120px`) forced that
track to claim ~330px+ of the ~340px available, leaving the left text
column almost no room. The grid's default `minmax(0, 1fr)` sizing then
squeezed the heading and paragraph down to a sliver a few pixels wide —
CSS wrapped every single word onto its own line, turning "Bản tin tuần
của Hội" into five stacked lines and the 150-character disclaimer into
dozens.

**Fix:** tagged the form `data-l="footer-nl"` and added it to the
existing 680px breakpoint rule alongside `footer`/`bento`/`gallery`/
`latest` (`grid-template-columns: minmax(0, 1fr) !important`) — same
threshold the footer's link columns already collapse at, so the
newsletter block and the columns below it become single-column
together. Desktop (1440/1280/768) is untouched — confirmed via
screenshot the two-column layout there is pixel-identical to before.

## What was checked and found already correct

- **Header** — nav mode switches full → compact ("Thêm" overflow menu)
  → drawer at the existing 1400/1120px thresholds; verified the compact
  dropdown renders correctly at 1280px (inside the compact band) and the
  drawer + hamburger at 768/390. Login pill correctly hides only below
  the `mobile` (768px) threshold, matching the `!mobile` guard already
  in the component.
- **Hero** — single column with media reordered above copy below 1024px
  (existing `[data-l="hero"]` rule); no long-headline or overflow issues
  at any width.
- **Featured News** — grid collapses to single column below 1024px;
  card hover/caption CSS unaffected by width.
- **StoryRail** — pinned scroll-jack correctly gated to `≥1024px`
  (`window.innerWidth >= 1024`), native horizontal scroller with
  `scroll-snap-type: x mandatory` below that and on reduced motion — this
  was already exactly the desktop-pinned / mobile-native-swipe split the
  brief asked for. Cards remain readable and don't overflow down to
  320px.
- **Platform Bento** — asymmetric grid (`grid-template-areas`-style
  spans: a large featured card, a 2-span card, three 1-span cards) on
  desktop; collapses to a single column below 680px. Checked the
  5-card mobile stack specifically (an early screenshot appeared to
  truncate it to 3 cards — turned out to be a Playwright
  `locator.screenshot()` artifact on an element taller than the
  viewport, not a real bug; a clip-based screenshot with a tall viewport
  confirmed all 5 cards render in the intended hierarchy: featured
  Hội nghị card (dark) → Đào tạo → Sinh viên 5 tốt (highlighted) →
  Tình nguyện → Dữ liệu (dashed, "sắp ra mắt")).
- **Events rail** — native `overflow-x` rail with `hsvRail` scrollbar
  hiding; filter/counter UI reflows correctly, no overflow at any width.
- **Media Gallery** — CSS Grid with an explicit `aspect-ratio: 4/3` on
  every tile (both the 2-span feature tile and regular tiles), so tile
  boxes are sized before any image loads — no layout shift risk since
  the placeholder box geometry never depends on image dimensions.
  Single column below 680px.
- **Local News / Local page** — stats grid collapses to single column
  below 680px (`[data-l="locality-stats"]`); media grid steps 4→3→2
  columns across the breakpoints; no overflow or text-wrap issues at
  any tested width.
- **Article page — tables** — `ArticleBody.module.css` already wraps
  every table in `.tableWrap { overflow-x: auto }` with the `<table>`
  itself carrying `min-width: 480px`. On a narrow phone this correctly
  produces an internally-scrollable table (visible immediately, scrolls
  to reveal the rest) instead of breaking the page — confirmed no
  page-level overflow at 320px even though the table's own content is
  wider than the viewport.
- **Article page — images/gallery/embed** — `.imageFrame`/`.galleryFrame`/
  `.videoFrame`/`.embedFrameWrap` all use `aspect-ratio` + `overflow:
  hidden` on a `width: 100%` box — none can exceed their column width.
- **News Index / listing pages** — card grids collapse via
  `[data-l="news-grid"]` (3→2→1 across 1024/680px); pagination control
  wraps without overflow at 390/320.
- **Search** — both the header `SearchOverlay` and `/tim-kiem` render
  cleanly at every width; the overlay's placeholder text truncates
  earlier at 320px (a native input-placeholder clip, not a layout bug —
  no element overflows, the "ESC để đóng" hint stays fully visible).
- **Vietnamese diacritics / long text** — long headlines (e.g. "Đại hội
  đại biểu toàn quốc Hội Sinh viên Việt Nam lần thứ XII khai mạc tại Hà
  Nội"), long organization names (e.g. "Hội Sinh viên Việt Nam tại
  Vương quốc Anh" in the overseas panel), and full diacritic marks all
  wrap normally everywhere except the two bugs fixed above.
- **Touch targets** — icon buttons (`.iconBtn`, `.navBtn`, rail
  prev/next) are 44–46px; a programmatic scan of every `button`/`a[href]`
  at 390px found no icon-only control under 40px. The handful of
  sub-40px hits are inline text links (footer nav links, "Mở hồ sơ",
  "Tất cả tin tức") sized to their text content, which is standard and
  acceptable for prose-style navigation rather than primary tap targets.
- **320px minimum width** — no page in the 5 routes × 5 widths matrix
  produced page-level horizontal overflow, including at 320px, after
  the fixes above.

## Verification

`npm run build`, `npx tsc --noEmit`, `npx eslint .` — all clean.
Re-ran the full overflow scan (5 routes × 5 widths) after every fix;
zero page-level horizontal overflow anywhere in the final state.
