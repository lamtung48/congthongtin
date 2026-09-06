# Security — production hardening

Production readiness task. This is the security summary for a production
deployment specifically — the underlying mechanisms (how sessions work,
the full permission table, the CMS workflow) are already documented in
docs/AUTHENTICATION.md and docs/AUTHORIZATION.md from earlier tasks; this
doc covers what changed/was added to get this app ready for a real VPS:
security headers, rate limiting beyond login, credential/log handling, and
the audit retention policy.

## 1. Admin route security (`/admin/*`)

Already true from earlier tasks, restated here because it's exactly what
brief section 2 asks for:

- **HTTPS**: terminated at the reverse proxy (docs/DEPLOYMENT.md, section
  3) — the app itself doesn't handle TLS. Secure cookies (`Set-Cookie:
  ...; Secure`) are set whenever `NODE_ENV=production`
  (`src/server/auth/session.ts`), which every real deployment runs under.
- **Server-side session**: a database-backed opaque token, re-validated
  against the `Session`/`User` tables on every request — not a JWT, so
  disabling an account takes effect on that account's very next request,
  not at token expiry (docs/AUTHENTICATION.md, "Why database sessions,
  not JWT").
- **Authorization**: every admin Server Component, Server Action, and
  Route Handler calls `requireSession()`/`requirePermission()`/
  `requireAnyPermission()` itself (`src/server/auth/guard.ts`) — not just
  the top-level `/admin` layout — because a Server Action is reachable
  directly as its own POST endpoint, and this Next.js version's own
  `proxy.ts` docs warn explicitly: "Always verify authentication and
  authorization inside each Server Function rather than relying on
  \[Proxy\] alone" (a matcher change could silently stop covering a route).
- **Login rate limiting**: 5 failed attempts per 15-minute window, keyed
  by email+IP (`src/server/auth/rateLimit.ts`) — see section 3 for the
  other endpoints this task added limits to.
- **Secure cookies**: `httpOnly`, `sameSite: "lax"`, `secure` in
  production, opaque random token (never a JWT/encoded payload) — see
  docs/AUTHENTICATION.md for the full cookie contract.

### No backdoor

There is exactly one way to become an ADMIN: be created as one (by another
Admin via `/admin/users`, or via `scripts/bootstrapAdmin.ts` — section 2)
and log in with real credentials. `hasPermission()`
(`src/server/auth/permissions.ts`) has no special-cased email, no
env-var-gated superuser flag, no debug/test-only role — its entire
implementation is ~10 lines: `role === "ADMIN"` returns true
unconditionally, everything else is a lookup against a fixed, exhaustively
tested `Set` per role. `src/server/__tests__/authorization.test.mts`'s
"Production readiness — role hardening" suite asserts this directly, not
just that the UI hides a button.

## 2. Admin account bootstrap (brief section 3)

`prisma/seed.ts` is a **dev-only fixture loader** — its own header comment
says so, and it hardcodes three well-known passwords
(`Admin@123456`/etc.) so a fresh `npm run dev` clone always has something
to log in with locally. **Never run it against production** — see
docs/DEPLOYMENT.md, "First deploy" for why.

`scripts/bootstrapAdmin.ts` is the production path instead:

- Reads `ADMIN_EMAIL` from the environment (required); `ADMIN_PASSWORD` is
  optional — if omitted, a cryptographically random 24-character password
  is generated and printed to stdout **exactly once**. Nothing in the
  script writes a password to any file or log.
- Refuses to run if any ADMIN account already exists, unless
  `ADMIN_BOOTSTRAP_FORCE=true` is explicitly also set — a fresh database
  bootstraps exactly once; a second accidental run (a re-triggered deploy,
  a CI misfire) must never silently create a duplicate Admin or reset an
  existing one.
- Enforces a 12-character minimum on any operator-supplied
  `ADMIN_PASSWORD`.

Verified this task: refuses correctly when an Admin already exists,
succeeds and prints a one-time password with `ADMIN_BOOTSTRAP_FORCE=true`
on a fresh email, refuses a duplicate email, refuses a too-short password.

## 3. Rate limiting (brief section 9)

All in-memory, per-process (correct for this app's single-instance
topology — docs/DEPLOYMENT.md, "Single process, not a cluster"). Every
limiter lives in `src/server/security/rateLimit.ts`'s `createRateLimiter`
factory except the login one (`src/server/auth/rateLimit.ts`, kept as its
own module so `authService.ts`'s existing import didn't need to change);
both share the same window/sweep implementation.

| Endpoint | Window | Max | Keyed by |
|---|---|---|---|
| `/admin/login` (`authService.login`) | 15 min | 5 failed attempts | email + IP |
| Media/video upload init (`/api/admin/media/upload`, `/api/admin/media/videos/upload`) | 10 min | 30 | acting user id |
| Sensitive admin actions (`createUserAction`/`changeRoleAction`/`setStatusAction`/`resetPasswordAction`) | 5 min | 30 | acting user id |
| External integration endpoints (`syncSourceAction`, YouTube OAuth callback) | 5 min | 10 | acting user id |

A future horizontally-scaled deployment (more than one Next.js process)
would need to move these to a shared store (Redis, or a dedicated DB
table) — the in-memory version is stated as a known limitation in both
rate-limiter modules' own comments, not a hidden gap.

## 4. Role security (brief section 4) — what's structurally enforced

| Restriction | How it's enforced |
|---|---|
| CONTRIBUTOR cannot touch users | `userService`'s four write methods (`create`/`changeRole`/`setStatus`/`resetPassword`) each call `assertIsAdmin()` — a literal `role !== "ADMIN"` check, not a permission CONTRIBUTOR could ever be granted |
| CONTRIBUTOR cannot touch system config | `system.configure` is not in `CONTRIBUTOR`'s permission set (`ROLE_PERMISSIONS`, `permissions.ts`) — and nothing in the app currently exposes a system-config route at all, so there's nothing to reach even if it were |
| CONTRIBUTOR cannot read credentials/source tokens | `source.manage`/`source.view` are absent from CONTRIBUTOR's set entirely; `Source.encryptedCredential` is additionally excluded from every repository read `select` regardless of caller (`sourceRepository.ts`'s `publicSelect`) — belt and suspenders |
| CONTRIBUTOR cannot touch homepage configuration | `homepage.manage` absent from CONTRIBUTOR's set; `/admin/homepage`'s page guard (`requirePermission("homepage.manage")`) is the only write path |
| MANAGER cannot manage Admin accounts | Same `assertIsAdmin()` as above — MANAGER cannot manage *any* account, Admin included, not just "Admin accounts specifically" |
| MANAGER cannot read secrets | `source.view` (which MANAGER does hold, read-only) still never receives `encryptedCredential` — the field is excluded at the repository `select` level, not filtered per-caller |
| MANAGER cannot change system security config | `system.configure` absent from MANAGER's set |
| ADMIN has full access | `hasPermission()` returns `true` unconditionally for `role === "ADMIN"`, before consulting any table |

`src/server/__tests__/authorization.test.mts` exercises every row of this
table directly against the real service functions (not just
`hasPermission()` in isolation) — see its "Production readiness — role
hardening" suite, plus every earlier task's own permission-split tests
(Ecosystem Integration, Social Collector, Editorial Workflow, etc.) for
the rest of the permission surface.

## 5. Security headers (brief section 8)

Set via `next.config.ts`'s `headers()` function (not a `proxy.ts` —
see that file's own header comment for why a nonce-based CSP would have
broken this app's existing ISR/SSG public pages):

| Header | Value | Why |
|---|---|---|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://img.youtube.com; font-src 'self'; connect-src 'self'; frame-src https://www.youtube-nocookie.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests` | Every uploaded image is proxied through this app's own `/api/media/[mediaId]` (Google Drive never appears in the browser); the only iframe in the app is a YouTube-nocookie embed; `next/font/google` self-hosts fonts at build time |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | This is an admin-cookie-bearing domain — once HTTPS is live it should never downgrade to plain HTTP in any browser that's ever loaded it |
| `X-Content-Type-Options` | `nosniff` | Blocks MIME-sniffing a served file into something it isn't declared as |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Doesn't leak full URLs (which could include query params) to third-party origins |
| `X-Frame-Options` | `DENY` | Belt-and-suspenders with `frame-ancestors 'none'` for older browsers — this site is never meant to be embedded elsewhere |

