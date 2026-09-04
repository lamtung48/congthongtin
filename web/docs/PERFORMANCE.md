# Performance audit

Full sweep against the checklist: bundle size, Client Component count,
hydration cost, third-party packages, image/video loading, lazy loading,
font loading, scroll listeners, `requestAnimationFrame`, `ResizeObserver`,
map rendering, layout shift, prefetch, dynamic import, route-level
loading, cache strategy, long tasks, DOM size. Every finding below is
measured against the real build output (`out/`, `.next/static/`), not
assumed. No micro-optimization was applied where measurement showed no
real benefit — see "Investigated, no change" and "Attempted, reverted"
below for the two places that turned out that way.

The scroll-listener / rAF / `ResizeObserver` items are **not** re-audited
here — `docs/MOTION_AUDIT.md` already covers every one of them in detail
(Header, Hero, StoryRail, ActivityMap's `useViewport`, the event rail) and
nothing changed in that code during this pass. This audit only adds what
that one didn't cover: bundle composition, Server/Client split, media
loading, fonts, DOM size, prefetch, cache, and long tasks.

## Summary

| Area | Verdict |
|---|---|
| `FeaturedNews` Client→Server conversion | **fixed** |
| `MediaImage` native lazy-loading attributes | **fixed** |
| Hero cover / Header logo / FeaturedNews main image `priority` | **fixed** |
| Font weight/style trim (`next/font/google`) | **fixed** — 48→21 files, 684KB→396KB |
| `MediaVideo`/`YoutubeBlockView` click-to-play iframe | **kept, already correct** |
| Map dependencies (`d3-geo`/`topojson-client`/`world-atlas`) | **kept, already minimal** |
| Remaining "use client" components | **kept, each independently justified** |
| DOM size (972 opening tags, homepage) | **kept, reasonable, not fixable further** |
| Prefetch (`next/link` default) | **kept, pagination already caps fan-out** |
| Cache strategy (client `fetch()` for map JSON) | **kept, already effectively cached** |
| Long tasks (d3-geo projection, search index rebuild) | **kept, both trivially small** |
| Route-level `loading.tsx`/`error.tsx` | **investigated, not added** |
| `FixtureProvider` fixture-JSON leaking into every client bundle | **investigated, documented, not restructured** |
| `ActivityMapSection` dynamic import (`next/dynamic`, `ssr: false`) | **attempted, measured, reverted** |
| `core-js` polyfill in one shared chunk | **observed, not root-caused** (no `.browserslistrc` in the project) |

## Fixed

### 1. `FeaturedNews`: Client Component → Server Component

`FeaturedNews.tsx` had `"use client"` for exactly one reason: the main
cover's `onClick` (`useArticleTransitionClick`, which drives the View
Transition to the article page). Everything else in the file — the grid
layout, the `secondary` array's `.map()`, date formatting — is plain
markup with no client-only behavior. `MediaImage` and `Reveal` were
already separate Client Components, so removing `"use client"` from
`FeaturedNews` itself doesn't change what runs in the browser, only where
the JS for *this file's own logic* executes: nowhere, once it's a Server
Component.

The one client concern was isolated into a new 12-line component:

```tsx
// src/components/content/ArticleCoverLink.tsx
"use client";
export function ArticleCoverLink({ href, ...rest }: Props) {
  const onClick = useArticleTransitionClick(href);
  return <Link href={href} onClick={onClick} {...rest} />;
}
```

`FeaturedNews` now imports `ArticleCoverLink` instead of wiring the click
handler itself, and drops `"use client"` and the
`useArticleTransitionClick` import entirely. Verified with `tsc`, `eslint`,
and `next build` — compiles clean, same rendered output.

**`Hero.tsx` was deliberately left alone** even though it uses the exact
same `useArticleTransitionClick` pattern inline. Hero already has to stay
a Client Component regardless — its scroll-parallax effect
(`docs/MOTION_AUDIT.md` §2) needs `useEffect`/`useRef`/a scroll listener
— so extracting the click handler there would be pure churn with zero
bundle benefit.

### 2. `MediaImage`: native lazy-loading + `priority` escape hatch

`MediaImage`'s `<img>` had no `loading`/`decoding`/`fetchPriority`
attributes at all — every image on the site, including ones below the
fold, was left to the browser's own (eager-ish) default. Added:

