# Homepage Hero — Editorial Image Canvas

The image is a full-bleed canvas; the copy sits in its negative space over a
directional gradient. No two-column split, no framed image, no vertical
divider. Up to four slides, manually advanced (never auto-rotating).

## Data flow

`homepageService.resolveHomepage()` → `heroSlides`: the CMS-pinned `HERO`
`HomepagePlacement`s (in order, max 4) if any exist, otherwise the 4
most-recent published articles. `DatabaseProvider.getHomepage` /
`FixtureProvider.getHomepage` map each to a `HeroSlide` (`domain/homepage.ts`)
via `buildHeroSlide` (`lib/view/heroSlide.ts`), which fills every visual
knob from safe auto-defaults unless the article's `heroConfig` JSON
overrides it.

### `Article.heroConfig` (JSON, nullable)

Per-article Hero overrides. `null` (today's state for every article) → the
slide renders from `buildHeroSlide`'s defaults. Shape:

| key | type | default |
|---|---|---|
| `focalDesktop` | `{ x, y }` 0–100 (% → `object-position`) | `{ 50, 42 }` (`32` for portrait sources) |
| `focalMobile` | `{ x, y }` | desktop x, `y − 8` |
| `overlay` | `"soft" \| "medium" \| "strong"` | `"medium"` |
| `theme` | `"light" \| "dark"` | `"dark"` |
| `caption` | string | `media.metadata.locationLabel` |
| `titleAccent` | string (one phrase inside the title, highlighted) | — |
| `text` | `{ x, y, w, scale }` — desktop text-block placement: `x`/`w` = % of container inner width, `y` = % of Hero height (block top), `scale` = title size multiplier (also applies on mobile) | `{ 1, 26, 47, 1 }` |

The Hero editor (`HeroPanel.tsx`) sets `text` by dragging the "Khối chữ"
ghost in the preview (move = `x`/`y`, right-edge handle = `w`) plus a "Cỡ
chữ tiêu đề" slider (`scale`). `Hero.tsx` maps them to `--tx/--ty/--tw/--tscale`
CSS vars on `.canvas`; the title font-size is `calc(<length-tier clamp> * var(--tscale))`.

Nothing writes `heroConfig` yet — the visual editor (focal-point / crop /
text-safe-area preview per breakpoint) is Phase 2.

## Component (`components/home/Hero.tsx`)

- Full-bleed `<img object-fit:cover>` per slide, all layers mounted so a
  change crossfades. `object-position` from per-slide CSS vars
  (`--fx-d/--fy-d` desktop, `--fx-m/--fy-m` mobile) — never one hard-coded
  value.
- Directional scrim: navy→transparent left→right (`--scrim` strength from
  `data-overlay`), plus a bottom gradient. A canvas luminance probe of the
  text-safe box bumps `data-contrast="boost"` when the copy would sit on a
  bright area.
- Copy: kicker, title (`clamp(44px,5.1vw,72px)`, ≤3 lines, one accent
  phrase), summary (≤2 lines), meta + CTA, then the carousel controls
  (counter, progress ticks, prev/next). A thin baseline links the metadata
  (left) to the caption (bottom-right).
- Change choreography: copy fade-out + −8px (180ms) → swap → copy fade-up
  ~18px (460–520ms); image crossfade ~780ms + scale 1.022→1; height fixed;
  no horizontal slide; controls disabled ~820ms; next + next-after images
  preloaded.
- Load: image scale 1.035→1 + fade (~820ms), staggered copy (≤1.2s total).
  Desktop parallax ≤36px image / ≤12px copy, paused off-screen
  (IntersectionObserver), transform/opacity only.
- `prefers-reduced-motion`: no parallax/scale/stagger, copy immediate,
  change = 150ms crossfade.
- SSR/no-JS: title + CTA render and are usable; controls are real
  `<button>`s with `aria-label` + focus-visible ring.

## Mobile (`≤768px`)

Image band on top (`clamp(320px,62vw,420px)`), a solid navy panel
(continuing the gradient) overlapping it upward by 34px. Title
`clamp(34px,8.6vw,44px)` ≤4 lines, summary ≤3 lines, controls below the
CTA, parallax off. Uses `mobileMedia` when present (not wired yet), else
the desktop image cropped to `focalMobile`.

## Known Phase-2 / simplifications

- No visual Hero editor; `heroConfig` is unset everywhere.
- No admin form to create `HERO` placements (the resolver honours them if
  rows exist).
- "Editorial Card Overlap" fallback for images with no negative space is
  approximated by the contrast probe → stronger scrim, not a layout swap.
- Title entrance is one fade-up, not per-line 70ms stagger.
- `mobileMedia` (separate mobile image id) is in the type/schema but the
  resolver doesn't populate it yet.
- Caption is hidden on mobile.
