# Search architecture — Header overlay + `/tim-kiem`

## Flow

```
Header Search Trigger (IconSearch button)
        ↓
SearchOverlay (compact, keyboard-first)   /tim-kiem (full page, own input)
        ↓                                          ↓
        └──────────────→  searchContent(query, limit)  ←──────────────┘
                                    ↓
                    ContentProvider.searchContent()
                    (FixtureProvider today, docs/DATA_ACCESS.md)
```

Both entry points call the exact same `contentService.searchContent(query, limit?)`
— there is no second, parallel search implementation anywhere. This is the
one property that makes "connect a real engine later without rewriting the
UI" true: swap what's behind that one function and every caller — the
header overlay, `/tim-kiem`, and anything built later — keeps working
unchanged.

## The result contract

`SearchResultItem` (`src/domain/search.ts`):

```ts
type SearchResultType = "article" | "category" | "topic" | "organization" | "province" | "event";

interface SearchResultItem {
  id: string;
  type: SearchResultType;
  title: string;
  category: string;   // display label, always a plain string
  image?: MediaAsset;
  excerpt?: string;
  publishedAt?: string; // only article/event
  url: string;
}
```

Every search surface renders exactly this shape via one component,
`SearchResultRow` (`src/components/content/SearchResultRow.tsx`) — the
overlay uses it compact (no image/excerpt), `/tim-kiem` uses it `full`
(image + excerpt), the same way `NewsCard`'s `wide` prop works. A real
search backend's job is to produce this shape (or something
`ApiProvider.searchContent()` maps into it) — nothing past that mapping
point, in either UI, needs to know what produced it.

## Today: `FixtureProvider`'s temporary index

`buildSearchIndex()` in `src/data-access/providers/fixtureProvider.ts`
assembles the index fresh on every call, straight from the fixtures every
other route already reads — no separate hand-authored search dataset to
keep in sync:

| `SearchResultType` | Source | Notes |
|---|---|---|
| `article` | `allArticles()` (the same deduplicated pool `/tin-tuc` and article-detail read) | title, category name, cover image, lead, publishedAt |
| `category` | `CATEGORIES` | links to `/chuyen-muc/[slug]` |
| `topic` | `TOPICS` | links to `/chu-de/[slug]` |
| `organization` | `LOCAL_NEWS` org names ∪ `PROVINCES` ∪ `OVERSEAS_ORGANIZATIONS` — the same three sources `getUnitSlugs()` unions | links to `/don-vi/[slug]`; level label from `ORGANIZATION_LEVEL_LABEL` |
| `province` | `PROVINCES` | links to `/dia-phuong/[slug]` |
| `event` | `EVENTS` | links to the event's own `url`, or `/su-kien/[slug]` as fallback |

Matching and ranking (`src/lib/search.ts`, `matchesSearchQuery`) is literal,
diacritic-insensitive substring matching, tiered by which field matched
(exact title > title starts-with > title contains > category contains >
excerpt contains). This is deliberately **not** semantic search and
**not** an AI-generated ranking — the task brief asks for neither, and
faking either would be dishonest about what a fixture-backed prototype can
actually do. `normalizeForSearch()` strips diacritics/case so "ha noi"
still matches "Hà Nội".

`HomepageConfiguration.search.corpus` (`SEARCH_CORPUS` in
`fixtures/homepage.ts`) is a *separate*, small, editorially-curated list —
the "Tìm nhiều nhất" quick suggestions shown in the overlay's idle state,
not the search index. Conflating the two was the old design (`SearchSuggestion`,
now removed); keeping them apart means the idle suggestions can stay a
curated highlight reel while the actual index covers everything.

## Connecting a real backend later

`ContentProvider.searchContent(query, limit?)` (`src/data-access/provider.ts`)
is the single seam. To connect Meilisearch, Postgres full-text, or a hosted
search API:

1. Write a new provider (e.g. `MeilisearchProvider implements ContentProvider`,
   following the same pattern `docs/DATA_ACCESS.md` describes for every
   other method) whose `searchContent()` calls the real engine and maps its
   response into `SearchResultItem[]`.
