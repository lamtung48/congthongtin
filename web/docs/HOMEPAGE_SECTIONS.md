# Homepage sections — motion & layout notes

Design decisions for the homepage bands that were rebuilt in September 2026
for a student audience ("hiệu ứng đẹp mắt, hiện đại"). The Hero has its own
document (`HERO.md`); the video band's data/CMS side is in
`YOUTUBE_INTEGRATION.md`.

Shared rules for all of them:

- Content is readable with **no JavaScript**: every entrance effect either
  starts from the visible state or is added by JS on top of visible content
  (`Reveal`'s `is-armed`/`is-in` classes, the map's `data-phase`).
- `prefers-reduced-motion` disables every looping animation explicitly —
  `globals.css` only shortens the duration tokens, which is not enough for
  `animation: … infinite`.
- Hover-only affordances are duplicated for touch (`@media (hover: none)`).

## Tin tiêu điểm (`FeaturedNews.tsx`)

Bento of six: lead card (image full-bleed, copy overlaid), runner-up card,
then a numbered list (03–06). Still a **Server Component** — the effects are
CSS (cover zoom, light sweep, hover lift, index number filling with a
gradient). The lead card as a whole is the `ArticleCoverLink`, so the View
Transition click stays in that one small client component; the shared
`view-transition-name` sits on the image inside it, which is what morphs into
the article page's cover.

The highlighter stroke under "tiêu điểm" is an inline SVG path with
`pathLength=1`, drawn by transitioning `stroke-dashoffset` from 1 to 0 when
the head is revealed. Default state is *drawn*, so it is correct without JS.

## Dòng chảy sinh viên (`StoryRail.tsx`)

The drift engine (constant-speed `scrollLeft`, seamless fold-back, pause on
interaction) is unchanged — see the file's own header comment. The 2026-09
rebuild is presentation only:

- Portrait 4:5 "story" cards, copy overlaid, place chip + index.
- Background: two sine-wave layers and a giant outlined marquee. Both loop by
  translating exactly one tile width (`wave()` only uses periods that divide
  1440; the marquee renders its text twice and shifts by 50%), and both fade
  at the edges with a **mask on the static parent** — a gradient on the moving
  element itself would visibly jump at the loop point.
- Depth: `animation-timeline: view(inline)` scales/fades each card as it
  crosses the rail, so it follows the drift, a swipe and the buttons alike
  with no JS. Browsers without scroll-driven animations just show flat cards.

## Bản đồ phong trào (`ActivityMapSection.tsx`, `activity-map/`)

The map drawing itself ("nổi khối" extrusion, HSV emblem markers, blue glow)
is unchanged. Added:

- **Entrance choreography**: `useEntrancePhase` (IntersectionObserver on the
  map/aside grid) sets `data-phase` = `armed` → `in`; the slab rises, markers
  pop in biggest-first (`--d` stagger), KPI numbers count up (`useCountUp`),
  the coverage ring fills, leaderboard bars grow. Phase stays `static` under
  reduced motion or without IntersectionObserver, and every state change
  happens inside an observer/rAF callback, never synchronously in an effect.
- **"Đèn sáng" ripples**: provinces that have tin bài/hoạt động emit two
  staggered rings (`.ripple`, `vector-effect: non-scaling-stroke`). They are
  `pointer-events: none`, so the nearest-centre hit-testing is untouched.
- **"Thắp sáng bản đồ"** coverage card (reported/total provinces as a ring) —
  the section's answer to sparse data: with one province lit it reads as an
  invitation rather than an empty map. The leaderboard only appears with ≥2
  provinces that have data.
- **Sticky map**: on ≥1181px the map card stays in view while a long aside
  scrolls. This needed two things: `overflow: clip` instead of `hidden` on
  the section, and the same swap on the site shell (`.siteShell` in
  `globals.css`, previously an inline `overflowX: "hidden"` in
  `(site)/layout.tsx`). `overflow: hidden` makes an element a scroll
  container, which silently disables `position: sticky` for everything inside
  it — the `hidden` declaration is kept first as the fallback for browsers
  without `clip`.

## Kênh YouTube của Hội (`VideoSection.tsx`)

Stage + playlist rail, ambient glow taken from the selected video's still,
inline playback (the embed replaces the still in place, `autoplay=1` only
because our own play button was pressed). Custom thumbnails come from
`MediaAsset.thumbnailMediaId` — see `YOUTUBE_INTEGRATION.md`.