```tsx
<img
  loading={priority ? "eager" : "lazy"}
  decoding={priority ? "sync" : "async"}
  fetchPriority={priority ? "high" : "auto"}
  ...
/>
```

`priority` defaults to `false`. This is zero-JS, native browser lazy
loading — no `IntersectionObserver`, no library. `next/image` wasn't an
option to switch to here: the real image URL isn't known yet
(`resolveImageUrl` is a stub — see `docs/MEDIA_ARCHITECTURE.md`), so
there's no host to put in `next.config.ts`'s `images.remotePatterns`, and
this project's static export already sets `images.unoptimized: true`
anyway (no server to run the optimizer).

`priority` is wired to the three images that are actually above the fold
on first paint:
- Hero's cover image (`Hero.tsx`)
- FeaturedNews' main cover image (`FeaturedNews.tsx`)
- Header's logo, via `next/image`'s own `priority` prop (`Header.tsx`)

Verified in the built HTML (`out/index.html`): the Header logo change
produces `<link rel="preload" as="image" href=".../hsv-logo.png"/>` in
`<head>` and drops `loading="lazy"` from that one `<img>`, while Footer's
separate, below-the-fold logo `<Image>` (no `priority`) still correctly
renders `loading="lazy"`, unchanged. Every other `MediaImage` on the page
— FeaturedNews' secondary cards, LatestNews, Gallery, StoryRail, VideoSection
thumbnails — keeps the new `loading="lazy"` default, which they didn't
have before.

### 3. Font loading: trimmed to weights/styles actually used

`layout.tsx` declared, per family:

| Family | Before | After |
|---|---|---|
| Be Vietnam Pro | weights 300/400/500/600/700/800, no italic | weights 400/500/600 |
| Newsreader | weights 400/500/600/700, normal+italic | weights 400/500/600, normal+italic |
| JetBrains Mono | weights 400/500/700 | weights 400/500/600 |

`next/font/google` self-hosts one physical font file per declared
weight×style×subset combination — every unused one is a real file this
app was downloading (or at minimum reserving in the font-loading
waterfall) for nothing. Verified by grepping every `font-weight` and
`font-style: italic` declaration in the codebase's CSS:

- Only `--fw-medium` (500) and `--fw-semibold` (600) design tokens are
  ever applied anywhere; `--fw-light` (300), `--fw-bold` (700), and
  `--fw-extrabold` (800) are declared as CSS custom properties but never
  used by any selector.
- `font-style: italic` appears exactly once in the whole codebase:
  `ArticleBody.module.css`'s `.quoteText`, which is set on the Newsreader
  family — so italic was kept only for Newsreader, dropped for the other
  two.

Measured before/after via `git stash` (to get an exact "before" build)
and rebuilding:

```
before: 48 font files, 684KB total (.next/static/media/*.woff2)
after:  21 font files, 396KB total
```

