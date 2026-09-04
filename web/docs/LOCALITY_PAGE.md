# Locality page — `/dia-phuong/[slug]` + ActivityMap linkage

## Province → slug mapping

`src/data-access/fixtures/provinces.ts`'s `PROVINCES` array is the identity
source (`id`/`slug`/`name`/`lat`/`lon`) for all 34 provinces, extracted once
from `public/data/activity-map.json` — its own doc comment already says so.
Slugs match the map dataset's `province.slug` field exactly, so `PROVINCES`,
`ActivityMapProvince.slug`, and `/dia-phuong/[slug]`'s route param are always
the same string for the same province; there is no separate translation
table to keep in sync.

`getLocalitySlugs()` (used by `generateStaticParams()`) unions three
sources: every `Province.slug` (34), every `LocalNewsEntry.place` slugified,
and every `StoryRailItem.place` slugified. The latter two also produce
non-province slugs (`tokyo-nhat-ban`, `paris-phap`, `praha-sec`, ...) — a
`/dia-phuong/[slug]` page for a place outside the 34 tracked provinces is
legitimate content, just without province-level statistics (see below).

## Shared data contract

`ProvinceActivityProfile` (`src/domain/activity.ts`) is the camelCase
projection of `ActivityMapProvince` — same fields the map itself renders
(`provinceId`, `provinceName`, `slug`, `reported`, `period`, `updatedAt`,
`articleCount`, `activityCount`, `studentCount`, `categoryDistribution`,
`latestArticle`), computed by `toProvinceActivityProfile()` in
`fixtureProvider.ts`. Both the Homepage `ActivityMap` and
`/dia-phuong/[slug]` read the exact same underlying record — there's no
second, independently-maintained copy of a province's numbers that could
drift from what the map shows.

**How the map reads it (client, at runtime):** `getActivityMap()` still
`fetch()`es `public/data/activity-map.json` from a "use client" hook — this
was already the design (`docs/DATA_ACCESS.md`) and stays untouched. **How
the locality page reads it (server, at build time):** `fixtureProvider.ts`
imports the same JSON file directly as an ES module
(`import ACTIVITY_MAP_JSON from "../../../public/data/activity-map.json"`)
instead of fetching it — a server component rendered during `next build`
has no running HTTP server to `fetch()` a relative URL against, but a JSON
import resolves at build time in any context. Same file, two different
loading mechanisms for two different execution contexts — not two datasets.

`LocalityProfile` (`src/data-access/types.ts`) embeds this as `activity:
ProvinceActivityProfile | null`, plus two more fields the map doesn't need
and that aren't limited to the 34 provinces: `latestActivity` (most recent
`Event` whose `place` names this locality) and `organizations` (`Organization[]`
derived from `LocalNewsEntry.orgName`, each linking to the `/don-vi/[slug]`
`getUnitBySlug` would resolve for that name) — plus `relatedMedia`
(`MediaAsset[]` from `HOMEPAGE_GALLERY` items whose `metadata.locationLabel`
names this place). None of these are hardcoded per-locality strings in the
page component; every one is a filter over an existing fixture pool.

## Route linkage — ActivityMap → locality page

`ActivityMapSection.tsx` was not rewritten — only the CTA target changed:

- `selUrl` for a selected **province** is now `localityHref(selP.slug)`
  (was `selP.unit_url || unitHref(selP.slug)`, i.e. `/don-vi/[slug]`).
- The "Tin mới nhất từ các địa phương" quick-link list (shown when nothing
  is selected) now also points to `localityHref(p.slug)` for the same
  reason — it was already labeled "from the localities" but linked to the
  unit page.
- A selected **overseas** chapter still goes to `/don-vi/[slug]` — it isn't
  a geographic locality, so this wasn't changed.
- The CTA label branches on the same condition (`selCtaLabel`): "Xem trang
  địa phương" for a province, "Xem hoạt động của đơn vị" for an overseas
  chapter — so the button text always matches where it actually goes.

This is the entire diff to the map: two link targets and one label
computed from existing state, both desktop paths (the aside `<a>`) and the
mobile path (the bottom sheet's `<a>`, already built and unchanged in
structure). Loading/empty/error states for the map itself
(`useActivityMapData`'s `state`, rendered by `VietnamMapSvg`) were already
complete and untouched.

## Page structure

`PageShell` supplies items 1–2 (title = province/place name; description =
a one-line computed summary — reported numbers, "chưa gửi số liệu", or a
generic locality description depending on `activity`'s three possible
states below). Items 3–8 are independent `<section>`s in
`page.tsx`/`page.module.css`; Footer (item 9) is the global one from
`app/layout.tsx`, unchanged.

## Empty / error states — three distinct cases, deliberately different copy

1. **Not a real province at all** (`activity === null`, e.g. `tokyo-nhat-ban`):
   "Không áp dụng số liệu cấp tỉnh" — this place was never going to have
   province-level statistics; that's a modeling fact, not a data gap.
2. **A real province that hasn't reported this period** (`activity.reported
   === false`, e.g. `cao-bang`): "Chưa có số liệu báo cáo" — this data is
   expected to eventually exist. No stat cell renders for a `null` field in
   either case; a province is never shown "0 hoạt động" for a number it
   never actually reported.
3. **Unknown slug** (not in `getLocalitySlugs()` at all): `notFound()` →
   the existing `not-found.tsx`, unchanged.

Every one of the six other sections (activity, news, category distribution,
organizations, media) has its own `EmptyState` or is conditionally hidden
("nếu có") rather than rendering an empty container.

## What's still waiting on a backend

- **Everything is fixture data.** `FixtureProvider` is the only thing that
  changed — swapping it for a real `ApiProvider` is still the documented
  one-line change at `getContentProvider()` (`docs/DATA_ACCESS.md`).
- **`UnitProfile.activityStats` is still always `null`.** `/don-vi/[slug]`
  (a specific reporting unit, not a province) has no equivalent of
  `ProvinceActivityProfile` wired up — the mechanism this task built (a
  build-time-safe read of the activity dataset) could back it, but doing so
  is unbuilt; that page still renders its existing empty state.
- **`latestActivity`/`organizations` are heuristics, not a real backend
  relationship.** An event "belongs" to a place by matching a substring of
  `Event.place` against the place's display name; an organization
  "belongs" to a place by having published a `LocalNewsEntry` located
  there. A real backend would presumably have an explicit
  province/unit foreign key on both `Event` and `Organization` instead of
  string matching.
- **`categoryDistribution`'s labels** come from the same JSON's own
  `categories` array — correct today, but a real API would more likely
  return already-labeled data (or a stable category id to look up against
  a real taxonomy service) rather than a slug this app has to re-label.