2. Swap the one line in `getContentProvider()` (`src/data-access/index.ts`).
3. Nothing else changes: `SearchOverlay`, `SearchPageClient`,
   `SearchResultRow`, and the keyboard/state handling described below are
   all written against `SearchResultItem` and a `Promise`-returning
   function, exactly the shape a real engine returns anyway.

Both UIs already treat `searchContent()` as capable of failing (`try`/`catch`
around the call, a dedicated `error` state) even though `FixtureProvider`
can't realistically throw today — that's deliberate: it's the seam a real
network call needs, built in advance rather than retrofitted.

## Query param

`/tim-kiem?q=<query>` — `searchHref(query?)` (`src/lib/routes.ts`) is the
only place that builds this URL; nothing constructs it by hand. Example:
`/tim-kiem?q=sinh+vien+5+tot`. Static export can't read `searchParams`
server-side (`docs/DEPLOYMENT.md`), so `/tim-kiem` reads/writes `q` via
`useSearchParams()`/`router.push()` client-side; the page's own `<title>`
stays the static "Tìm kiếm" for the same reason.

## States

Both `SearchOverlay` and `SearchPageClient` implement the same five states
from the brief, named identically in code (`type Phase = "initial" |
"loading" | "results" | "empty" | "error"`):

- **initial** — no query yet. Overlay: "Tìm nhiều nhất" (`corpus`) +
  trending topic chips. Page: an `EmptyState` prompting a query.
- **loading** — a request is in flight (debounced 350ms in the overlay to
  avoid searching on every keystroke; the page searches on navigation, no
  debounce needed since it's already URL-driven). Skeleton rows, not a
  blank panel.
- **results** — at least one hit. A result count is shown; the overlay caps
  at 8 with a "Xem tất cả kết quả" link to the full page, `/tim-kiem` caps
  at 40.
- **empty** — the request succeeded with zero hits. Distinct copy from
  "loading" and from "error" — never silently shows nothing.
- **error** — the request rejected. A retry button re-runs the same query.
  Structurally real (a genuine `try`/`catch` around a real `Promise`), even
  though nothing in `FixtureProvider` throws today.

A `requestId` counter in both components discards a stale response that
resolves after a newer keystroke already superseded it (fixes the classic
type-ahead race condition), and the page's search effect double-checks a
`cancelled` flag on unmount/re-run for the same reason.

## Keyboard

- **Focus input** — the overlay autofocuses its input on open
  (`inputRef.current?.focus()` in an effect keyed on `open`).
- **ESC** — closes the overlay and returns focus to the header's search
  button (a full focus-trap already existed here and is unchanged). On
  `/tim-kiem`, Escape clears the input and navigates back to the
  query-less `/tim-kiem`.
- **Enter** — both inputs sit in a `<form onSubmit>`, so Enter submits
  natively. In the overlay, submitting with a highlighted suggestion
  navigates straight to it; submitting without one navigates to
  `/tim-kiem?q=...`. On the page, submitting updates the URL, which
  re-triggers the search effect.
- **Arrow keys ("nếu có suggestion")** — only the overlay has a suggestion
  list in the combobox sense (the idle "Tìm nhiều nhất" list or the live
  results list); ArrowDown/ArrowUp move a `highlightIndex` through whichever
  one is currently visible, wrapping at both ends. The input carries
  `role="combobox"`, `aria-expanded`, `aria-controls="search-listbox"`,
  and `aria-activedescendant` pointing at the highlighted `SearchResultRow`
  (`role="option"`, `id="search-option-{i}"`) inside a `role="listbox"`
  container — the standard accessible combobox pattern. `/tim-kiem` renders
  results as normal page content, not a floating suggestion list, so it
  doesn't implement arrow-key navigation — there's no listbox for it to
  navigate.

## What's still fixture-backed, not "real"

- The entire index is rebuilt from in-memory fixture arrays on every call —
  fine at this data size, not how a real engine would work at scale.
- Ranking is tiered substring matching, not relevance scoring, typo
  tolerance, or synonyms — a real engine (Meilisearch, Postgres
  `ts_rank`) provides all three without this app doing anything extra once
  connected.
- No query analytics, no "did you mean", no personalization — none of
  these were asked for and none are faked.