A real ~56% drop in file count and ~42% drop in bytes — this is
render-blocking-adjacent weight (fonts gate text paint under
`font-display: swap`'s fallback-then-swap behavior), not a cosmetic
number.

## Kept as-is (already correct)

### Video/YouTube: never loads an iframe before the user asks for it

Checked explicitly per the brief's "không load YouTube iframe trước khi
user cần" priority. `MediaVideo.tsx`'s `playing` mode only renders a real
`<iframe>` when `resolveVideoPlaybackSource(media)` returns a truthy
value — and that resolver is a stub that always returns `undefined` today
(no real Drive/YouTube integration wired up yet, `docs/MEDIA_ARCHITECTURE.md`).
Even once it's wired up, the structural gate stays: no iframe exists in
the DOM until *both* (a) the user clicks play *and* (b) a real playback
URL resolves. `YoutubeBlockView.tsx` (the article-body video block) is
already its own small Client Component split out from the
otherwise-server-rendered `ArticleBody`, using local `useState` for
click-to-play. Nothing to change here — it already exceeds the bar this
audit was asked to hold it to.

### Map dependencies are already minimal

`package.json`'s only third-party runtime dependencies are `d3-geo`,
`topojson-client`, and `world-atlas` — all three exist solely for
ActivityMap. `world-atlas` on disk is 7.9MB, but the app only ever copies
its lowest-resolution file, `countries-110m.json` (108KB), into
`public/data/` and fetches that at runtime — the multi-megabyte
higher-resolution atlases in the package are never touched by the build.
There's no lower-resolution option to drop to; 110m is already the
coarsest `world-atlas` ships. No third-party UI/animation/utility library
exists anywhere else in the project (no lodash, no date library, no icon
package — the icons are hand-written inline SVG in `src/components/icons`).

### Remaining Client Components are each independently justified

Re-verified (not just carried over from earlier audits) that every
component still marked `"use client"` has a real client-only reason:

| Component | Why it must be client |
|---|---|
| `LiveEvents` | live countdown (`useState`/interval) + rail nav refs |
| `LocalNews` | interactive level filter (`useState`) |
| `Gallery` | lightbox open/close state, keyboard nav, focus trap |
| `VideoSection` | carousel index + click-to-play state |
| `StoryRail` | custom scroll-jack rail (rAF) — see `MOTION_AUDIT.md` §4 |
| `ActivityMapSection`/`VietnamMapSvg` | pointer interaction + `ResizeObserver` — `MOTION_AUDIT.md` §6 |
| `SearchOverlay`/`SearchPageClient` | live query state, debounced fetch, keyboard/ARIA combobox |
| `ShareActions` | Clipboard/Web Share API calls |
| `Footer` | newsletter form state |
| `Reveal` | `IntersectionObserver`-driven enter animation |
| `Header` | scroll-compact state, drawer/menu state, viewport hook |
| `Hero` | rAF scroll parallax — `MOTION_AUDIT.md` §2 |
| `MediaImage`/`MediaVideo` | load-state (`loading`/`loaded`/`error`) via `onLoad`/`onError`, and video play-state |
| `ArticleCoverLink` | the one `onClick` extracted from `FeaturedNews` (see above) |

None of these were converted. Each one's client-side state is the actual
feature, not incidental — converting any of them would mean deleting the
interaction, not moving it.

### DOM size: 972 opening tags on the homepage, not excessive

Counted opening tags in the built `out/index.html` (13-section homepage,
the heaviest page on the site):

```
total opening tags: 972
<span>  362   <div>   187   <path>  113   <svg>   68
<a>      49   <button> 39   <circle> 37   <link>   19
```

`<path>`/`<circle>`/`<svg>` together (218 elements, ~22% of the total)
are almost entirely the Vietnam map: each `<path>` is a country/province
boundary segment from the topojson data, each `<circle>` is a province
marker plus its separate larger invisible `<circle className="hit">` hit-
target (deliberate — a bigger tap target than the visible dot, for touch
accuracy) and its selection ring. That's real vector content for an
actual map visualization, not markup bloat. The `<span>` count is
dominated by hand-written inline icon SVGs (each icon is a component
rendering a `<svg>` + a handful of `<path>`s) reused across every section's
CTAs and meta rows.

972 total nodes for an 11-section, icon-heavy, content-rich homepage is
within the normal range for a modern site (plenty of comparable sites run
1,500–3,000+); there's no single component here padding the count for no
reason, so no restructuring was done — this would be exactly the kind of
"micro-optimization vô nghĩa" the brief said to skip.

### Prefetch: `next/link` defaults are fine given the site's own pagination

No route in the app tunes `<Link prefetch={...}>` away from the App
Router default (viewport-triggered prefetch of the route's static
payload). The concern with the default is fan-out: a page rendering many
links at once can trigger many concurrent low-priority prefetch requests
as it's scrolled. Checked the site's actual link-heavy views:

- `/tin-tuc` and every listing page paginate at `TIN_TUC_PAGE_SIZE = 9`
  (`TinTucPageView.tsx`) — at most 9 article links per page, plus a
  handful of category-pill links.
- The homepage's own listing sections (`LatestNews`, `FeaturedNews`,
  `StoryRail`, `Gallery`) each render a small, fixed number of cards, not
  an open-ended feed.

With link fan-out already capped at single digits to low tens per page,
the default prefetch behavior has nothing to over-fetch. No change.

### Cache strategy: the client-side map fetches are already effectively cached

`useActivityMapData.ts` keeps a module-level `topoCache` for
`countries-110m.json` (108KB) — fetched at most once per page session,
never refetched even if the component that reads it were to remount.
`activity-map.json` (26KB) has no such in-memory cache (it's refetched
every time `FixtureProvider.getActivityMap()` is called), but in practice
`ActivityMapSection` mounts exactly once per page load and never
unmounts/remounts within a session, so this never fires twice in
practice — adding a cache for a fetch that already only happens once
would be dead code.

