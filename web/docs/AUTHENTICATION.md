# Authentication

How `/admin` verifies *who* is making a request. See `docs/AUTHORIZATION.md`
for *what* that person is allowed to do once identified — the two are
deliberately separate documents because they're separate concerns in the
code (`src/server/auth/session.ts` vs. `src/server/auth/permissions.ts` +
`guard.ts`).

## Chosen solution: database-backed sessions, not JWT

Brief section 5 said: use server-side sessions or a solution appropriate for
the current Next.js version, and explicitly "don't hand-roll JWT unless
truly necessary." Before writing any code, the actual constraints were
checked:

| Check | Result |
|---|---|
| Next.js version | 16.3.4 (App Router, React 19.2.8) |
| Next's own auth guide (`node_modules/next/dist/docs/**/authentication.md`) | Documents two supported session patterns: **stateless (JWT/signed cookie)** and **database sessions** — both first-party, neither requires a new auth *library* |
| Existing auth dependencies in this codebase | None — no `next-auth`, `@auth/core`, `iron-session`, `jose`, etc. |
| `output: "export"` (static export) | Was set in `next.config.ts` for GitHub Pages hosting — **removed** for this task; static export categorically disallows Cookies and Server Actions (`node_modules/next/dist/docs/01-app/02-guides/static-exports.md`, "Unsupported Features"), which every option here needs. See `docs/DEPLOYMENT.md` for what this means for hosting. |

**Chosen: Next's documented "Database Sessions" pattern** — an opaque random
token in an httpOnly cookie, hashed and looked up against a `Session` table
on every request. Not a signed/stateless cookie, and not a third-party
session library.

### Why database sessions over JWT here

