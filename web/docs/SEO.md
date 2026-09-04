# SEO architecture

## Central site config — `src/lib/siteConfig.ts`

Every hard-coded fact about the site's public identity lives in exactly one
place:

```ts
SITE_URL              // full origin + basePath, e.g. "https://lamtung48.github.io/congthongtin"
SITE_NAME              // "Cổng thông tin số Hội Sinh viên Việt Nam"
SITE_LOCALE             // "vi_VN"
SITE_DEFAULT_DESCRIPTION
absoluteUrl(path)       // "/tin-tuc/slug" -> `${SITE_URL}/tin-tuc/slug`
absoluteAssetUrl(url)    // passes an already-absolute URL through; prefixes a relative one
DEFAULT_OG_IMAGE        // the real logo, used as every page's fallback social image
```

Nothing else in the app hard-codes a domain, constructs a canonical URL by
hand, or repeats the site name as a literal string outside this file (and
the two builder modules that consume it, `lib/seo.ts` and
`lib/structuredData.ts`).

### Why `SITE_URL` isn't just `NEXT_PUBLIC_SITE_URL` read raw

GitHub Pages serves this app from `https://<owner>.github.io/<repo>`, not a
domain root (`docs/DEPLOYMENT.md`) — the site's real "origin" already has a
path segment. `next.config.ts` computes this once, the same place
`NEXT_PUBLIC_BASE_PATH` already was:

1. `NEXT_PUBLIC_SITE_URL` set in the environment always wins — the escape
   hatch for a future custom domain (a GitHub Pages CNAME), where the
   derived URL would be wrong.
2. Otherwise, in CI (`GITHUB_ACTIONS=true`), it's derived from
   `GITHUB_REPOSITORY` (`owner/repo` → `https://owner.github.io/repo`) —
   the same source `basePath` already reads, so the two can't drift apart.
3. Outside CI (local dev), it's `http://localhost:3000`.

**This is why `absoluteUrl()` does plain string concatenation
(`` `${SITE_URL}${path}` ``) instead of `new URL(path, SITE_URL)`.** A
path-absolute reference (anything starting with `/`) resolved against a
base URL that itself has a path — `.../congthongtin` — *replaces* that
base's path entirely per the URL spec, silently dropping `/congthongtin`.
Next.js's own `metadataBase` resolution has exactly this behavior for
`alternates.canonical`/`openGraph.url`/image URLs left as relative
strings. `metadataBase` is still set (`app/layout.tsx`, `new
URL(SITE_URL)`) as a Next.js safety net, but nothing in this app actually
relies on it to resolve a relative path — every canonical/OG/JSON-LD URL
is built as a full absolute string via `absoluteUrl()` first, so Next uses
it as-is. Verified by building once with `GITHUB_ACTIONS=true
GITHUB_REPOSITORY=owner/repo` set and grepping the exported HTML — every
canonical link, `og:*` URL, and sitemap `<loc>` includes `/congthongtin`.

## Page metadata — `src/lib/seo.ts`, `pageMetadata()`

One function every route's `generateMetadata`/`metadata` export calls:

```ts
pageMetadata({
  title,          // page-specific fragment only — the root layout's
                  // `title.template` (`%s · SITE_NAME`) appends the site name
  description,
  path,           // e.g. "/tin-tuc/dai-hoi-xii-khai-mac"
  noIndex?,       // true -> robots: { index: false, follow: false }
  image?,         // { url, alt } | null | omitted
  article?,       // { publishedTime, modifiedTime?, authorName? } -> og:type=article
  titleIsAbsolute?, // true only for the homepage — see below
})
```

Produces, from those inputs: `title`, `description`,
`alternates.canonical` (absolute), a complete `openGraph` block
(`type`, `title`, `description`, `url`, `siteName`, `locale`, `images`),
a matching `twitter` card, and `authors` when the article has one.

**Every route type covered**, each with its own real title/description
built from the actual entity (not a copy-pasted generic string):