`style-src` keeps `'unsafe-inline'` deliberately — the codebase uses
React's `style={{...}}` prop in 60+ places, and inline *styles* (unlike
inline *scripts*) can't execute arbitrary JS; rewriting all of them to CSS
Modules purely to drop this one keyword was judged out of scope and a
real regression risk for this task.

## 6. Log redaction (brief section 7)

Nothing in the app ever logs a password, session token, or OAuth
token/Google credential directly — `authService.ts` never logs a
password; `session.ts` never logs the raw cookie token, only its SHA-256
hash goes to the database (never to a log).

One real gap found and fixed this task: `googleDrive.ts`/`youtube.ts`'s
error handlers used to `console.error(..., err)` with the *raw*
`gaxios`/`googleapis` error object, which can carry the outgoing request's
`Authorization` header on `.config`/`.response` depending on the failure —
printing that straight to stdout/PM2 logs would have leaked a live
credential. Fixed with `src/server/logging/safeError.ts`'s
`summarizeErrorForLog()`: extracts only `message`/`stack`/HTTP status,
never `.config`/`.response`, and additionally redacts any
`Bearer ...`/`access_token=...`/`refresh_token=...`/PEM-private-key-shaped
substring left in the message/stack themselves as defense in depth.

**Log rotation**: not an application concern — see docs/OPERATIONS.md,
"Log rotation" for the PM2/systemd + `logrotate` setup.

