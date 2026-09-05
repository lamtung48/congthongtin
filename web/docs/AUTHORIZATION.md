# Authorization

What a logged-in `/admin` user is allowed to do, and — the part brief
section 3 treats as non-negotiable — where that's actually enforced. See
`docs/AUTHENTICATION.md` for how a user is identified in the first place.

## Role model

Exactly three roles, per the brief, with no fourth added anywhere in this
task:

| Role (`AdminRole` enum) | Display label (brief section 1, used verbatim everywhere a role is shown) |
|---|---|
| `ADMIN` | Admin |
| `MANAGER` | Quản trị viên |
| `CONTRIBUTOR` | Cộng tác viên |

`ASSIGNABLE_ROLES` (`src/server/auth/permissions.ts`) is the one array the
`/admin/users` role dropdown reads from — adding a role means adding one
entry there, and it would still need a full `ROLE_PERMISSIONS` entry before
`hasPermission` could resolve anything for it, which is deliberately not a
one-line change (see "Extensibility" below).

## The extensibility requirement, and how it's actually built

Brief section 3: "Thiết kế lớp phân quyền có khả năng mở rộng (role mới có
thể thêm sau) mà không cần viết lại toàn bộ hệ thống, dù UI hiện tại chỉ có
3 role." Concretely:

```
Role  →  Permission set (ROLE_PERMISSIONS)  →  hasPermission(role, permission)  →  every server check
```

`PERMISSIONS` (`src/server/auth/permissions.ts`) is a flat list of ~24
string-literal capabilities (`article.approve`, `taxonomy.manage`,
`user.changeRole`, ...), not three hardcoded booleans per role. Every
authorization decision in the codebase — every service method, every
`requirePermission()` call — checks `hasPermission(role, "some.permission")`,
never `role === "MANAGER"` directly (`userService.ts` is the one deliberate
exception: user-account management is Admin-only as a structural rule, not
a permission that could ever be handed to a new role without the brief
being rewritten first — see its own header comment).

**What adding a fourth role would actually touch**: one new
`ROLE_PERMISSIONS` entry (which permissions it holds) and one
`ASSIGNABLE_ROLES` addition (so it appears in the UI) — no service, no
route guard, no Server Action changes, because they all already go through
`hasPermission()` generically. That is what "không cần viết lại toàn bộ hệ
thống" means here in concrete code terms, not just as an aspiration.

`ADMIN` is special-cased to return `true` for every permission
structurally (`if (role === "ADMIN") return true`) rather than via a
hand-maintained list kept in sync with `PERMISSIONS` — brief section 2's
"Admin có toàn quyền hệ thống" is a guarantee that can't silently drift out
of date as new permissions are added, the way a manually-copied list could.

## Permission matrix

Brief section 16 specified the table below by name. Two small terminology
adjustments were necessary to match what the actual permission model
(above) needed to express — flagged here **before** the table, per the
brief's own instruction to explain any adjustment rather than change the
table silently:

1. **"Quản lý Media" isn't a single yes/no per role.** Brief section 2
   itself draws this distinction ("Contributor: upload/chọn media *trong
   phạm vi được cho phép*" vs. Manager/Admin with no such qualifier), so the
   permission model has two capabilities — `media.manage.own` and
   `media.manage.any` — not one. The table marks Contributor's cell
   "Chỉ media của mình" rather than a plain ✗, because that's the accurate
   answer, not a simplification of it.
2. **"Xem Audit Log đầy đủ" for Manager is "xem log nội dung", not "đầy
   đủ".** Brief section 2 excludes Manager from account-management actions
   entirely (create/delete Admin, change role, system security). Granting
   Manager the *full* audit log would let them read the history of exactly
   those account-management actions they're excluded from performing —
   who was promoted to Admin, whose account was disabled, and by whom. The
   permission model instead gives Manager `auditlog.view.content` (their
   own content-workflow actions and other content actors' actions) and
   reserves `auditlog.view.full` (every action including
   `CREATE_USER`/`CHANGE_ROLE`/`DISABLE_USER`) for Admin. The table marks
   this "Chỉ log nội dung" for Manager, not a plain ✓.

| Hành động | Admin | Quản trị viên | Cộng tác viên |
|---|---|---|---|
| Tạo bài | ✓ | ✓ | ✓ |
| Sửa bài của mình | ✓ | ✓ | ✓ |
| Sửa mọi bài | ✓ | ✓ | ✗ |
| Gửi duyệt | ✓ | ✓ | ✓ |
| Duyệt bài | ✓ | ✓ | ✗ |
| Xuất bản | ✓ | ✓ | ✗ |
| Hẹn giờ | ✓ | ✓ | ✗ |
| Quản lý Homepage | ✓ | ✓ | ✗ |
| Quản lý Media | ✓ | ✓ | Chỉ media của mình |
| Quản lý taxonomy | ✓ | ✓ | ✗ |
| Quản lý tài khoản | ✓ | ✗ | ✗ |
| Thay đổi role | ✓ | ✗ | ✗ |
| Cấu hình hệ thống | ✓ | ✗ | ✗ |
| Xem Audit Log đầy đủ | ✓ | Chỉ log nội dung | ✗ |

Two rows exist in the implementation beyond this required table, because
the brief's own workflow/policy sections (9 and 2) need them and a plain
"Xuất bản"/"Sửa mọi bài" pair can't express them:

| Hành động (bổ sung) | Admin | Quản trị viên | Cộng tác viên |
|---|---|---|---|
| Gỡ bài đã xuất bản (unpublish) | ✓ | ✓ | ✗ |
| Xoá bài | ✓ | Trừ bài đã xuất bản (phải gỡ trước) | ✗ |

`system.configure` has no settings page wired to it in this task — it
exists in `PERMISSIONS` so the permission layer already has a place for a
future `/admin/settings` page to check against, per the extensibility
requirement, not because such a page exists yet (see "Remaining work").

## Route guard

Brief section 6: every route under `/admin/*` except `/admin/login` must
be protected **server-side**, must redirect to login if not authenticated,
must show a real forbidden state (not a UI difference) if authenticated but
under-permissioned, and must never render admin data before redirecting.

- **`src/app/admin/(protected)/layout.tsx`** calls `requireSession()`
  before rendering any child route. This runs as part of the Server
  Component render — an unauthenticated request never reaches a page
  component's own `await prisma...` calls, let alone renders their output;
  there is no client-side "render then redirect" step for this file to skip
  in the first place.
- **Per-page/per-action permission checks** on top of that baseline:
  `requirePermission(permission)` / `requireRole(role)`
  (`src/server/auth/guard.ts`) call `requireSession()` first, then
  `forbidden()` (from `next/navigation`, `experimental.authInterrupts: true`
  in `next.config.ts`) if the permission check fails. `forbidden()` throws
  a real interrupt that Next renders via `src/app/admin/forbidden.tsx` as an
  actual HTTP 403 response — verified directly (not assumed) by requesting
  `/admin/users` as a Manager and reading the response status code, not
  just the rendered HTML.
- **Two layers are deliberate, not redundant**: the route-group layout is
  the "are you logged in at all" gate every admin route shares; permission
  checks are the "are you allowed to see *this*" gate specific to each
  page. A route that only checked the outer layer would let any logged-in
  role reach `/admin/users`; one that only checked permissions somewhere
  inside the page would already have started fetching/rendering before the
  check ran, which is exactly the "render then redirect" pattern brief
  section 6 rules out.
- **Sidebar nav filtering** (`(protected)/layout.tsx`'s `nav` array,
  filtered by `hasPermission`) is presentation only — hiding a link a role
  can't use is a courtesy, not the guard. Every route it hides is *also*
  independently protected by the page's own `requirePermission()` call, so
  navigating there directly (typing the URL, an old bookmark) is rejected
  the same way clicking a hidden link would have been.

## Server authorization

Brief section 3: "Mọi action nhạy cảm phải xác thực quyền tại server/
service layer" — explicitly not just disabling a button or hiding a
control. Every mutation in this codebase enforces this the same way:

- **`articleService.ts`**: every workflow method (`create`, `submitForReview`,
  `approve`, `returnForRevision`, `publish`, `schedule`, `unpublish`,
  `remove`) calls `assertHasPermission(actor, "...")` (throws if
  `hasPermission()` is false) as its first line, and `update`/
  `submitForReview` additionally call `assertCanEdit(actor, article)` —
  Manager/Admin's `article.edit.any` passes unconditionally, Contributor's
  `article.edit.own` passes only if `article.createdById === actor.id`.
  This is the one function every "can this actor touch this specific
  article" question funnels through, so it's checked once, not
  re-implemented per call site.
- **`userService.ts`**: every method calls `assertIsAdmin(actor)` first —
  structurally Admin-only, not permission-flag-driven, matching brief
  section 2's "Chỉ Admin có toàn quyền quản lý tài khoản" as an absolute
  rule rather than something a permission edit could accidentally loosen.
  `changeRole`/`setStatus` additionally block an Admin acting on their own
  account (can't change your own role, can't disable yourself) so a lone
  Admin account can never lock the CMS out from under itself.
- **Server Actions do no authorization logic of their own** — see any
  `actions.ts` under `src/app/admin/(protected)/**`: each one calls
  `requireSession()` (or `requirePermission()` directly, for actions with
  no article/user to load first) and then the matching service method,
  which re-checks permission and ownership independently. A Server Action
  that forgot its own check would still be blocked by the service; this is
  the actual reason a UI button being visible was never treated as
  sufficient anywhere in this codebase.
- **Why re-check in the service when the route/action already checked**:
  because a route or action calling the wrong service method, or a future
  route reusing an existing service method without adding its own check, is
  a realistic mistake — a service that trusts its caller's authorization
  decision has exactly one enforcement point, and it's the one furthest
  from being accidentally skipped.

## Article workflow (CMS brief sections 7 & 9)

```
DRAFT --submit(Contributor own DRAFT, Manager/Admin any)--> IN_REVIEW
IN_REVIEW --approve(Manager/Admin)--> APPROVED
IN_REVIEW --return(Manager/Admin, note required)--> DRAFT (Article.returnNote set)
APPROVED --return(Manager/Admin, note required)--> DRAFT
APPROVED --publish(Manager/Admin, publish-ready only)--> PUBLISHED
APPROVED --schedule(Manager/Admin, publish-ready + future UTC instant)--> SCHEDULED
SCHEDULED --publish(Manager/Admin, publish-ready only)--> PUBLISHED
PUBLISHED --unpublish(Manager/Admin)--> ARCHIVED
DRAFT/IN_REVIEW/APPROVED/SCHEDULED --archive(Manager/Admin)--> ARCHIVED
ARCHIVED --restoreFromArchive(Manager/Admin)--> DRAFT
```

`ALLOWED_TRANSITIONS` in `articleService.ts` is the single source of truth
for which status changes are legal at all — `assertTransitionAllowed` is
checked in addition to the permission check, so even an Admin can't jump
`DRAFT` straight to `PUBLISHED` by calling the wrong method with a crafted
request. No separate "Trưởng Ban Biên tập" role or step exists — Admin
already has every Manager permission by construction and can intervene at
any step, exactly as the brief specifies, without a fourth role. The CMS
brief's diagram labels the return step's destination "RETURNED" — this is
not a fifth `ArticleStatus` value; a returned article is `DRAFT` again with
`Article.returnNote` set (cleared automatically the next time it's
resubmitted), so `submitForReview`'s existing "DRAFT -> IN_REVIEW" path
already covers "CONTRIBUTOR chỉnh sửa → SUBMIT REVIEW lại" without a
separate status or method.

**"Lưu trữ" vs. "Gỡ bài" — two audit actions, one destination status.**
`archive()` (any non-`PUBLISHED` status -> `ARCHIVED`, `ARCHIVE_ARTICLE` in
the audit log) and `unpublish()` (`PUBLISHED` -> `ARCHIVED`,
`UNPUBLISH_ARTICLE`) share a permission (`article.unpublish`) and a
destination status, but each refuses the other's starting status —
`unpublish` on a `DRAFT` and `archive` on a `PUBLISHED` article both throw.
They're kept separate because they're different real-world events ("gỡ một
bài đang sống" vs. "dọn một bản nháp cũ") that an auditor reading
`AuditLog` later should be able to tell apart, even though the resulting
`Article.status` is identical either way. `restoreFromArchive()` (the
`ARCHIVED -> DRAFT` edge `ALLOWED_TRANSITIONS` already permitted) is the
inverse of both, logged as `RESTORE_ARTICLE`.

**Editing is locked, not just hidden, once a Contributor's article leaves
DRAFT.** Brief: "Cộng tác viên không được tự ý sửa nếu workflow đang khóa
bài, trừ khi bài được trả lại." `assertCanEdit` (used by `update`,
`autosaveDraft`, and the submit step itself) rejects a Contributor's edit
attempt on their own article whenever its status isn't `DRAFT` — including
mid-review, mid-schedule, or after publishing. Manager/Admin's
`article.edit.any` is not status-gated: they're the ones performing
review-workflow actions on non-DRAFT articles, and touching content while
doing so (fixing a typo before publishing) is expected, not a bypass.
`/admin/articles/[id]/edit` reflects this by disabling every field and
autosave when `articleService.canEdit()` returns false for the viewing
Contributor — a UI courtesy on top of the server-enforced rejection, not
the actual guard.

**Publish-readiness (brief section 14).** `assertPublishReady` — checked
inside `publish()` and `schedule()`, not just at the form layer — refuses a
missing title, category, or empty block list, reading the live `Article`
row (not whatever the last save's in-memory state happened to be).

**Slugs (brief section 12).** `articleService`'s `handleSlugChange` runs on
every `update()`/`autosaveDraft()` call that touches `slug`: it rejects a
slug already used by another article (`Article.slug` is `@unique`, but this
throws a specific message instead of surfacing Postgres's raw constraint
error), and — "Nếu bài đã public và slug thay đổi: thiết kế redirect
history" — if the article being renamed has ever gone live (`publishedAt`
set), the old slug is snapshotted into `ArticleSlugHistory` before the
rename. `articleRepository.findByOldSlug()` exists for the public
`/tin-tuc/[slug]` route to 301 an old bookmarked/indexed URL to the
article's current slug on a lookup miss — see that route for how it's
wired in. Slug editability in the UI follows `canEdit` exactly (Admin/
Manager always, Contributor only while DRAFT) — no separate policy check
was needed since "can edit this article's content at all" already answers
"can edit its slug."

**Revisions (brief section 13).** Every `create`/`update`/`restoreRevision`
call snapshots the full post-write `Article` (fields + blocks) into
`ArticleRevision`, versioned per-article. `articleService.listRevisions`
gates viewing behind the same ownership/permission check as editing
(`canView`: `article.edit.any`, or `article.edit.own` + ownership) — a
Contributor sees only their own article's history. `restoreRevision` is
gated behind `article.edit.any` specifically (Manager/Admin only, per the
brief: "CONTRIBUTOR chỉ xem revision bài mình") and restores only the
editorial content fields (title/subtitle/excerpt/SEO fields/blocks) from
the snapshot — deliberately not category/author/organization/province/
cover/slug/status, since those are relations and workflow state a revision
snapshot shouldn't blindly reconnect (a taxonomy row the snapshot points at
may have since been renamed or removed). Restoring itself creates a new
revision and an audit entry (`RESTORE_REVISION`), so restoring is a normal
tracked edit, not a hidden rewrite of history.

**Author selection (brief section 4).** `assertAuthorAllowed` restricts a
Contributor to setting `Article.authorId` to their own linked
`AuthorProfile` (found via `authorProfileRepository.findByUserId`) or
leaving it unset — never another author's profile. Manager/Admin
(`article.edit.any`) may set any author. This is the one CMS field
`create`/`update` treat as sensitive; category/topic/tag/organization/
province carry no such restriction.

**Autosave (brief section 6).** `autosaveDraft` is a separate, lighter
method from `update`: DRAFT-only (rejects otherwise, same as `assertCanEdit`
would for a Contributor, but checked explicitly since Manager/Admin could
otherwise autosave a non-DRAFT article they're allowed to edit), and
deliberately creates no `ArticleRevision` snapshot and no `AuditLog` entry
— a debounced background save firing every few seconds would otherwise
flood both with noise neither is meant to hold. The explicit "Lưu" button
always goes through `update()` instead, which does create a revision and an
audit entry.

## User management (brief section 7)

`/admin/users`, gated by `requirePermission("user.manage")` — Admin only.
Every mutation goes through `userService`, which independently re-asserts
`actor.role === "ADMIN"` (see "Server authorization" above): list, search
(by name/email/username), filter by role and status, create, edit basic
info, change role (except one's own), disable/enable (except one's own,
and disabling immediately destroys every session that account holds — see
`docs/AUTHENTICATION.md`, "Forced logout"), reset password (returns a
one-time temporary password to the Admin; the account's other sessions are
destroyed so the reset takes effect immediately). The role `<select>` in
`CreateUserForm.tsx`/the per-row change-role form both iterate
`ASSIGNABLE_ROLES` — there is no code path that can present a role beyond
the three, since the dropdown's option list *is* that array, not a
hand-typed set of three `<option>` tags that could drift from it.

## Audit log

`auditLogRepository.record()`, called from every service method listed in
brief section 12: `LOGIN`, `LOGOUT`, `CREATE_USER`, `UPDATE_USER`,
`CHANGE_ROLE`, `DISABLE_USER`, `ENABLE_USER`, `RESET_PASSWORD`,
`CREATE_ARTICLE`, `UPDATE_ARTICLE`, `SUBMIT_REVIEW`, `APPROVE_ARTICLE`,
`RETURN_ARTICLE`, `PUBLISH_ARTICLE`, `UNPUBLISH_ARTICLE`,
`SCHEDULE_ARTICLE`. Each row records `actorId`, `action`, `entityType`,
`entityId`, a timestamp, and an optional `metadata` JSON blob for
action-specific extras (e.g. `RETURN_ARTICLE`'s note, `CHANGE_ROLE`'s new
role) — **never** a password, token, secret, or cookie value, per brief
section 12's explicit exclusion list; nothing in this codebase constructs
an `AuditLog.metadata` payload from any of those fields.

`ADMIN`'s dashboard (`(protected)/dashboard/page.tsx`) reads the 8 most
recent entries via `auditLogRepository.listRecent()` (brief section 11);
Manager/Contributor dashboards don't query or render audit data at all —
not filtered client-side, simply never fetched for those roles.

## Testing (brief section 15 — mandatory)

`npm test` runs `src/server/__tests__/authorization.test.mts` (Node's
built-in test runner, real dev database, no mocked business logic — only
`@/server/auth/session`'s `destroyAllSessionsForUser` export is mocked, and
only because that module also imports `next/headers`/`next/navigation`,
which require a live Next.js request scope that a plain Node test process
doesn't have; see the file's own header comment for the exact mechanism).
It calls `articleService`/`userService` directly — the same functions every
Server Action calls — not through HTTP or the rendered UI:

- Full `hasPermission()` matrix: Admin holds every permission; Manager
  lacks `user.manage`/`user.changeRole`/`system.configure`/
  `auditlog.view.full` but holds the full content workflow; Contributor
  holds only `article.create`/`article.edit.own`/`article.submit`/
  `media.manage.own`.
- Contributor can create and submit their own article; cannot approve,
  publish, schedule, unpublish, or delete anything; cannot edit another
  Contributor's article.
- Manager can approve, publish, and return an article for revision; must
  unpublish a `PUBLISHED` article before deleting it, while Admin can
  delete one directly.
- Manager and Contributor both get a rejected call for every
  `userService` method (create/changeRole/setStatus/resetPassword) —
  covering brief section 15's "Manager không được nâng chính mình lên
  Admin / không được quản lý Admin" as a structural guarantee
  (`assertIsAdmin` rejects Manager unconditionally, regardless of target)
  rather than a special case for self-promotion specifically.
- Admin cannot change their own role or disable their own account; Admin
  *can* create a user, change another user's role, and disable/re-enable
  another account, with the returned object confirmed to carry no
  `passwordHash` field (the `PublicUser` DTO).

The CMS task's own `describe` block extends this with the workflow rules
that only matter once a real content-editing UI exists: a Contributor
locked out of editing their own article once it's `IN_REVIEW`, and able to
edit again after it's returned; `autosaveDraft` succeeding on a DRAFT and
rejecting once submitted; `publish`/`schedule` refusing a block-less
article; a slug collision rejected and an old slug of a since-published
article recorded in `ArticleSlugHistory`; `archive()`/`unpublish()`
refusing each other's starting status; `restoreRevision` rejected for a
Contributor but working for a Manager (restoring the pre-edit title);
`assertAuthorAllowed` rejecting a Contributor claiming someone else's
`AuthorProfile` while allowing their own, and allowing a Manager to claim
any; and `listForAdmin` ignoring a Contributor-supplied `createdById` that
tries to point at someone else's articles.

Fixtures (throwaway users/articles/category/author-profiles,
`test-authz-*`-prefixed) are created in `before()` and deleted in `after()`
— a full test run leaves the database exactly as it found it, confirmed by
querying for leftover `test-authz-*` rows after a run.

Manual Playwright verification covered both tasks' surfaces: the
authentication-foundation task's route guard 403s, generic login errors,
and session invalidation on disable (`docs/AUTHENTICATION.md`, "Testing");
this CMS task's own real-browser run drove the full lifecycle end to end —
Contributor creates a draft via `/admin/articles/new`, adds a paragraph
block, watches autosave report "Đã lưu", submits for review, is locked out
of editing and sees no Duyệt/Xuất bản buttons; Manager sees it under the
"Chờ duyệt" tab, returns it with a note; Contributor sees the note banner,
edits, resubmits; Manager approves and publishes; the production
`ArticleDetailView` renders correctly at `/preview/articles/[id]` with the
"Đang xem trước" banner and the actual block content; the route guard on
an unrelated permission (`/admin/users`) is still intact after all these
changes; and Admin deletes the article — plus a second run exercising
search/tab filtering on `/admin/articles` and a Manager restoring an
older `ArticleRevision` through the UI.

## Remaining work for a future CMS task

Everything below is explicitly out of scope for the two CMS tasks
completed so far (authentication/authorization foundation, then the
`/admin/articles` workflow CMS), not an oversight:

- **Full CRUD UI for Organizations, Events, and Homepage placements** —
  `/admin/organizations`, `/admin/events`, `/admin/homepage` are still
  read-only, permission-gated listing pages. `/admin/categories`,
  `/admin/topics`, `/admin/tags` have a working create form but no
  edit/delete/reorder.
- **Real media upload** — `/admin/media` and the CMS's `MediaPicker`
  (used for cover images and every image/gallery/youtube block) both work
  against `MediaAsset` metadata rows only; a media asset is registered by
  typing in a Drive file id/YouTube video id/placeholder, not by uploading
  a real file. There's no upload pipeline (Google Drive/YouTube
  integration) wired to the admin UI yet — see `mediaActions.ts`'s header
  comment.
- **A drag-and-drop block editor** — `BlockEditor.tsx` supports add/
  delete/duplicate/reorder (via up/down buttons, not drag handles) for all
  8 block types; a future task could add pointer-based reordering without
  changing the underlying `blocks` array contract.
- **Rich inline text formatting in the paragraph block** — the editor
  applies bold/italic to an entire paragraph, not to an arbitrary
  selection within it (the domain's `TextRun[]` model supports multiple
  runs with independent formatting; the current editor UI only ever
  produces one run per paragraph). Links inside paragraph text (`TextRun.href`)
  aren't editable from the block editor UI yet either.
- **`system.configure`'s actual settings page** — the permission exists;
  no `/admin/settings` UI does yet.
- **A distributed rate-limit store** and **email delivery for password
  resets** — see `docs/AUTHENTICATION.md`, "What this task does not add".
- **A production hosting decision** — removing `output: "export"` (required
  to support Cookies/Server Actions at all) means GitHub Pages no longer
  works for this app; `docs/DEPLOYMENT.md` documents the current state and
  defers the actual choice of a Node-capable host.