| Route | File | Title source |
|---|---|---|
| Home | `app/page.tsx` | site name (see below) |
| Article | `app/tin-tuc/[slug]/page.tsx` | `article.title` |
| News index (+ paginated) | `app/tin-tuc/`, `.../trang/[page]/` | static / `"Tin tức — Trang N"` |
| Category (+ paginated) | `app/chuyen-muc/[slug]/` | `category.name` |
| Topic (+ paginated) | `app/chu-de/[slug]/` | `topic.name` |
| Locality | `app/dia-phuong/[slug]/page.tsx` | `locality.name` |
| Unit | `app/don-vi/[slug]/page.tsx` | `unit.name` |
| Event | `app/su-kien/[slug]/page.tsx` | `event.title` |
| Video index | `app/video/page.tsx` | static |
| Search | `app/tim-kiem/page.tsx` | static, `noIndex: true` |

A "not found" branch (`generateMetadata` returning early when
`getXBySlug()` resolves to `null`) sets `noIndex: true` on every dynamic
route — a slug that doesn't exist never gets indexed.

### The homepage's one exception — `titleIsAbsolute`

`app/page.tsx`'s title *is* the root layout's `title.default`
("Cổng thông tin số — Hội Sinh viên Việt Nam") — running it through
`title.template` would duplicate the site name
("X · Cổng thông tin số Hội Sinh viên Việt Nam", where X is already that).
`titleIsAbsolute: true` emits `title: { absolute: title }`, which Next
skips the template for; `openGraph.title`/`twitter:title` are unaffected
either way, since those never go through `title.template` to begin with.
Verified in the built HTML: `<title>Cổng thông tin số — Hội Sinh viên
Việt Nam</title>`, not doubled.

### Social image — every page gets one

`image` omitted (the common case) falls back to `DEFAULT_OG_IMAGE` — the
real site logo (`public/images/hsv-logo.png`, 1000×1000, a real asset, not
a placeholder), resolved to an absolute URL via `absoluteAssetUrl()`. No
page ships with *no* share image. `image: null` (distinct from omitting
it) is the escape hatch for a page that genuinely shouldn't advertise
one — nothing in this app needs that today.

**Why the logo and not a designed 1200×630 banner:** no such asset exists.
Fabricating one — or claiming fake dimensions — is exactly the "schema
faked / fields without data" this task rules out. The logo is real and
public; a proper OG banner is a design task for later, not something to
invent here. `DEFAULT_OG_IMAGE.width`/`height` are the file's real
dimensions (1000×1000), not the conventional 1200×630 OG size.

**Why article pages don't have their own image today:** `resolveImageUrl()`
(`lib/media/resolveMedia.ts`) is *intentionally* stubbed to always return
`undefined` — no Drive/YouTube integration exists yet
(`docs/MEDIA_ARCHITECTURE.md`). Every article's `pageMetadata()` call
already asks for `article.coverImage`'s resolved URL; when that's
`undefined` (always, today), the page correctly falls through to
`DEFAULT_OG_IMAGE` instead of a fabricated per-article image. The moment
real image resolution is wired up, article pages get real per-article OG
images with no code change here — `pageMetadata()` already accepts
whatever `resolveImageUrl()` returns.

## Article metadata — real data only

`app/tin-tuc/[slug]/page.tsx`'s `generateMetadata` reads the actual
`Article` (`getArticleBySlug(slug)`) and maps it directly:

```
title           = article.title
description     = article.lead ?? article.title
article.publishedTime = article.publishedAt
article.modifiedTime  = article.updatedAt
article.authorName    = article.author?.name
image            = resolved cover image, or DEFAULT_OG_IMAGE (see above)
```

Nothing here is invented — a field that doesn't exist on the article
(`article.author`, `article.updatedAt`) is simply omitted, not defaulted
to a placeholder string.

## Category / topic / locality metadata

Same `pageMetadata()` path, real entity data:

- **Category** (`app/chuyen-muc/[slug]/page.tsx`): title = `category.name`,
  description names the category. Paginated pages
  (`.../trang/[page]/page.tsx`) get their own canonical
  (`pagedHref(categoryHref(slug), page)`) and a page-numbered title —
  distinct, indexable URLs, not a single canonical claimed by every page.
- **Topic** (`app/chu-de/[slug]/page.tsx`): same shape, `topic.name`.
- **Locality** (`app/dia-phuong/[slug]/page.tsx`): title = `locality.name`,
  description built from the locality's real activity summary
  (`summaryText(locality)`), not a generic sentence.

## Canonical URLs

Every `pageMetadata()` call sets `alternates.canonical` to the page's own
`absoluteUrl(path)` — including paginated listing pages, which canonicalize
to *themselves* (page 2 doesn't point back at page 1; they're genuinely
different content). Verified in the exported HTML for every route type —
see the table above.

## Open Graph & Twitter

Every page gets a complete `openGraph` block (`type`, `title`,
`description`, `url`, `siteName`, `locale: "vi_VN"`, `images`) and a
matching `twitter: { card: "summary_large_image", ... }`. `og:type` is
`"article"` only for actual content pages (`/tin-tuc/[slug]`) via the
`article` param — never for listing/search pages, which stay
`"website"`.

## Robots

- **Per-page**: `noIndex: true` → `robots: { index: false, follow: false }`
  meta tag. Used by every "not found" branch and by `/tim-kiem` (a search
  page has no canonical content of its own to rank).
- **Site-wide**: `app/robots.ts` — `Allow: /` for every user agent, plus a
  pointer to the sitemap. Deliberately does **not** `Disallow` `/tim-kiem`:
  blocking a URL in `robots.txt` stops it from being *crawled*, so a
  crawler could never see that page's own `noindex` meta tag — Google
  documents this as a way blocked URLs end up indexed anyway (with no
  snippet, from external links alone). The correct pattern is what's
  here: let it be crawled, let the per-page `noindex` do its job.

## Sitemap — `app/sitemap.ts`

One entry per real, indexable static page, built from the exact same
slug-lists and page-count helpers each route's own `generateStaticParams()`
uses (`getArticleSlugs`, `getCategories` + `getCategoryPageCount`,
`getTopics` + `getTopicPageCount`, `getLocalitySlugs`, `getUnitSlugs`,
`getEvents`) — never a second, hand-maintained list that could drift from
what actually gets built. `/tim-kiem` is the one route left out, matching
its `noIndex`. Articles carry a real `lastModified`
(`article.updatedAt ?? article.publishedAt`); every other content type
doesn't have a clean modification timestamp in its domain model, so
`lastModified` is simply omitted there rather than guessed.

`export const dynamic = "force-static"` on both `sitemap.ts` and
`robots.ts` — required for `output: "export"` (`docs/DEPLOYMENT.md`):
neither depends on per-request data, so both are safe to emit once at
build time as static files.

## Structured data (JSON-LD)

### BreadcrumbList — every page via `<Breadcrumb>`

