# Deployment

**Status: hosting target not yet chosen.** This doc used to describe a
GitHub Pages static-export deployment; that stopped being possible when the
authentication/authorization task added `/admin/login` (needs Cookies and
Server Actions — both explicitly unsupported by Next.js's `output: "export"`
mode, confirmed against this Next.js version's own docs,
`node_modules/next/dist/docs/01-app/02-guides/static-exports.md`). A Next.js
app is either a static export or a server-rendered app — not a mix of both
in one build — so the whole app moved to the server-rendered mode, and
`next.config.ts` no longer sets `output: "export"`.

## What changed

- **`next.config.ts`** no longer sets `output: "export"`. `next build` now
  produces a standard `.next/` server build (run via `next start`, or
  whatever adapter a chosen host uses), not a static `out/` folder.
- **`.github/workflows/deploy-pages.yml` is disabled** (its `push` trigger
  was removed, `workflow_dispatch` kept for reference) — it uploads
  `web/out/`, which no longer exists. Left in the repo rather than deleted,
  as a reference for whatever the next workflow looks like once a host is
  picked.
- **GitHub Pages can no longer host this app at all.** It only serves
  static files; there is no static output anymore to serve.
- **`basePath`/`NEXT_PUBLIC_SITE_URL`** are now plain environment variables
  (`NEXT_PUBLIC_BASE_PATH`, `NEXT_PUBLIC_SITE_URL`) instead of being derived
  from `GITHUB_ACTIONS`/`GITHUB_REPOSITORY` — there's no GitHub Actions-run
  static build to derive them from anymore. Both default to "no base path" /
  `http://localhost:3000` for local development.

## What did not change

- Every public page's actual content, layout, and behavior — this task's
  brief was explicit about not touching the public site "nếu không cần
  thiết", and nothing about the pages themselves needed to change to make
  server rendering work. `FixtureProvider` is still the frontend's live data
  source (`docs/BACKEND_ARCHITECTURE.md`).
- The `generateStaticParams()` calls on dynamic routes
  (`/tin-tuc/[slug]`, etc.) are unaffected — Next.js still uses them to
  pre-render those pages at build time (`force-static`-equivalent behavior)
  even in server mode; they just no longer are the *only* rendering path
  available, since the app can now also render on demand if needed later.

## Next step: choose a host

This task deliberately stops short of picking a specific hosting platform
and rewriting the CI/CD pipeline for it — that's an infrastructure decision
with its own tradeoffs (cost, ops burden, how `DATABASE_URL`/session
secrets get provisioned) that wasn't part of what this task was asked to
do. Whatever is chosen needs to run a real Node.js process (or a platform's
equivalent — e.g. Vercel's managed runtime), reach the PostgreSQL database
(`docs/ENVIRONMENT.md`), and have `DATABASE_URL` / `SESSION_*` secrets
configured as real environment variables, never committed. Once a host is
chosen, `.github/workflows/deploy-pages.yml` should be replaced (not
patched) with that host's actual deploy workflow.

## Local development

Unaffected by any of this — `npm run dev` already ran a full Next.js server
regardless of `next.config.ts`'s `output` setting. See the repo root
`README.md` and `docs/ENVIRONMENT.md` for database setup.
