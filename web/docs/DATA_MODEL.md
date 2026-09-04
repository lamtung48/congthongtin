# Data Model

Domain entities live in `src/domain/*.ts` and are re-exported from `src/domain/index.ts`.
They describe the business, not the current fixture — nothing here imports from
`src/data-access/fixtures/`, and nothing here depends on Prisma or any specific
database. The goal: swapping the fixture provider for a real API/DB/CMS later
should never require changing a type in this document.

Two field-naming conventions run through every entity:

- `id: ID` (`string`) — opaque, assigned by whatever system owns the record.
  In the fixture provider `id` happens to equal `slug`; a real backend would
  issue its own ids and this is where that seam sits.
- Dates are `ISODateTime` (`string`, ISO 8601) everywhere in the domain. No
  entity stores a pre-formatted display string. Components format on render
  via `formatDateVi()` / `formatDateTimeVi()` (`src/lib/formatDate.ts`) — see
  "Why dates are ISO, not display strings" below.

## Entity reference

### Category — `src/domain/taxonomy.ts`
Primary classification of an article or video. Exactly one per item.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| id | ID | no | |
| slug | Slug | no | |
| name | string | no | Display label, e.g. "Tình nguyện" |

**Extension point:** this used to be a closed TypeScript union
(`NewsCategory`). It's now an open entity because a real CMS stores
categories as rows, not code — new categories shouldn't require a deploy.

### Topic — `src/domain/taxonomy.ts`
A curated editorial theme with its own landing page (e.g. "Đại hội XII" →
`/chu-de/dai-hoi-xii`). Powers "Chủ đề nổi bật" (`TrendingTopics`) and the
search overlay's topic chips.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| id | ID | no | |
| slug | Slug | no | |
| name | string | no | |
| articleCount | number | no | Denormalized count, as the prototype fixture already was |
| url | string | no | Landing page path |

### Tag — `src/domain/taxonomy.ts`
Freeform keyword, many per article, no landing page.

| Field | Type | Nullable |
|---|---|---|
| id | ID | no |
| slug | Slug | no |
| name | string | no |

**Extension point:** defined for `Article.tags` but no current homepage
section reads raw tags — there was no equivalent concept in the old fixtures
to migrate. Wire it up when a feature needs it (e.g. an article detail page).

### Author — `src/domain/people.ts`
| Field | Type | Nullable |
|---|---|---|
| id | ID | no |
| name | string | no |
| title | string | yes |
| avatar | MediaAsset | yes |