`components/ui/Breadcrumb.tsx` emits a `BreadcrumbList` alongside the
visible trail on every route that renders one (which is every route below
the homepage — `PageShell` always renders `<Breadcrumb>`). `item` on each
non-terminal entry is `absoluteUrl(item.href)` — an absolute URL, not the
raw relative `href` the visible `<Link>` uses (a real bug this task fixed:
Google's structured-data guidance expects an absolute URL here).

### NewsArticle — `/tin-tuc/[slug]` only

Rendered only where it's actually appropriate — a real content article,
not a listing or profile page. Built entirely from the same `Article`
fetched for the page itself:

```json
{
  "@context": "https://schema.org",
  "@type": "NewsArticle",
  "headline": article.title,
  "description": article.lead,
  "url": absoluteUrl(article.url),
  "mainEntityOfPage": { "@type": "WebPage", "@id": absoluteUrl(article.url) },
  "datePublished": article.publishedAt,
  "dateModified": article.updatedAt ?? article.publishedAt,
  "publisher": { "@type": "Organization", "name": ..., "logo": { "@type": "ImageObject", "url": ... } },
  "author": { "@type": "Person", "name": article.author.name },   // only if article.author exists
  "image": [absoluteAssetUrl(imageUrl)]                            // only if resolveImageUrl() resolved one
}
```

`author` and `image` are conditionally spread in, not defaulted — an
article with no credited author (some don't) simply has no `author` key,
rather than a fabricated "Ban Biên tập" placeholder for every article
regardless of truth.

`publisher` reuses the real org name already fetched for the site's
`Organization` schema (`homepage.footer.orgName`, via the already
`cache()`-wrapped `getHomepage()` — calling it again here doesn't
re-fetch) rather than a second hard-coded copy of the string.

### Organization — site-wide, once, from `app/layout.tsx`

Appropriate here: this **is** the official portal of a real organization.
Built in `lib/structuredData.ts` (`organizationJsonLd()`) from
`FooterConfiguration` — the exact same real `orgName`/`orgDescription`/
`address` already fetched for the visible footer, not a second data
source:

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Hội Sinh viên Việt Nam",
  "description": "Cổng thông tin số của Trung ương Hội Sinh viên Việt Nam.",
  "url": SITE_URL,
  "logo": DEFAULT_OG_IMAGE.url,
  "address": { "@type": "PostalAddress", "streetAddress": "62 Bà Triệu, Hoàn Kiếm, Hà Nội", "addressCountry": "VN" }
}
```

**Deliberately omitted**: `sameAs` (social profile links) and
`telephone`/`email`. The footer's own copy says exactly why —
"Tài khoản chính thức chờ xác nhận — chưa gắn liên kết" (social accounts
pending confirmation, not yet linked) and "Điện thoại và email liên hệ
chờ xác nhận" (phone/email pending confirmation). There is no real URL or
number to put there; inventing one is precisely the fake schema field
this task rules out.

## What's still fixture-backed, not "real"

Same honesty this project's other `docs/*.md` files already commit to:

- Every URL resolves correctly and every field is real *data* — but the
  data itself is fixture data (`docs/DATA_ACCESS.md`), not a live CMS. An
  article's `publishedAt`/`author`/`updatedAt` are real fields sourced
  correctly, on fictional sample content.
- `DEFAULT_OG_IMAGE` is the real logo, not a purpose-built 1200×630 social
  card — see above.
- `resolveImageUrl()` always returns `undefined` today (no Drive/YouTube
  integration) — no article has demonstrated a real per-article OG image
  end-to-end. The wiring is in place and correct; it has nothing to point
  at yet.
- No `sameAs` on the Organization schema — no real social links exist
  (see above), not an oversight.

## Verification

`npm run build`, `npx tsc --noEmit`, `npx eslint .` — all clean. The
basePath-correctness claims above were verified concretely, not assumed:
built once with `GITHUB_ACTIONS=true GITHUB_REPOSITORY=<owner>/<repo>` set
and inspected the exported HTML/XML directly —
`out/robots.txt`'s `Sitemap:` line, every `<loc>` in `out/sitemap.xml`,
every page's `<link rel="canonical">` and `og:*`/`twitter:*` URLs, and
both JSON-LD blocks on an article page all correctly include the
`/congthongtin` path segment.

## A separate, pre-existing bug found while verifying this

While checking that `og:image` URLs include the GitHub Pages basePath
correctly (they do — `absoluteUrl()` handles it), the same build revealed
that `next/image`'s own `<Image src="/images/hsv-logo.png">` in `Header.tsx`
and `Footer.tsx` does **not** get the basePath prefix in the exported
static HTML (`src="/images/hsv-logo.png"`, missing `/congthongtin`) —
despite `next.config.ts`'s own comment claiming `next/image` applies
`basePath` automatically. This would 404 the logo on the real deployed
site. It's unrelated to this task's scope (SEO metadata/structured data,
not component image rendering) and was not fixed here — flagged
separately as a suggested follow-up task.