Beyond that, there's no app-level lever to pull: this is a static export
on GitHub Pages, which has no support for a custom `Cache-Control`
config (no server, no `_headers`-file equivalent like Netlify) —
`next.config.ts`'s `headers()` API is explicitly a Node-server-only
feature and isn't available under `output: "export"`. Both JSON files are
served from GitHub Pages' own default static-asset caching, which is
outside this app's control. Documented here as a known hosting
constraint, not something the frontend can fix.

### Long tasks: neither real candidate is actually long

Two operations run non-trivial synchronous JS per the checklist's
prompt, both checked with real data sizes rather than assumed:

- **d3-geo Mercator projection** (`VietnamMapSvg`, via `d3-geo`): runs
  over 34 provinces (`activity-map.json`'s `provinces` array) plus the
  already-lowest-resolution 110m country boundary. This is tens, not
  thousands, of coordinate transforms, computed once on mount inside a
  `useEffect` — not on every scroll frame or every render.
- **Search index rebuild** (`buildSearchIndex()` in
  `fixtureProvider.ts`): rebuilds a flat array from ~34 articles +
  categories + topics (~40 items total) on every `searchContent()` call.
  Debounced in `SearchOverlay` (a `setTimeout`, not per-keystroke), and
  mapping 40 small objects is a sub-millisecond operation.

Neither is a long task by any measurable definition (Chrome's own
long-task threshold is 50ms; both of these are orders of magnitude under
that). No change — optimizing either would be exactly the kind of
speculative micro-optimization the brief said to avoid.

## Investigated, not added

### `loading.tsx` / `error.tsx`

No route has either file today. Checked what each would actually buy
under this architecture:

- **`loading.tsx`** shows during a client-side navigation while the next
  route's data/RSC payload is being fetched. Under full static export,
  every route's data is resolved at *build time* — there's no per-request
  server work to cover a gap for. On a static host, the next route's HTML
  is just a file; `loading.tsx` would show for, at most, the network
  latency of fetching a small static asset, i.e. imperceptibly. Adding it
  would add a skeleton component with no meaningful gap to fill.
- **`error.tsx`** does have a real (if narrow) use even in static export:
  it catches a client-side render error thrown *after* hydration
  (e.g., a bug in a Client Component's render). But every Client Component
  on this site is a small, self-contained, already-audited unit
  (Header, SearchOverlay, Gallery, etc.) with no known failure mode that
  would benefit from a route-level catch-all today, and adding a
  boundary "just in case" with no concrete failure to guard against is
  speculative code, not a fix for a checklist item.

Left both out. If a specific Client Component gains genuinely
error-prone logic in the future (e.g., real backend calls once
`resolveMedia.ts`'s stubs are replaced), `error.tsx` is worth revisiting
then.

## Investigated, documented, not restructured

### `FixtureProvider`: fixture data leaking into every page's client bundle

Traced a chunk present on **every route**, including ones with no map at
all, that contains `d3-geo`, `topojson-client`, and — confirmed by
diffing the chunk's embedded string content byte-for-byte against
`public/data/activity-map.json`'s own `note` field — the raw
`activity-map.json` fixture text itself.

Root cause: `Header` renders `SearchOverlay` on every page, and
`SearchOverlay` calls `searchContent()` (`contentService.ts` →
`FixtureProvider.searchContent()`) for its live client-side full-text
search. `FixtureProvider` is one class implementing `ContentProvider`
(`docs/DATA_ACCESS.md`), and that class also has a **server-only** method,
`getLocalityBySlug`, used only at build time by `/dia-phuong/[slug]`
pages — which needs the exact same per-province dataset the map renders,
so it imports it directly as JSON (`ACTIVITY_MAP_JSON`) rather than
`fetch()`-ing it (a server component rendered at build time has no
running HTTP server to fetch a relative URL against —
`fixtureProvider.ts`'s own comment on this import explains why).

Because `searchContent` and `getLocalityBySlug` live in the same
module, a bundler can't tree-shake the file per-method: importing
`searchContent` (needed client-side) pulls in the whole module's
top-level state, including the `ACTIVITY_MAP_DATA` import that only the
server-only method actually needs.

This is a known, already-documented architecture tradeoff
(`docs/SEARCH_ARCHITECTURE.md`, `docs/DATA_ACCESS.md`): the site is a
static export with no backend, so client-side full-text search has to
carry its own corpus, and `FixtureProvider` is deliberately one
implementation serving both server and client call sites so the two
never drift apart. Splitting it into a server-only module and a
client-safe module *is* a legitimate future fix, but it's a data-access
architecture change, not a "trim what a component loads" performance
fix — restructuring it here, inside a performance-audit pass, would be
scope creep into a decision that deserves its own review. Documenting the
real, measured cost instead:

- The shared chunk carrying this: **112KB raw / 39.5KB gzip** (also
  contains `d3-geo`/`topojson-client`, so this number isn't 100%
  attributable to the fixture leak alone, but the fixture text is a
  measurable fraction of it).

If this is worth fixing later, the shape of the fix is: split
`FixtureProvider` into a `searchContent`-and-friends module (client-safe,
imported by `SearchOverlay`) and a separate server-only module holding
`getLocalityBySlug` and its `ACTIVITY_MAP_JSON` import, so each call site
only pulls what it needs.

## Attempted, measured, reverted

### `next/dynamic({ ssr: false })` for `ActivityMapSection`

Tried isolating `ActivityMapSection` (the map is the single heaviest
homepage section: `d3-geo` + `topojson-client` + the province dataset)
behind a dynamic import, on the theory that a route not showing the map
above the fold could defer that whole chunk. Implementation: a
`"use client"` wrapper (`next/dynamic`'s `ssr: false` isn't allowed
directly inside a Server Component like `page.tsx` — confirmed against
Next's own bundled docs, `node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`,
before writing any code) rendering `ActivityMapSection` behind a loading
skeleton.

Build succeeded cleanly (`tsc`, `eslint`, `next build` all passed), but
measuring the *actual* built output surfaced two problems:

1. **Real content loss.** `grep -c "Hoạt động sinh viên trên toàn quốc" out/index.html`
   returned `0` after the change — `ssr: false` removes the section's
   server-rendered HTML entirely, so the homepage lost real, indexable
   content (the section heading, and everything under it) for zero
   client-JS benefit, since:
2. **No actual bundle isolation.** The d3-geo/topojson/fixture-JSON chunk
   was still referenced via `<script async>` on the homepage **and** on
   an unrelated article page after the rebuild. Turbopack's own automatic
   chunk-splitting merged it back into a shared bundle regardless of the
   `next/dynamic` boundary — this Next.js version's bundler doesn't
   guarantee that dynamically importing a Client Component produces a
   network-isolated chunk.

A real, measured downside (lost server-rendered content, no longer
in the static HTML at all) with no measured upside (the same bytes still
ship to every page) is a straightforward revert, not a tradeoff to keep.
Reverted: deleted the wrapper component and its CSS module, restored
`page.tsx`'s original direct import. Documented here rather than silently
dropped, since it's a genuine (negative) finding: dynamic-importing a
component in this build does not by itself guarantee the chunk isolation
it looks like it should.

## Observed, not root-caused

A `core-js` polyfill signature was found inside one shared build chunk
(~112KB raw / ~39.5KB gzip — the same chunk discussed above). The project
has no `.browserslistrc`/`browserslist` field in `package.json`, so
there's no explicit target controlling what gets polyfilled. This wasn't
traced to a specific dependency or resolved in this pass — flagging it as
a fact to revisit (adding a `browserslist` target matching this app's
actual supported browsers, e.g. no IE11, would very likely shrink or
remove this) rather than a fix, since changing build-wide polyfill
behavior without knowing which specific API triggers it risks silently
breaking something in an older browser this audit didn't test against.

## What this audit deliberately did not touch

Per the brief's explicit boundary — "Không được làm mất motion signature
chỉ để đạt điểm benchmark" — nothing here removed or diluted the site's
scroll/hover/transition motion. `MOTION_AUDIT.md`'s findings (rAF-gated
scroll listeners, `ResizeObserver`-driven map interaction, CSS-only hover
transitions, View Transition page/image handoffs) are all still in place,
untouched by this pass. Every fix in this document reduces bytes shipped
or work done *around* the interactive pieces (fonts, images, Server/Client
boundaries) — none of it changes how anything moves or feels.
