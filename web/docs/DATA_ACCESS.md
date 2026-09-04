# Data Access Layer

## The four-layer flow

```
UI Component
    │  props only — never imports a fixture or a provider class
    ▼
Service            src/services/homepageService.ts
    │  one function per homepage need (getHomepage, getFeaturedArticles, ...)
    ▼
Provider           src/data-access/provider.ts (ContentProvider interface)
    │  the swap point
    ▼
FixtureProvider    src/data-access/providers/fixtureProvider.ts
    reads           src/data-access/fixtures/*.ts
```

Each layer only knows about the one below it:

- **Components** (`src/components/**`, `src/app/page.tsx`) call functions
  exported from `src/services/homepageService.ts` (or, for Server
  Components composed in `page.tsx`, receive the results as typed props).
  No component imports anything under `src/data-access/fixtures/`.
- **Services** (`src/services/homepageService.ts`) are one-line
  pass-throughs to `getContentProvider()` today. They exist as their own
  layer — not merged into the provider — because this is the seam where
  cross-cutting concerns (caching, request-scoped auth, response shaping for
  a future GraphQL/BFF layer) get added later without touching providers or
  components.
- **`ContentProvider`** (`src/data-access/provider.ts`) is the port every
  data source implements. It's shaped around the homepage's actual needs —
  nine required methods plus `getGallery()` — not a generic CRUD interface.
  Add a method here only when a new section needs a new shape of data.
- **`FixtureProvider`** (`src/data-access/providers/fixtureProvider.ts`) is
  the only module allowed to import `src/data-access/fixtures/*.ts`
  directly. Every method returns a `Promise`, even though the fixture reads
  are synchronous — so it's interchangeable with a real provider without any
  caller-side change.

## Lifecycle

`src/data-access/index.ts` exports `getContentProvider()`, a lazily
constructed singleton:

```ts
let instance: ContentProvider | null = null;

export function getContentProvider(): ContentProvider {
  if (!instance) instance = new FixtureProvider();
  return instance;
}
```

- **Server Components** (`page.tsx` and the mostly-static sections it
  composes — `TrendingTopics`, `FeaturedNews`, `EcosystemBento`) call the
  service functions directly in an `async` component body and await them in
  parallel with `Promise.all`, then pass the results down as props. This
  runs once per request (or once at build time for a fully static route, as
  is currently the case — `next build` prerenders `/` since none of the
  fixture reads are request-dependent).
- **Client Components** that need to fetch after mount — today, only the
  activity map (`useActivityMapData`) — call a service function
  (`getActivityMap()`) directly from a `useEffect`, exactly as it called
  `fetch("/data/activity-map.json")` before. The provider singleton is
  created lazily on first use in whichever environment (server or browser)
  calls it first; nothing about it is server-only or client-only by
  construction.
- The singleton lives for the lifetime of the module — in practice, one
  Node.js server process. There is no cache invalidation because
  `FixtureProvider` has nothing to invalidate; a `DatabaseProvider` or
  `ApiProvider` would own its own caching/revalidation strategy internally,
  behind the same `ContentProvider` interface.

## Why the activity map is the one exception

Every other section's data is available synchronously at request time
(it's a TypeScript array), so `page.tsx` fetches it server-side and passes
it down as a prop — no client-side loading state needed. The activity map
is different on purpose: `useActivityMapData` still fetches on the client,
producing the same `loading` → `loaded`/`empty`/`error`/`geo` states it
always has. This was kept exactly as-is because the task's constraint for
this feature was "chỉ tách data source, không rewrite logic" — only
`useActivityMapData.ts`'s two lines that called `fetch("/data/activity-map.json")`
directly changed, to call `getActivityMap()` instead:

```diff
- const dr = await fetch("/data/activity-map.json");
- if (!dr.ok) throw new Error("data");
- data = (await dr.json()) as ActivityMapData;
+ data = await getActivityMap();
```

`FixtureProvider.getActivityMap()` does the same `fetch` internally today —
so this refactor changes nothing observable yet, but it means the eventual
switch to a real endpoint touches one method in one file, not a component.

The topojson world-geometry fetch (`/data/countries-110m.json`) was
deliberately **not** routed through the provider — it's map-library
reference data (from `world-atlas`), not homepage content, so it stays a
direct `fetch` in `useActivityMapData.ts`.

## Migrating off fixtures later

To move a piece of content from the fixture to a real API/DB/CMS:

1. Write a new class implementing `ContentProvider` (`ApiProvider`,
   `DatabaseProvider`, or `CmsProvider` — pick the name that matches the
   backend). It can implement all nine-plus-one methods at once, or —
   because `ContentProvider` is just an interface — you can migrate method
   by method with a provider that delegates most calls to a wrapped
   `FixtureProvider` and only overrides the ones already backed by the real
   source:

   ```ts
   export class HybridProvider implements ContentProvider {
     private fixture = new FixtureProvider();
     private api = new ApiClient(/* ... */);

     getLatestArticles() { return this.api.fetchLatestArticles(); }
     // everything else still comes from the fixture until it's ready
     getHomepage() { return this.fixture.getHomepage(); }
     // ...
   }
   ```

2. Change the one line in `src/data-access/index.ts` that constructs the
   singleton:

   ```diff
   - if (!instance) instance = new FixtureProvider();
   + if (!instance) instance = new ApiProvider();
   ```

3. Nothing else changes. Every service function, every component prop type,
   every `formatDateVi()` call downstream is unaffected, because they all
   depend on the `ContentProvider` interface and the domain types in
   `src/domain/`, never on `FixtureProvider` or the raw fixture arrays.

If only some sections are ready to move (a common real-world rollout), use
the delegating-hybrid pattern above and delete fixture files only once
nothing references them anymore.

## What still depends on static data after this task

Everything does — there is no real backend yet. This task's scope was the
architecture (typed domain model + provider/service seam), not sourcing real
content. See the root README and the audit report for the current inventory
of placeholder media, unbuilt routes, and fixture-only sections.
