# Route Architecture

All routes use the App Router (`src/app/`). Header and Footer render once,
in `src/app/layout.tsx` — no other route re-renders them ("Không duplicate
layout"). Every route below composes shared building blocks
(`PageShell`, `Breadcrumb`, `EmptyState`, `NotFoundState`,
`ArticleList`) instead of inventing its own header/empty-state/404 markup.

No route beyond the 9 requested plus the homepage was added. Two of the
requested routes (`/dia-phuong/[slug]`, `/don-vi/[slug]`) look similar
enough to justify explaining why both exist — see their entries below.

## Route table

| Route | Purpose | Data source | Page component | Route param | Future backend endpoint |
|---|---|---|---|---|---|
| `/` | Homepage — 11 curated sections | `homepageService.ts` (all of it) | `src/app/page.tsx` | — | `GET /api/homepage` |
| `/tin-tuc` | News index — every article | `getLatestArticles()` | `src/app/tin-tuc/page.tsx` | — | `GET /api/articles?page=` |
| `/tin-tuc/[slug]` | Article detail | `getArticleBySlug()` (searches every article pool) | `src/app/tin-tuc/[slug]/page.tsx` | `slug`: article slug | `GET /api/articles/:slug` |
| `/chuyen-muc/[slug]` | Category listing (Tình nguyện, Nghiên cứu, ...) | `getCategoryBySlug()` + `getArticlesByCategory()` | `src/app/chuyen-muc/[slug]/page.tsx` | `slug`: category slug | `GET /api/categories/:slug`, `GET /api/articles?category=` |
| `/chu-de/[slug]` | Topic/campaign hub (Đại hội XII, Sinh viên 5 tốt, ...) | `getTopicBySlug()` | `src/app/chu-de/[slug]/page.tsx` | `slug`: topic slug | `GET /api/topics/:slug`, `GET /api/articles?topic=` |
| `/dia-phuong/[slug]` | Geographic place hub — everything keyed by *where* | `getLocalityBySlug()` (matches `LocalNewsEntry.place` and `StoryRailItem.place`) | `src/app/dia-phuong/[slug]/page.tsx` | `slug`: place slug (usually a province slug) | `GET /api/localities/:slug` |
| `/don-vi/[slug]` | A specific reporting Hội unit's profile — organized by *who reports*, not *where* | `getUnitBySlug()` (organization name, then province, then overseas chapter) | `src/app/don-vi/[slug]/page.tsx` | `slug`: unit slug | `GET /api/units/:slug`, plus the activity-map aggregation endpoint for `activityStats` |
| `/su-kien/[slug]` | Event detail | `getEventBySlug()` | `src/app/su-kien/[slug]/page.tsx` | `slug`: event slug | `GET /api/events/:slug` |
| `/video` | Video/reportage index | `getVideos()` | `src/app/video/page.tsx` | — | `GET /api/videos` |
| `/tim-kiem` | Search results (also the search overlay's "view all") | `searchContent()` | `src/app/tim-kiem/page.tsx` | `?q=` search param | `GET /api/search?q=` |

### Why `/dia-phuong/[slug]` and `/don-vi/[slug]` both exist

They answer different questions about the same 34 provinces (and overseas
chapters):

- **`/dia-phuong/[slug]`** — "what's happening *in* Hà Nội?" Aggregates by
  `place`: local news datelined there, story-rail pieces set there. A place
  can have content here with no single đơn vị "owning" it.
- **`/don-vi/[slug]`** — "what has *this specific Hội chapter* reported?" A
  profile page for one reporting unit (a province chapter, a university
  chapter, or an overseas chapter) — its own news plus (once wired up) its
  activity-map statistics.

The activity map's own `unit_url` field (`public/data/activity-map.json`)
already pointed at `/don-vi/{province.slug}` before this task — confirming
that's the intended target for "a province, as a reporting unit," and
distinguishing it from the newly-added `/dia-phuong/{slug}` for "a province,
as a place."

## Breadcrumb contract

`src/components/ui/Breadcrumb.tsx`. Every route below the homepage renders
one, built as `BreadcrumbItem[]`:

```ts
interface BreadcrumbItem { label: string; href?: string }
```

- First item is always `{ label: "Trang chủ", href: "/" }`.
- Last item is the current page and never carries `href` (it's not a link
  to itself — rendered as `<span aria-current="page">`).
- Middle items are the section index the current page belongs to (e.g.
  `/tin-tuc/[slug]` → Trang chủ → Tin tức → [category] → [article title]).
- Also emits a `BreadcrumbList` JSON-LD block for SEO, generated from the
  same array — one data source, two outputs.

## Metadata contract

`src/lib/seo.ts`'s `pageMetadata()`, called from each route's `metadata`
export or `generateMetadata()`:

```ts
pageMetadata({ title, description, path, noIndex? }): Metadata
```

- `title` is just the page-specific fragment — `app/layout.tsx` sets
  `title.template: "%s · Cổng thông tin số Hội Sinh viên Việt Nam"`, so no
  page builds the full string itself.
- `path` becomes both `alternates.canonical` and the Open Graph `url`,
  relative to the root layout's `metadataBase` (`NEXT_PUBLIC_SITE_URL`, or
  `http://localhost:3000` until a real domain is chosen).
- `noIndex: true` is set for not-yet-resolved dynamic pages (metadata
  generated for a 404'd slug) and for `/tim-kiem` (a results page, not
  canonical content).
- Every dynamic route's `generateMetadata` awaits the same lookup the page
  itself uses, so a missing slug gets `noIndex` metadata *and* renders
  `notFound()` — never indexable metadata for a page that doesn't exist.

## Not-found contract

Two layers, matching Next.js's own `notFound()` bubbling behavior:

1. **Per-route `not-found.tsx`** — one next to each `[slug]` folder
   (`tin-tuc/[slug]`, `chuyen-muc/[slug]`, `chu-de/[slug]`,
   `dia-phuong/[slug]`, `don-vi/[slug]`, `su-kien/[slug]`). Each page calls
   `notFound()` when its lookup returns `null`, which renders the nearest
   `not-found.tsx` — giving a section-specific message ("Không tìm thấy bài
   viết" vs "Không tìm thấy sự kiện") instead of one generic 404, while
   sharing the same `NotFoundState` component and visual language.
2. **Global `app/not-found.tsx`** — catches any URL that doesn't match a
   route at all (typos, removed paths). No breadcrumb, since there's no
   known section to place it under.

`NotFoundState` (`src/components/ui/NotFoundState.tsx`) takes
`title`/`description`/`actionLabel`/`actionHref` — every not-found page
offers a way back to a relevant index, not just "home" by default.

## Empty-state contract

`EmptyState` (`src/components/ui/EmptyState.tsx`) — `title`, `description`,
optional `action: { label, href }`. Rendered wherever a lookup *succeeds*
but has nothing to list:

- `/chu-de/[slug]` — always empty today (no article↔topic association
  exists in the fixtures yet; the topic's own `articleCount` is shown as an
  eyebrow so the page isn't visually bare).
- `/chuyen-muc/[slug]`, `/dia-phuong/[slug]`, `/don-vi/[slug]` — empty when
  no article/local-news matches.
- `/tim-kiem` — empty when there's no query yet, or the query matches
  nothing.
- `/tin-tuc/[slug]` — every article renders an `EmptyState` in place of a
  body, since no fixture has long-form content yet (see `docs/DATA_MODEL.md`).

This is never a blank `<div>` or debug text — always a title, an
explanation of *why* it's empty, and usually a link back to a populated page.

## Slug strategy

- Content that already has a real slug uses it as-is: articles, events,
  categories, topics, and the 34 provinces (`ActivityMapProvince.slug` from
  `public/data/activity-map.json`).
- Content with no slug in its source data gets one via `slugify()`
  (`src/lib/slug.ts`) — diacritic-stripped, lowercase, kebab-case. Used for:
  overseas chapters (`slugifyOverseasName()`, which also strips the shared
  "Hội Sinh viên Việt Nam tại " prefix so `/don-vi/phap` reads naturally)
  and local-news organizations/places (`/don-vi/[slug]`, `/dia-phuong/[slug]`).
- `src/lib/routes.ts` is the single place that turns a slug into a path —
  `articleHref`, `categoryHref`, `topicHref`, `localityHref`, `unitHref`,
  `eventHref`, `searchHref`. No component builds a route string by hand.

## Internal link cleanup done in this task

- `articleHref()` now points at `/tin-tuc/[slug]` (was `/tin/[slug]`,
  matching a route that never existed under the App Router).
- Every `<Link prefetch={false}>` aimed at a route that now exists had
  `prefetch={false}` removed — it existed only to silence prefetch 404s for
  routes that hadn't been built yet (see the earlier audit's note on this).
  Links to genuinely external, undecided destinations (see below) don't use
  `next/link` at all, so prefetching was never a question for them.
- Every `href="#"` was replaced with either a real route or, where the
  destination is a real *external* system with no address yet (the login
  action, three of the five `EcosystemBento` platforms, `soon` nav items),
  a non-interactive `<span aria-disabled="true" title="...">` — a dead link
  and a disabled affordance are different things, and only the first one
  was banned. `PlatformCta` (`EcosystemBento.tsx`) centralizes that decision
  for the platform tiles.
- The search overlay's default suggestions and results now link to the
  real article each corpus entry mirrors (`SearchSuggestion.slug`/`url`,
  added in this task) instead of `href="#"` or the generic `/tin-tuc`.
  "Xem tất cả kết quả" now goes to `/tim-kiem?q=...`.
- `LiveEvents`/`buildEventView()`: every event card now links somewhere —
  its own external `url` when set, or its new `/su-kien/[slug]` page when
  not — instead of rendering a dead "chưa khả dụng" block with no link at
  all.
- `ActivityMapSection`: the overseas "Xem hoạt động của đơn vị" action now
  resolves a real `/don-vi/[slug]` via `slugifyOverseasName()`, and every
  `unit_url || "#"` fallback now falls back to `unitHref(slug)` instead.
