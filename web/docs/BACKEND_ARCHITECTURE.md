# Backend architecture

The production backend/database foundation added on top of the existing
13-phase frontend (domain model, data-access layer, media abstraction,
public routes, SEO/accessibility/responsive/performance audits — all
verified present in the working tree before this task started). This is a
**foundation**: schema, migration, repository/service layer, and a
development seed. It is deliberately **not wired into the live site** —
see "What this task does not wire up" at the bottom.

## Architecture decision: modular monolith, not microservices

Per the brief: a single Next.js application, PostgreSQL, an ORM, and a
repository/service layer inside it — no NestJS, no separate service, no
message queue. Nothing about this project's actual requirements (one
content team, one public site, moderate read volume, no independent
scaling need per subdomain) justifies the operational cost of a
microservice split. If a genuine technical need for one emerges later —
e.g. a media-processing worker that needs a different runtime or scaling
profile than the web app — that's a narrow, addable service *next to* this
monolith, not a reason to have split everything today.

## Dependency compatibility check (before installing anything)

Checked before adding any package, per the brief's explicit instruction:

| Check | Result |
|---|---|
| Next.js version | 16.3.4 (unchanged — nothing in this task touches `next`'s version) |
| React version | 19.2.8 (unchanged) |
| Node.js version | v22.22.2 |
| npm version | 10.9.7 |

**ORM choice: Prisma**, per the brief's stated default ("Ưu tiên Prisma
nếu không có lý do rõ ràng để dùng giải pháp khác") — nothing about this
codebase gave a reason to deviate.

**Prisma version: 7.10.0, pinned exactly for both `prisma` and
`@prisma/client`.** This needed a deliberate check: the `prisma` package's
npm `latest` dist-tag currently resolves to `8.0.0-rc.13` — a
**release-candidate**, not a stable release — while `@prisma/client`'s
`latest` tag resolves to the stable `7.10.0`. Installing both packages
without pinning would have put the CLI on an RC and the client on the
previous stable major, a mismatched pair. Both are pinned to `7.10.0`
explicitly instead, the newest **stable** release, confirmed via
`npm view prisma dist-tags` / `npm view @prisma/client dist-tags` rather
than trusting the `latest` tag blindly.

**Prisma 7 driver adapter — not optional.** Prisma 7 has no bundled query
engine binary for SQL databases anymore; every SQL connection goes through
an explicit driver adapter package. For PostgreSQL that's
`@prisma/adapter-pg` (wrapping the `pg` driver). This is why
`src/server/db/client.ts` constructs a `PrismaPg` adapter and passes it to
`new PrismaClient({ adapter })` instead of the older
`new PrismaClient({ datasources: { db: { url } } })` pattern — the latter
doesn't work on this version at all.

**Prisma 7 config file.** Connection URLs live in `prisma.config.ts`
(read from `.env` via `dotenv/config`), not in `schema.prisma`'s
`datasource` block anymore — that block now only declares the provider
(`provider = "postgresql"`). See `docs/ENVIRONMENT.md`.

**New dependencies added**, all installed after this same compatibility
check: `@prisma/adapter-pg`, `pg`, `dotenv`, `zod` (runtime), `prisma`,
`@types/pg`, `tsx` (dev). None require a Next.js/React/Node version change.

**Known, pre-existing, dev-only advisory.** `npm audit` reports 4 high
severity advisories, all inside `prisma` CLI's own transitive dependencies
(`@prisma/config` → `deepmerge-ts`, and a bundled `mysql2` driver the CLI
carries to support `db pull`/introspection against MySQL projects, unused
by this Postgres-only project). `prisma` is a `devDependency` — none of
this ships in the built application or runs in production. Left as a
known upstream item to watch for a patched Prisma release, not something
to route around with an unrelated dependency swap.

## Layering

```
Route Handler / Server Component
        ↓
Application Service   (src/server/services/*.ts)
        ↓
Repository            (src/server/repositories/*.ts)
        ↓
Prisma Client         (src/server/db/client.ts)
        ↓
PostgreSQL
```

**Repository**: pure data access, one file per aggregate root
(`articleRepository.ts`, `eventRepository.ts`, `mediaRepository.ts`,
`homepageRepository.ts`, `activityMapRepository.ts`,
`auditLogRepository.ts`). No business rules, no validation — a repository
method is a typed wrapper around a Prisma query/mutation and nothing more.

**Service**: the business rules a repository must never encode —
`articleService.ts` (status-transition legality, per-block validation,
revision snapshotting, audit logging), `eventService.ts` (real-time status
derivation — see below), `mediaService.ts` (usage-graph management),
`homepageService.ts` (placement resolution + automatic fallback),
`activityMapService.ts` (assembling the Activity Map's exact frontend
contract from `Province`/`ActivityStatistic`/`OverseasOrganization`).

Every one of the four named pairs from the brief (`ArticleService`/
`ArticleRepository`, `EventService`/`EventRepository`, `MediaService`/
`MediaRepository`, `HomepageService`) exists; `ActivityMapService` /
`ActivityMapRepository` were added as a fifth pair because Activity Map is
explicitly one of the things "Backend phải phục vụ" in the brief's goals
section, and section 8 is its own dedicated spec section — not
demonstrating that pairing would leave a named requirement unaddressed.

**Not built as full CRUD surfaces in this task**: `Category`, `Topic`,
`Tag`, `Platform`, `Gallery`, `User`, `Role`, `AuditLog` each have a
Prisma model and are read/written by whichever service above actually
needs them, but none gets its own dedicated repository/service pair yet.
Building a full admin-grade surface for every single entity ahead of any
CMS UI to call it from (explicitly out of scope — brief item 18) would be
speculative code with no caller. This is deliberate scope, not an
oversight — noted again in "Next task" below.

## Article block validation

Brief section 4: "Cần validation theo từng block type." Postgres `jsonb`
has no schema of its own, so `ArticleBlock.data`'s actual validation
happens in `src/server/validation/articleBlocks.ts` — a Zod schema per
block type (`PARAGRAPH`, `HEADING`, `IMAGE`, `GALLERY`, `YOUTUBE`, `QUOTE`,
`TABLE`, `EMBED`), each shaped identically to its frontend counterpart in
`src/domain/articleContent.ts`. `articleService.create`/`update` runs
every incoming block through `parseArticleBlockData()` before it reaches
the repository; a malformed block throws and the write never happens.

## Event status: never faked

Brief section 9: "Không được giả realtime." `Event.status` is a stored
column (an editor can set `CANCELLED`, which no clock could ever derive),
but `UPCOMING`/`LIVE`/`COMPLETED` are facts about `startAt`/`endAt` versus
the actual current time — this task builds no scheduler/cron to keep that
column continuously correct, so nothing here ever trusts the stored value
blindly for those three states:

- `eventService.deriveStatus(event, now)` is the one function that computes
  the true status from timestamps.
- `eventService.listAll()`/`listByProvince()`/`getBySlug()` all apply it to
  every row they return — a caller can never observe a stale `UPCOMING`
  for an event whose `endAt` already passed.
- `getBySlug()` additionally writes the corrected value back
  opportunistically (so the stored column self-heals over time as rows are
  read), while the list methods only correct the returned value without a
  write-back on every list query, to avoid turning every homepage load into
  a batch of writes.
- `homepageRepository.fallback.upcomingEvents()` filters by `endAt >= now`
  directly, not by the stored `status` column, for the same reason — a
  homepage fallback query is exactly the kind of read that must not
  reintroduce a "trust the cache" bug.

This exact gap — a list method trusting stored status while a single-item
lookup derived it correctly — was caught by an end-to-end smoke test
against real seeded data during this task (see `docs/DATABASE_SCHEMA.md`'s
sibling technical-debt notes), not left as a doc-only aspiration.

## Homepage configuration & fallback

Brief section 11: "phải giữ fallback tự động nếu CMS chưa cấu hình."
`homepageService.resolveHomepage()` resolves each of the eight sections
independently: if the active `HomepageConfiguration`'s matching
`HomepageSection` has any enabled, currently-active (`activeFrom`/
`activeUntil`-aware) `HomepagePlacement` rows, those are returned in
`order`; otherwise `homepageRepository.fallback.*` runs a "most recent N"
query for that section. The seed script seeds all eight sections with
**zero** placements deliberately, so a fresh database exercises the
fallback path everywhere by default — the homepage is provably never empty
just because nobody has opened a CMS UI that doesn't exist yet.

## Revisions

Every `articleService.create`/`update` call takes a full JSON snapshot of
the article (including its resolved relations) into `ArticleRevision`,
with an auto-incrementing per-article `version`. No revision-diff/restore
UI is built (brief section 5 explicitly doesn't ask for one) — the schema
and the write path both exist and are exercised (every seeded article gets
at least one revision row), ready for that UI whenever it's built.

## Audit log

`auditLogRepository.record()` is called from every state-changing service
method (`articleService.create/update/transitionStatus`,
`eventService.create/update/cancel`, `mediaService.registerAsset`). Per
brief section 12, nothing logs `GET`/read paths.

## What this task does not wire up

Per brief item 18 and the instruction not to remove `FixtureProvider`
yet:

- **`FixtureProvider` (`src/data-access/providers/fixtureProvider.ts`) is
  untouched** and remains the live data source for every page in the
  static export. Nothing in `src/app/`, `src/services/`, or
  `src/data-access/` imports anything from `src/server/` — the two layers
  coexist in the same repository without either depending on the other
  yet.
- **No `DatabaseProvider implements ContentProvider`** was written. Adding
  one — mapping `articleService`/`homepageService`/`activityMapService`
  output into the exact shapes `src/data-access/provider.ts` declares — is
  the natural next step once this foundation is reviewed, but doing it in
  the same task as the schema itself would mean the schema and its first
  real consumer get designed simultaneously with no chance to validate the
  schema independently first.
- **No CMS/admin UI, no real Google Drive/YouTube upload integration, no
  Facebook collector, no SSO, no production deployment.** All explicitly
  excluded by brief item 18.
- **`output: "export"` in `next.config.ts` is untouched.** The static
  export architecture and this database foundation are not in conflict for
  the *public site*: a future `DatabaseProvider` can be queried at **build
  time** (inside `generateStaticParams`/Server Components during
  `next build`), exactly like `FixtureProvider` is today — the site
  rebuilds and redeploys when content changes, the same pattern already in
  place. A CMS/admin UI, however, is inherently a live, request-time
  surface (auth, form submissions, mutations) that static export cannot
  serve at all; when that's built, the project will need either a second
  Next.js app (an admin app sharing this Prisma schema/database) or to drop
  static export entirely in favor of a Node-capable host with on-demand
  rendering. That decision is explicitly deferred, not made by default,
  since brief item 18 excludes both the CMS UI and production deployment
  from this task.

## Next task

1. Write `DatabaseProvider implements ContentProvider`, mapping this
   task's services into `src/data-access/provider.ts`'s exact interface,
   and a way to switch `src/data-access/index.ts`'s factory between
   `FixtureProvider` and `DatabaseProvider`.
2. Decide the CMS/admin hosting model (second app vs. dropping static
   export) — see "What this task does not wire up" above — before building
   any admin UI against this schema.
3. Real media upload (Google Drive API integration, or whatever storage
   backend is chosen) — `MediaService.registerAsset` is ready to receive
   real `providerFileId`/`width`/`height`/`size` once a real upload
   pipeline produces them.
4. A `Permission`/`RolePermission` table once there's an admin surface to
   enforce it against.
5. A scheduler/cron for `Article.scheduledAt` → `PUBLISHED` transitions
   (`articleRepository.listDuePublication()` already exists for a worker
   to call) and for periodic `Event` status reconciliation, if the
   opportunistic per-read correction in `eventService` turns out not to be
   frequent enough for some future consumer (e.g. an email digest that
   reads directly from SQL, bypassing the service layer).
