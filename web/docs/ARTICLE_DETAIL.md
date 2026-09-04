# Article detail page — `/tin-tuc/[slug]`

## Layout

Breadcrumb → category → headline (H1) → sapo → author/dates → cover image →
body → share actions → tags → related articles → prev/next → Footer (global,
from `app/layout.tsx`). Two column widths, not one: `--container-text`
(720px) for the headline/sapo/paragraph/heading/quote text, `--article-wide`
(960px, a local CSS var set on the page's own `.wrap`) for the cover image
and any "wide" body block — see `page.module.css` and
`ArticleBody.module.css`. Nothing on the page is as wide as the full
`--container-wide` shell the breadcrumb sits in.

## The block system

`src/domain/articleContent.ts` defines `ArticleBlock`, a discriminated union
of 8 typed blocks: `paragraph` (rich text as `TextRun[]` — bold/italic/link,
never raw HTML), `heading` (H2/H3 only — the article's own H1 is the
headline), `image`, `gallery`, `youtube`, `quote`, `table`, `embed`.
`Article.body` is `ArticleBlock[] | undefined`. `ArticleBody`
(`src/components/article/blocks/ArticleBody.tsx`) is the only renderer —
nothing else turns a block into markup, and nothing anywhere in this feature
calls `dangerouslySetInnerHTML` except the two existing JSON-LD scripts
(`Breadcrumb`'s and this page's own `NewsArticle` block), which serialize
internal typed data, not content.

`embed` is the one block that could theoretically carry a live third-party
URL. It never renders injected markup either way: `status: "ready"` renders
a sandboxed `<iframe src>` (`sandbox="allow-scripts allow-same-origin
allow-popups allow-popups-to-escape-sandbox"`), `status: "missing"` (the
default in every fixture today, matching the rest of the app's "not
connected yet" convention) renders a placeholder box instead.

Only `YoutubeBlockView` needs client-side state (thumbnail vs. "now
playing"), so it's the one block component pulled out of the otherwise
server-rendered `ArticleBody`. It reuses `MediaVideo` — the same
click-to-play contract, including the iframe's accessible `title`, as the
homepage's video section.

## Data access

Three `ContentProvider` methods back this page, all resolved from one
shared, deduplicated pool (`allArticles()` in `fixtureProvider.ts`) so they
can never disagree about which slugs exist:

- `getArticleBySlug` / `getArticleSlugs` (existing) — the pool now also
  includes the homepage Hero's article (`HERO_SLUG`, previously *not*
  resolvable — `/tin-tuc/dai-hoi-xii-khai-mac` 404'd even though the
  homepage linked to it) and merges in `ARTICLE_CONTENT[slug]` (body,
  author, tags, topics, `updatedAt`) where authored.
- `getRelatedArticles(slug, limit)` — same category, most recent first,
  current article excluded.
- `getAdjacentArticles(slug)` — `{ previous, next }` by `publishedAt` order.

The Article page (`src/app/tin-tuc/[slug]/page.tsx`) only imports from
`@/services/contentService` — never a fixture file directly, same rule as
every other route.

## Fixture content

Only two articles have a full `body` today, authored in
`src/data-access/fixtures/articleContent.ts`:

- `dai-hoi-xii-khai-mac` (the homepage Hero's article) — exercises all 8
  block types at once.
- `tuyen-duong-112-sv5t` (FeaturedNews' main card) — a shorter,
  independently-authored body proving the block system isn't special-cased
  to one article.

Every other article still has no `body`, and the page correctly falls back
to the pre-existing "Nội dung bài viết đang được biên tập" empty state —
this is authoring/CMS work, not something the block renderer needs to do
anything about.

## SEO

`pageMetadata()` (`src/lib/seo.ts`) gained optional `image` and `article`
params: when passed, it emits `og:type=article`,
`article:published_time`/`modified_time`/`author`, a
`twitter:card=summary_large_image` when an image resolves, and top-level
`Metadata.authors`. The Article page also emits a `NewsArticle` JSON-LD
block (headline, description, dates, author, image) next to `Breadcrumb`'s
existing `BreadcrumbList` block. Today `image` is `undefined` for every
article because `resolveImageUrl()` is still stubbed (see
`docs/MEDIA_ARCHITECTURE.md`) — the fields are correctly wired and will
start populating the moment a real resolver exists, no page-level change
needed.

## Accessibility

Heading hierarchy is enforced structurally, not by convention: the page
renders exactly one H1 (the headline), and `HeadingBlock` only allows H2/H3
in the body — a CMS producing this union cannot accidentally skip a level
into an H1. Every image goes through `MediaImage`, which always has an
`alt` (empty string is a deliberate choice for decorative/placeholder
media, never omitted). Tables use `<caption>`/`scope="col"` and sit in an
`overflow-x: auto` wrapper instead of squeezing on mobile. The `youtube`
block's iframe gets a real `title` via `MediaVideo`'s existing contract.
Share/copy-link and prev/next are plain `<button>`/`<Link>` elements, so
focus and keyboard activation come for free from the browser rather than
needing bespoke handling.

## Error states

- **Article doesn't exist** — `notFound()` renders the existing
  `not-found.tsx` (unchanged).
- **Media fails to load** — already handled by `MediaImage` itself
  (falls back to `MediaPlaceholder` on a 404/network error); nothing
  article-specific was needed here.
- **Related articles empty** — `RelatedArticles` renders `EmptyState`
  instead of an empty list (this is the actual behavior for
  `dai-hoi-xii-khai-mac` today: it's the only article in its category).

## Shared-image view transition

`src/lib/viewTransition.ts` (`articleCoverTransitionName`) derives a CSS
`view-transition-name` from an article's own `url`, so a card and the
Article Hero always compute the same name from the same field — no
separate id to keep in sync. `src/lib/hooks/useArticleTransitionClick.ts`
is the click handler: where `document.startViewTransition` exists, it
navigates through it (via `router.push` inside `startTransition`); on
unsupported browsers or a modified click (middle-click,
ctrl/cmd/shift/alt), it does nothing and the `<Link>` navigates normally —
purely additive, never a requirement for the link to work.

**Wired today**: the homepage Hero's cover image and FeaturedNews' main
card cover image, both linking into the two showcase articles above.
**Not wired**: LatestNews' cards, the story rail, `ArticleList` (used by
`/tin-tuc`, `/chuyen-muc/[slug]`, related articles) — these still navigate
as plain links. Extending coverage to them is a mechanical repeat of the
same two-line change (an `onClick` plus a `style`), not a new mechanism.

`globals.css` disables the View Transition API's default full-page
cross-fade (`::view-transition-old(root)`/`::view-transition-new(root) {
animation: none }`) so only the named cover image morphs; the rest of the
page swaps instantly. The fallback for every browser regardless of API
support is the cover image's existing `hsvMediaIn` keyframe (opacity +
scale), already the codebase's standard entrance animation and already
disabled under `prefers-reduced-motion: reduce` via the existing
`--dur-slow` token override — no separate reduced-motion handling was
needed here.

Known caveat: `document.startViewTransition`'s callback resolves as soon as
`router.push` is scheduled, not once the destination route has actually
finished rendering. For a statically-exported, already-prefetched route
that's a frame or two, not a visible stall — but it's not a guarantee the
API itself gives, and a slower route (a live CMS fetch, say) could show a
visibly premature transition. Documented here rather than worked around,
since working around it reliably needs either a loading-state convention
this app doesn't have yet or Next's own (still-experimental)
`experimental.viewTransition` integration.
