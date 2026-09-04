# Listing pages — `/tin-tuc`, `/chuyen-muc/[slug]`, `/chu-de/[slug]`

## Shared components

| Component | Role | Used by |
|---|---|---|
| `FeaturedNewsCard` (`components/content/`) | The single large "lead story" card | `/tin-tuc`, `/chuyen-muc/[slug]` |
| `NewsCard` (`components/content/`) | Grid tile, with a `wide` variant | `/tin-tuc`, `/chu-de/[slug]` |
| `ArticleList` / `NewsListItem` (`components/content/ArticleList.tsx`) | Compact list row | `/chuyen-muc/[slug]`, `/tin-tuc/[slug]`'s related articles, `/tim-kiem` |
| `Tag` / `TagList` (`components/content/`) | Pill chip / row of chips | article tags, `/chu-de/[slug]`'s related tags |
| `TrendingTopics` (`components/home/`, pre-existing) | Full-bleed topic rail | `/tin-tuc` (reused as-is from the homepage, not reimplemented) |
| `Pagination` (`components/content/`) | Real prev/next, no fake loading | all three routes |
| `MediaImage` (pre-existing) | Every image, everywhere | via the cards above |

None of these are new abstractions over "the same card with different spacing" — each one is a genuinely different shape (lead story vs. grid tile vs. list row vs. chip), which is also what keeps a single page from reading as one repeated card: `/tin-tuc` mixes a `FeaturedNewsCard` with a `NewsCard` grid where every 5th tile is `wide` (bigger image, lead text shown); `/chuyen-muc/[slug]` pairs the same `FeaturedNewsCard` with a compact `ArticleList`, not a grid at all; `/chu-de/[slug]` uses a `NewsCard` grid with a shorter `wide` interval (every 4th) so it doesn't look identical to `/tin-tuc`'s. Three routes, three different rhythms, four shared building blocks.

## Data contract

New/changed `ContentProvider` methods (`src/data-access/provider.ts`, implemented in `fixtureProvider.ts`, exposed via `contentService.ts`):

- `getAllArticles()` — every article, most recent first. Backs `/tin-tuc`; distinct from `getLatestArticles()`, which is the homepage's own curated subset.
- `getArticlesByCategory(slug)` — now reads from the same deduplicated `allArticles()` pool the article-detail page already built (previously only scanned `LATEST_ARTICLES`, missing the Hero/featured/story-rail/local-news articles that also carry a category).
- `getArticlesByTopic(slug)` — an article counts toward a topic if it's explicitly tagged (`Article.topics`) **or** its category aliases to that topic (`CATEGORY_TOPIC_ALIAS` in `fixtureProvider.ts`: `nghien-cuu → nghien-cuu-khoa-hoc`, `hoi-nhap → hoi-nhap-quoc-te`; three category/topic slugs already match exactly and need no alias). This is a deliberate bridge, not hidden: most fixture articles don't carry `Article.topics` yet, and without the alias every topic page but the two showcase articles' topics would be empty. `chuyen-doi-so` has no matching category and stays empty — an honest gap, not a bug.

`/tin-tuc`'s featured article reuses `getFeaturedArticles()` (the homepage's own pick) rather than inventing a second "top story" heuristic — the same lead story appears in both places, same as most real news sites' homepage vs. news-index relationship.

## Pagination

`src/lib/pagination.ts` — `paginate()` slices an array into a real page; `staticPageParams()` generates `generateStaticParams()` entries for pages 2..N (page 1 has no `/trang/1` URL — it lives at the un-suffixed route, so there's exactly one canonical URL per page). No client-side "load more", no fake network delay — every page is its own statically-generated HTML file, exactly the shape a real paged API would eventually back.

Route shape, all three families:

```
/tin-tuc                              (page 1)
/tin-tuc/trang/2, /trang/3, ...       (page 2+)
/chuyen-muc/[slug]                    (page 1)
/chuyen-muc/[slug]/trang/[page]       (page 2+)
/chu-de/[slug]                        (page 1)
/chu-de/[slug]/trang/[page]           (page 2+)
```

Each family shares one implementation (`TinTucPageView`, `CategoryPageView`, `TopicPageView`) between its page-1 route and its `trang/[page]` route, so the two can't quietly diverge. The `trang/[page]` route rejects `page <= 1` (that URL doesn't exist) and the shared view itself rejects `page > pageCount` — both via `notFound()`, not a silent clamp, so an out-of-range page 404s instead of quietly showing page 1's content again.

**`output: "export"` requires at least one generated path per dynamic route.** Today no category and only one topic (`tinh-nguyen`) actually has a real second page — most `chuyen-muc/[slug]/trang/[page]` and `chu-de/[slug]/trang/[page]` combinations would give `generateStaticParams()` an empty array, which fails the export build outright. `ensureNonEmptyParams()` substitutes one placeholder path per route (`{slug: firstCategory, page: "1"}`) that the route's own `page <= 1` guard is guaranteed to reject — the build gets its required one path, and it resolves to a real 404, never to fake content. This disappears on its own the moment any category/topic's real page count grows past 1.

## Filtering

No client-side filter widget was added to any of these three pages. `/tin-tuc`'s "Category navigation" (item 4) is real server-rendered links to `/chuyen-muc/[slug]` — each of which is already a category-filtered, separately-paginated page — rather than a second, JS-driven re-filter of the same page's data. Mixing build-time pagination with a client-side filter over the same dataset would fight each other (the filter would need the *entire* unpaginated pool shipped to the client, defeating the pagination). The data model does support filtering (every article carries a `Category`), so this is a placement decision, not a capability gap.

## SEO

Every category and topic page has its own `generateMetadata` (title, description, canonical) — this already existed for page 1; the `trang/[page]` routes get their own metadata too (title suffixed "— Trang N", canonical pointing at that page's own URL), so paginated pages are distinct, indexable documents rather than duplicates of page 1.

## Empty states

- `/tin-tuc` with zero articles (pool minus the featured pick) — `EmptyState`, "Chưa có tin tức".
- `/chuyen-muc/[slug]` with zero articles in the category — `EmptyState` in place of the featured card and list.
- `/chu-de/[slug]` with zero articles in the stream (the honest `chuyen-doi-so` case today) — `EmptyState`, "Chưa có danh sách bài viết cho chủ đề này".
- An unknown category/topic slug — `notFound()` (existing `not-found.tsx`, unchanged), same as an out-of-range page.