- **Brief section 5 says so directly** ("Không tự chế JWT nếu không thật sự
  cần thiết") — nothing about this admin CMS needs JWT's actual selling
  point (verifying a token without a database round-trip, for a
  multi-service/stateless architecture). This is one Next.js app talking to
  one Postgres database it already queries on every admin request anyway.
- **Brief section 13 requires an immediate disabled-account check** — with a
  signed JWT, revoking access before the token's own expiry means either a
  server-side blocklist (which is a database lookup per request anyway, so
  it gets JWT's complexity with none of its statelessness benefit) or
  accepting up to the token's lifetime of continued access after an Admin
  disables the account. A database session makes "disabled right now" take
  effect on that account's very next request, by construction — no
  blocklist needed, because the row itself *is* the source of truth
  (`getSession()` re-checks `user.status === "ACTIVE"` on every call, not
  just at issuance).
- **No new dependency.** JWT would need `jose` (Next's own recommendation)
  or similar; database sessions need nothing beyond `node:crypto`
  (already used for password hashing) and the `Session` table already
  modeled in Prisma.

### Why not a third-party auth library (NextAuth/Auth.js, Lucia, etc.)

Brief section 5's instruction was to check compatibility and current docs
before adding a library, not to avoid one on principle. Reasons this task
didn't:

- The requirement set (3 fixed roles, credential login only, no OAuth
  providers, no magic links) doesn't need a general-purpose auth
  framework's surface area.
- Next's own auth guide implements this exact pattern (opaque token +
  DB-backed session table + a `getSession()` Data Access Layer function) as
  its documented first-party recommendation for this Next.js version —
  adopting it *is* "the solution appropriate for the current Next.js
  version" the brief asked for, without adding a dependency whose
  compatibility with Next 16 / React 19 would need separate verification.

## Password hashing

`src/server/auth/password.ts`, using Node's built-in `crypto.scrypt`
(OWASP-recommended, memory-hard) — chosen over `bcrypt`/`argon2` specifically
to avoid adding a **native-binding dependency** for a single hashing
function Node already ships. No plaintext password is ever written to the
database, logged, or included in `AuditLog.metadata` (brief section 12's
explicit exclusion list: password/token/secret/cookie).

- `hashPassword(plain)` → `scrypt$<saltHex>$<hashHex>`, random 16-byte salt
  per password, 64-byte derived key.
- `verifyPassword(plain, stored)` → parses the stored format, re-derives
  with the stored salt, compares with `crypto.timingSafeEqual` (not `===`,
  which would leak timing information about how many leading bytes
  matched).

## Login (`/admin/login`)

`src/app/admin/(auth)/login/` — `page.tsx` (redirects to `/admin/dashboard`
if already logged in), `LoginForm.tsx` (Client Component, `useActionState`
for pending/error state without hand-rolled `fetch`/`useState`
plumbing), `actions.ts` (`loginAction` Server Action, Zod-validated).

**Brief section 4's error-message rule is load-bearing, not cosmetic**:
every failure path — wrong password, account that doesn't exist, and a
correctly-authenticated but `DISABLED` account — returns the exact same
string, `"Thông tin đăng nhập không chính xác."` A different message per
case (the brief names "Email tồn tại nhưng mật khẩu sai" as the specific
example to avoid) would let an attacker enumerate valid emails or disabled
accounts one login attempt at a time. This is enforced in one place,
`authService.login` (`src/server/services/authService.ts`), not
independently in the UI and the action — see the `GENERIC_LOGIN_ERROR`
constant and the single `return` site all three failure branches share.

## Session lifecycle

`src/server/auth/session.ts` (`import "server-only"` — this module cannot
be imported into a Client Component even by mistake).

- **Cookie**: `admin_session`, `httpOnly: true`, `secure: <NODE_ENV ===
  "production">`, `sameSite: "lax"`, `path: "/"`, 7-day fixed expiry set at
  creation. `sameSite: "lax"` (not `"strict"`) so a login redirect or a
  bookmarked admin link still carries the cookie on top-level navigation,
  while still blocking the classic CSRF vector of a cross-site `<form>`
  auto-submit, which `lax` exempts only same-site-safe (GET, top-level)
  navigations from blocking.
- **Token**: 32 random bytes (`crypto.randomBytes`), hex-encoded. The
  database never stores the raw token — only `sha256(token)` in
  `Session.tokenHash` — so a leaked database dump doesn't hand out valid
  session cookies (the same reasoning as not storing plaintext passwords).
- **Validation** (`getSession()`, wrapped in React's `cache()` so one
  render pass hits the database once even if several
  layouts/pages/components call it): looks up the session by token hash,
  checks `expiresAt`, checks the owning `User.status === "ACTIVE"`, and
  opportunistically deletes the row if expired. Returns `null` for every
  invalid case — never throws — so callers decide what "not logged in"
  means for them.
- **Route guard**: `requireSession()` calls `getSession()` and
  `redirect("/admin/login")` if it's `null`. Used by every protected
  layout/page/Server Action — see `docs/AUTHORIZATION.md`, "Route guard".
- **Logout**: `authService.logout()` deletes the `Session` row (not just
  the cookie) and records an `AuditLog` `LOGOUT` entry before clearing the
  cookie — a logged-out session token is invalid immediately, not just
  unreferenced client-side.
- **Forced logout**: `destroyAllSessionsForUser(userId)` deletes every
  session row for that user. Called from `userService.setStatus()` when an
  Admin disables an account (brief section 13: the disable has to take
  effect immediately, not at next natural expiry) and from
  `userService.resetPassword()` (an old password shouldn't leave old
  sessions valid).

## Brute-force / rate limiting

`src/server/auth/rateLimit.ts` — an in-memory sliding window, 5 failed
attempts per `identifier:ip` key per 15 minutes, clearing on successful
login.

**Documented limitation, not hidden**: this is single-process only — an
in-memory `Map` shared across every login attempt this Node process
handles, with no shared store. Correct for the current single-instance dev/
prod deployment; the moment this app runs as more than one server process
(horizontal scaling, serverless with concurrent instances), each process
gets its own independent counter and an attacker distributed across
processes could exceed the intended limit. A production deployment beyond
one process needs a shared store (Redis, or a `LoginAttempt` database
table) — noted here rather than silently shipped as if it were already
distributed-safe.

## Input validation

Every Server Action that accepts form input validates with Zod before
touching the database (`LoginSchema` in `login/actions.ts`,
`CreateUserSchema`-equivalent inline schemas in `users/actions.ts`,
`CreateArticleSchema`/`CreateCategorySchema`/etc. in their respective
`actions.ts` files) — untrusted input is never passed directly to Prisma.

## Secrets

`DATABASE_URL` and all connection strings live in `.env` (gitignored,
per the existing `.env.example` convention from the backend-foundation
task) — nothing new introduced by this task. No API keys or secrets were
added; scrypt and the session token are generated locally via
`node:crypto`, not sourced from an external provider.

## Testing

- **Permanent, re-runnable suite**: `npm test` —
  `src/server/__tests__/authorization.test.mts`, using Node's built-in test
  runner (`node:test`) against the real dev database, calling
  `articleService`/`userService` directly rather than through the UI (brief
  section 15's explicit requirement). See `docs/AUTHORIZATION.md`,
  "Testing" for what it covers and why it needs the specific `node` flags
  in `package.json`'s `test` script.
- **Manual, real-browser verification** (Playwright, run during
  development — not committed as a script since it drives a real browser
  against a real running dev server rather than being a unit/integration
  test): login succeeds for all three seeded roles with correct redirects;
  wrong password and a non-existent email both render the identical generic
  error string; a Manager/Contributor hitting `/admin/users` directly (not
  via a hidden nav link) gets a real HTTP 403; logging out and then
  reloading a protected page redirects to `/admin/login`; disabling a
  user's account (via a direct database update, simulating an Admin action)
  invalidates that user's already-open session on their very next request.

## What this task does not add

- **Email delivery** for password reset — `userService.resetPassword`
  generates a temporary password and returns it once to the calling Admin
  to relay out-of-band; no email/SMS provider is wired up (nothing in the
  brief asked for one, and adding an email provider is its own integration
  decision, not a default to make silently).
- **Multi-factor authentication** — not mentioned in the brief; the
  permission/session layer this task built doesn't preclude adding it
  later (an MFA step would slot in between "password verified" and
  "`createSession()` called" in `authService.login`).
- **A distributed rate-limit store** — see "Brute-force / rate limiting"
  above.