Only the homepage hero uses this today (`HeroContent.author`, "Ban Biên
tập"). `Article.author` is defined for the future article detail page.

### Organization — `src/domain/people.ts`
A Hội Sinh viên unit that can publish news or report activity.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| id | ID | no | |
| name | string | no | |
| level | `OrganizationLevel` (`"province" \| "university" \| "overseas"`) | no | |
| province | Province | yes | Set when `level` is `"province"` or `"university"` |
| country | string | yes | Set when `level` is `"overseas"` |
| url | string | yes | Unit's own site — absent renders "Trang đơn vị chưa có" |

**Extension point:** `province`/`country` are not populated by the current
`LocalNewsEntry` read model (see below) — `LocalNewsEntry` carries `orgName`
and `place` as flat strings instead of a full `Organization` reference,
because the old fixture never linked local-news orgs to real `Province`
records. Wiring that up is future work, not a behavior change made here.

### Province — `src/domain/geo.ts`
One of Vietnam's 34 provinces/centrally-run cities.

| Field | Type | Nullable |
|---|---|---|
| id | ID | no |
| slug | Slug | no |
| name | string | no |
| lat | number | no |
| lon | number | no |

**Not yet backed by its own fixture collection.** The activity map's 34
provinces exist today only inside the map's own read model
(`ActivityMapProvince`, below) — a real backend would have one `provinces`
table that both the map and `Organization.province` join against. This type
exists so that join has a defined shape to target; today it's a documented
gap, not a used fixture.

### OverseasOrganization — `src/domain/geo.ts`
A national-level Hội Sinh viên Việt Nam chapter operating outside Vietnam.

| Field | Type | Nullable |
|---|---|---|
| id | ID | no |
| name | string | no |
| country | string | yes |

Same status as `Province`: defined, and structurally mirrored by
`ActivityMapOverseasCountry` in the map's read model, but not yet backed by
its own fixture collection outside the map dataset.

### MediaAsset — `src/domain/media.ts`
A single visual asset. `url` and `placeholderNote` are independently
optional: "asset exists, no alt text" and "no asset yet" are both
representable.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| id | ID | yes | |
| kind | `"image" \| "video" \| "illustration"` | no | |
| url | string | yes | Absent for every asset in the current fixture — no real photography was ever supplied to this project |
| alt | string | yes | |
| width / height | number | yes | |
| caption | string | yes | |
| locationLabel | string | yes | |
| capturedAt | ISODateTime | yes | |
| placeholderNote | string | yes | Shown by `<MediaPlaceholder need={...} />` whenever `url` is absent |

**Contract:** every consumer renders `MediaPlaceholder` when `url` is unset.
Nothing in this task changes that rendering — only where `placeholderNote`
comes from (now `MediaAsset.placeholderNote` via props, previously a raw
fixture field imported directly into the component).

### Gallery — `src/domain/media.ts`
A curated, ordered collection of media assets — the homepage photo wall.

| Field | Type | Nullable |
|---|---|---|
| id | ID | no |
| title | string | no |
| description | string | yes |
| items | MediaAsset[] | no |

### Article / ArticleSummary — `src/domain/article.ts`
`ArticleSummary` is what every listing/rail on the homepage actually needs;
`Article` extends it with the fields a detail page (`/tin/[slug]`, not yet
built) would render.

**ArticleSummary**

| Field | Type | Nullable | Notes |
|---|---|---|---|
| id | ID | no | |
| slug | Slug | no | |
| url | string | no | Precomputed via `articleHref()` so components never build routes themselves |
| title | string | no | |
| lead | string | yes | Not every summary shape needs a lead (e.g. `FeaturedNewsResult.secondary` never showed one) |
| category | Category | no | |
| publishedAt | ISODateTime | no | |
| coverImage | MediaAsset | yes | |
| isTextOnly | boolean | yes | Article has no image slot at all (renders as a text-only card) |
| place | string | yes | Locality-flavored summaries only (story rail) |
| organization | Organization | yes | Not currently populated — see `LocalNewsEntry` note above |

**Article** adds: `status` (`"draft" \| "published" \| "archived"`), `body`,
`topics`, `tags`, `author`, `province`, `updatedAt`, `readingTimeMinutes`.
**Extension point:** `Article` has no fixture or provider method yet — it's
scoped for the future article detail page, which is out of scope for this
task per the audit's route-priority finding.

### Video — `src/domain/video.ts`
| Field | Type | Nullable | Notes |
|---|---|---|---|
| id | ID | no | |
| slug | Slug | yes | |
| title | string | no | |
| description | string | no | |
| category | Category | no | |
| durationLabel | string | no | Display-ready ("04:57", or "—" when unknown) |
| publishedAt | ISODateTime | no | |
| externalId | string | yes | e.g. a YouTube video id — absent means no source is connected yet |
| thumbnail | MediaAsset | yes | |

**Why `durationLabel` and not `durationSeconds`:** the fixture data was
hand-authored as a display string and nothing reads a numeric duration
today. Storing seconds and formatting on render would be more "correct" but
is speculative for a field with zero current consumers of the raw value —
documented here as the natural next step if a real video backend ever
supplies seconds.

### Event — `src/domain/event.ts`
| Field | Type | Nullable |
|---|---|---|
| id | ID | no |
| slug | Slug | no |
| title | string | no |
| place | string | no |
| startAt / endAt | ISODateTime | no |
| url | string | yes |
| cover | MediaAsset | yes |
| capacity | number | yes |
| registered | number | yes |

`EventStatus` (`"live" \| "upcoming" \| "soldout" \| "completed"`) is **not**
a field on `Event` — it's computed against "now" at render time by
`buildEventView()` (`src/lib/eventView.ts`), unchanged from before this task.
This is why `LiveEvents` still reads the real clock client-side rather than
receiving a status from the server: event status is time-relative, not
stored data.

### Platform — `src/domain/platform.ts`
| Field | Type | Nullable | Notes |
|---|---|---|---|
| id | ID | no | |
| slug | Slug | no | |
| name | string | no | |
| url | string | no | |
| description | string | no | |
| category | `PlatformCategory` (`"conference" \| "training" \| "sv5tot" \| "volunteer" \| "data"`) | no | |
| status | `PlatformStatus` (`"live" \| "active" \| "maintenance" \| "open" \| "unavailable" \| "soon"`) | no | Which values are meaningful for a given category is a view-layer concern |
| accessLevel | string | no | |
| metric | string | yes | e.g. "14 khoá đang mở" |
| liveActivityNote | string | yes | Shown only while `status === "live"` |

**Extension point / known simplification:** `status` is a single flat union
shared by every category, even though a real backend might model each
category's lifecycle differently. The per-category display copy (CTA label,
note text, badge) lives in `buildPlatformView()`
(`src/lib/view/platformView.ts`) — a straight port of the five separate
`conferencePlatform()`/`trainingPlatform()`/... functions that used to live
in `lib/data/platforms.ts`, now keyed off `Platform.status` instead of a
literal argument at the `EcosystemBento` call site. This also fixes an
audit-flagged inconsistency: platform status used to be hardcoded UI-code
(`conferencePlatform("live")`), not data.

