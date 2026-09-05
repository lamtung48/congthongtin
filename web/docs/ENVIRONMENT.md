# Environment & local database setup

How to get a working Postgres database for this project, what every
environment variable means, and the Prisma 7 CLI workflow this repo uses.
Covers only the backend foundation added in this task — the frontend's own
`NEXT_PUBLIC_*` build-time variables are already documented in
`next.config.ts`'s own comments and `docs/DEPLOYMENT.md`.

## Prerequisites

- **PostgreSQL 14+** running somewhere reachable (local install, Docker, or
  a hosted instance). This project was built and verified against
  PostgreSQL 16.
- **Node.js** matching what's already required by `package.json`/Next.js
  (no new Node version requirement was introduced — see
  `docs/BACKEND_ARCHITECTURE.md`, "Dependency compatibility check" for the
  exact versions checked before adding Prisma).

## One-time setup

```bash
# 1. Create two local databases: one for real data, one Prisma's own
#    migration engine uses as scratch space to detect schema drift.
createdb hsv_portal_dev
createdb hsv_portal_shadow

# 2. Copy the env template and adjust if your Postgres isn't on localhost
#    with the default port/credentials.
cp .env.example .env

# 3. Install dependencies — this also runs `prisma generate` automatically
#    (see the `postinstall` script in package.json), which is required
#    before any code importing `@/generated/prisma/client` will typecheck.
npm install

# 4. Apply the schema and load development data.
npx prisma migrate dev
npx prisma db seed
```

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | The connection Prisma Client uses at runtime, via `@prisma/adapter-pg` (`src/server/db/client.ts`). In production this is typically a pooled connection (PgBouncer, RDS Proxy, a managed Postgres provider's pooler). |
| `SHADOW_DATABASE_URL` | Yes, for `prisma migrate dev` | A second, always-empty database only the migration engine uses locally to detect drift by replaying migrations against a throwaway copy. Never read by the running app; not needed for `prisma migrate deploy` in production. |
| `DIRECT_DATABASE_URL` | No | Reserved, not currently wired into `prisma.config.ts` (this Prisma version's `datasource` config only accepts `url`/`shadowDatabaseUrl` — confirmed against the installed type declarations, not assumed). Once a production `DATABASE_URL` points at a connection pooler that can't run schema migrations, `prisma migrate deploy` would need a second, direct URL — this variable name is reserved for that day so adding it later doesn't require picking a new name. Leave empty for a plain Postgres connection like this project's dev setup. |

**Never commit `.env`.** `.gitignore` blanket-ignores `.env*` with one
explicit exception (`!.env.example`) so the template stays tracked while
every real `.env*` file — passwords, API keys, production database URLs,
OAuth secrets — never reaches the repository. Verified with
`git check-ignore -v .env .env.example`.

## Prisma 7 CLI workflow

This project uses Prisma **7**, whose CLI behaves differently from the
Prisma 5/6 most existing tutorials describe — see
`docs/BACKEND_ARCHITECTURE.md`, "Prisma 7 driver adapter" for why a driver
adapter is mandatory now, not optional. The commands that matter day to
day:

```bash
npx prisma migrate dev --name <description>   # create + apply a new migration (dev only)
npx prisma generate                            # regenerate src/generated/prisma from schema.prisma
npx prisma db seed                             # run prisma/seed.ts (see its own file header)
npx prisma migrate deploy                      # apply pending migrations in production — no shadow DB needed
npx prisma migrate status                      # check what's applied vs pending
npx prisma studio                              # a local data browser/editor GUI
```

Two behaviors that changed from Prisma 6 and are easy to trip over:

- **Nothing runs automatically anymore.** `migrate dev` does **not** run
  `generate` or a seed for you — run both explicitly, in that order, after
  every schema change:
  ```bash
  npx prisma migrate dev --name <description>
  npx prisma generate
  npx prisma db seed
  ```
- **`prisma migrate reset` requires human confirmation when invoked by an
  AI agent.** The CLI itself detects agent invocation and refuses to drop
  and recreate the database without an explicit, human-provided consent
  token — by design, since this project's Prisma version ships that guard
  specifically to stop an agent from irreversibly destroying data
  unattended. If you ask an AI assistant to reset your local dev database,
  expect it to stop and ask first.

## Connection URL format

Standard `postgresql://` connection strings:

```
postgresql://<user>:<password>@<host>:<port>/<database>?schema=public
```

## Generated Prisma Client

`prisma/schema.prisma`'s `generator client` block outputs to
`src/generated/prisma` (not the historical `node_modules/@prisma/client`
location — Prisma 7's `prisma-client` generator requires an explicit
`output` path). That directory is:

- **Gitignored** (`/src/generated/prisma` in `.gitignore`) — it's fully
  reproducible from `schema.prisma` via `prisma generate`, exactly like
  `.next/` is reproducible from source.
- **Excluded from `tsc`** (`tsconfig.json`'s `exclude`) and **ESLint**
  (`eslint.config.mjs`'s `globalIgnores`) — it's `// @ts-nocheck`-marked,
  machine-generated code that should never be hand-edited or linted.

If `tsc --noEmit` or `next build` ever fails with "Cannot find module
'@/generated/prisma/client'", the fix is `npx prisma generate`, not a code
change.