## 7. Audit log retention (brief section 11)

- **Immutable by construction, for every role**: `auditLogRepository.ts`
  exposes exactly one write method, `record()` — create-only. No file in
  the entire app calls `prisma.auditLog.update`/`.delete`/`.updateMany`/
  `.deleteMany` for any role, ever (grep confirms it — the only matches
  are the generated Prisma client's own doc comments, never invoked). This
  is stronger than "Contributor can't delete audit logs" — *nobody* can,
  through the app, regardless of role or permission.
- **Retention policy**: `scripts/purgeOldAuditLogs.ts`, a standalone
  cron-only script (never reachable from any admin route/Server
  Action/API) that deletes rows older than `AUDIT_LOG_RETENTION_DAYS`
  (default 365, minimum enforced at 30 to prevent an accidental
  near-zero window). Running it requires shell access to the server — a
  deliberately higher bar than any in-app permission could gate. See
  docs/OPERATIONS.md for the cron schedule.

## 8. Environment/secrets policy (brief section 13)

- `.gitignore` blocks `.env*` except `.env.example` — every real secret
  (`DATABASE_URL`, Google Drive service-account key, YouTube OAuth
  client secret, `YOUTUBE_TOKEN_ENCRYPTION_KEY`,
  `SOURCE_CREDENTIAL_ENCRYPTION_KEY`) lives only in an untracked `.env`
  per environment.
- `YOUTUBE_TOKEN_ENCRYPTION_KEY` and `SOURCE_CREDENTIAL_ENCRYPTION_KEY`
  are two *independent* random values (`src/server/crypto/secretBox.ts`
  vs `youtube.ts`'s own `encryptToken`) — a leaked YouTube refresh token
  and a leaked Facebook/RSS collector credential are unrelated incidents
  and must not share a blast radius.
- Dev/staging/production are each just a different `.env` file pointed at
  a different `DATABASE_URL` — see docs/OPERATIONS.md, "Environments" and
  docs/ENVIRONMENT.md for the full variable reference.

## 9. Final security test (brief section 17)

Two layers, deliberately not just one:

1. **Automated, service-layer** (`npm test` —
   `src/server/__tests__/authorization.test.mts`): every permission split
   in section 4's table above, exercised against the real
   `userService`/`sourceService`/`hasPermission()` functions for all three
   roles — 83 tests total across every task's own permission-split suite,
   run against a real (throwaway-fixture) database, not mocked business
   logic.
2. **Manual, HTTP-level** (docs/OPERATIONS.md's verification checklist):
   a running dev/staging server hit directly with real cookies per role —
   confirming `/admin/sources`, `/api/admin/media/upload`, etc. return the
   right status code (401/403) at the actual transport layer, not just
   that a button is hidden in the UI. Brief section 17's own instruction:
   "Không chỉ kiểm tra menu UI."