### ActivityStatistic — `src/domain/activity.ts`
Reported activity numbers for one subject (a `Province` or
`OverseasOrganization`) within one reporting period — the normalized shape a
real backend would store.

| Field | Type | Nullable |
|---|---|---|
| id | ID | no |
| subjectId | ID | no |
| period | `{ label, from, to }` | no |
| activityCount / articleCount / studentCount | number | yes |
| categoryDistribution | `Record<string, number>` | yes |
| latestArticle | `{ title, publishedAt }` | yes |
| reported | boolean | no |
| updatedAt | ISODateTime | no |

**This entity has no provider method and is not what the activity map UI
renders.** See "The activity map read model" below — this is the honest,
normalized target shape; the map keeps using its existing denormalized
projection because rewriting it was explicitly out of scope.

### HomepageConfiguration — `src/domain/homepage.ts`
CMS-managed structural content for the homepage — everything that isn't an
article/video/event/platform listing (those have their own provider
methods).

| Field | Type |
|---|---|
| nav | NavItem[] |
| hero | HeroContent |
| trendingTopics | Topic[] |
| footer | FooterConfiguration |
| search | `{ corpus: SearchSuggestion[] }` |

`HeroContent` holds every field `Hero.tsx` used to hardcode directly in JSX
(an audit-flagged inconsistency with every other section) — eyebrow,
headline/accent, lead, author, reading time, topic label, the precomputed
article URL, secondary CTA, and hero media. `FooterConfiguration` and
`SearchSuggestion` are documented inline in `src/domain/homepage.ts`.

## The activity map read model

`src/domain/activity.ts` also exports `ActivityMapCategory`,
`ActivityMapArchipelago`, `ActivityMapProvince`, `ActivityMapOverseasCountry`,
and `ActivityMapData` (aliased as `ActivityMapDataset`, the return type of
`getActivityMap()`). These are **not** derived from `Province` /
`OverseasOrganization` / `ActivityStatistic` at runtime — they are moved
field-for-field, unchanged, from the pre-existing `ActivityMap*` types in the
old `lib/types.ts`.

This is intentional, not an oversight: the task's instructions for the
activity map were "chỉ tách data source, không rewrite logic" (only decouple
the data source, don't rewrite logic). `ActivityMapSection`, `VietnamMapSvg`,
`useActivityMapData`, and `provinceValue` all key off exact field names like
`province_name`, `activity_count`, `category_distribution`, `unit_url` —
rewriting those to normalized domain types would touch every one of those
files' internals, which is exactly what was ruled out. A real backend would
assemble `ActivityMapData` by joining `Province` + `OverseasOrganization` +
`ActivityStatistic` server-side; that join is future work, tracked here as a
documented gap rather than done speculatively.

## Why dates are ISO, not display strings

Every domain date field is `ISODateTime`. The pre-existing fixtures stored
dates as hand-typed `"dd.MM.yyyy"` display strings — convenient for a
prototype, but not something a real API/DB would ever return. Components now
call `formatDateVi()` / `formatDateTimeVi()` (`src/lib/formatDate.ts`) at the
point they render a date, the same pattern `buildEventView()` already used
for event times. This is the one behavioral-looking change in this task that
isn't purely mechanical — it was necessary for the domain types to be
"production-oriented" as required, and was verified with Playwright to
produce byte-identical rendered text (see `docs/DATA_ACCESS.md` for how it
was verified).
