import type { ContentProvider } from "./provider";
import { FixtureProvider } from "./providers/fixtureProvider";
import { DatabaseProvider } from "./providers/databaseProvider";

export type { ContentProvider } from "./provider";
export * from "./types";

let instance: ContentProvider | null = null;

/**
 * The single swap point for the whole app. Every other module reaches the
 * data layer through this function — never by importing `FixtureProvider`/
 * `DatabaseProvider` directly. See `docs/PRODUCTION_DATA.md`.
 *
 * Production Data Policy task, brief section 7: "Giữ fixture cho dev/test.
 * Production: không fallback sang dữ liệu giả." Selection rule:
 *
 * - `NODE_ENV === "test"` always gets `FixtureProvider` — the node:test
 *   suites in `src/server/__tests__/**` exercise `articleService`/
 *   `mediaService`/etc. directly against the real dev database already
 *   (see that suite's own header comment); nothing in this codebase's test
 *   run needs `ContentProvider` to hit Postgres too, and a pure-fixture
 *   default keeps any future component/page test from needing a seeded DB
 *   at all.
 * - `CONTENT_PROVIDER=fixture` opts a **non-production** environment into
 *   fixture data explicitly (e.g. UI iteration without a running/seeded
 *   Postgres) — set in `.env`, never the default.
 * - Every other case — which includes ordinary local dev, since a real,
 *   migrated-and-seeded Postgres is already mandatory infrastructure for
 *   this app's admin CMS (`docs/ENVIRONMENT.md`) — gets `DatabaseProvider`.
 * - In `NODE_ENV === "production"`, `CONTENT_PROVIDER=fixture` is refused
 *   outright (logged, then ignored) rather than honored: the hard rule is
 *   "never fake data in production," not "unless someone sets one env
 *   var." A production deployment that can't reach its database should
 *   fail loudly (an error page), not silently serve fixture content that
 *   looks real but isn't.
 */
function selectProvider(): ContentProvider {
  const nodeEnv = process.env.NODE_ENV;
  const requestedFixture = process.env.CONTENT_PROVIDER === "fixture";

  if (nodeEnv === "test") return new FixtureProvider();

  if (requestedFixture) {
    if (nodeEnv === "production") {
      console.warn(
        '[data-access] CONTENT_PROVIDER=fixture is set but NODE_ENV=production — ignoring it and using DatabaseProvider. Production never serves fixture data (see docs/PRODUCTION_DATA.md).',
      );
    } else {
      return new FixtureProvider();
    }
  }

  return new DatabaseProvider();
}

export function getContentProvider(): ContentProvider {
  if (!instance) instance = selectProvider();
  return instance;
}
