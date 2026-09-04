# Deployment — GitHub Pages

The site is published as a static export to `https://lamtung48.github.io/congthongtin/`
via `.github/workflows/deploy-pages.yml`. Every push to `main` rebuilds and
redeploys automatically; it can also be triggered manually from the Actions
tab (`workflow_dispatch`).

## How it works

- `next.config.ts` sets `output: "export"`. `next build` produces a fully
  static site under `web/out/` — no Node.js server, no per-request
  rendering.
- GitHub Pages serves the repo at a subpath (`/congthongtin/`), not the
  domain root, so the build computes a `basePath`/`assetPrefix` of
  `/congthongtin` whenever it detects it's running in GitHub Actions
  (`GITHUB_ACTIONS=true`, `GITHUB_REPOSITORY=owner/repo` — both set
  automatically by the runner). Local `npm run dev`/`npm run build` see
  neither variable, so they run with an empty `basePath` as before.
- `next/link`, `next/image`, and the router apply `basePath` automatically.
  The two places that `fetch()` a `public/` JSON file directly
  (`getActivityMap`, and the world-geometry file in
  `useActivityMapData.ts`) do not get this for free — they go through
  `src/lib/basePath.ts`'s `withBasePath()` instead.
- The workflow touches `out/.nojekyll` before upload so GitHub Pages'
  default Jekyll processing doesn't strip the `_next/` asset folder
  (underscore-prefixed paths are treated as hidden by Jekyll otherwise).

## One manual step required

GitHub Pages must be enabled once, by hand, in the repo settings — this
cannot be done from a workflow or the API used here:

**Settings → Pages → Build and deployment → Source: "GitHub Actions"**

Until that's set, the workflow will build successfully but the deploy job
has nothing to publish to.

## What static export gives up

- **No per-request rendering.** Every dynamic route (`/tin-tuc/[slug]`,
  `/chuyen-muc/[slug]`, `/chu-de/[slug]`, `/dia-phuong/[slug]`,
  `/don-vi/[slug]`, `/su-kien/[slug]`) is pre-rendered at build time via
  `generateStaticParams()`, enumerating every slug the current fixture data
  can produce. A slug that doesn't exist in the fixtures at build time has
  no page — visiting it 404s at the GitHub Pages host level, not via the
  app's own `notFound()` logic. When real content replaces the fixtures,
  this list has to come from wherever slugs are actually sourced from, and
  the site has to rebuild whenever content changes (no on-demand
  revalidation).
- **Section-specific `not-found.tsx` files don't run in the deployed site.**
  Next.js exports the root `app/not-found.tsx` as the site's `404.html`,
  which GitHub Pages serves for any unmatched path — so the global not-found
  page still works. But the `not-found.tsx` under each `[slug]` folder only
  triggers via `notFound()` inside a request that's actually being handled
  by a Next.js server (`next dev`/`next start`); a static host has no such
  request to intercept, so those pages only show up locally, not on
  GitHub Pages.
- **`/tim-kiem`'s `<title>` is no longer query-aware.** Reading
  `searchParams` server-side (to make `generateMetadata` return
  `Kết quả cho "…"`) requires per-request rendering, which static export
  doesn't have. The route now exports a static `metadata` (`title: "Tìm
  kiếm"`) and reads `?q=` client-side in `SearchPageClient.tsx` instead —
  the on-page heading is still query-aware, only the browser tab title
  isn't.
- **`next/image` optimization is disabled** (`images.unoptimized: true`) —
  there's no server to run the Image Optimization API against.
- **No live data.** Everything still comes from the in-repo fixtures under
  `src/data-access/fixtures/`; deploying doesn't change that.

## Verifying locally

To reproduce the CI build (with the GitHub Pages `basePath`) locally:

```bash
cd web
GITHUB_ACTIONS=true GITHUB_REPOSITORY=lamtung48/congthongtin npm run build
```

This writes the exported site to `web/out/`.
