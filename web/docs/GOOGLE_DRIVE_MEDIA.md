# Google Drive Media

How the CMS uploads, stores, tracks, and serves images through Google
Drive — the task that replaced `mediaService.ts`'s former "metadata now,
real file later" placeholder (see `docs/AUTHORIZATION.md`'s Media Library
section for the world before this task) with a real upload/delivery
pipeline. Same three-role model throughout (`docs/AUTHORIZATION.md`) — no
fourth role, no new permission primitive beyond `media.manage.own`/
`media.manage.any`, which already existed.

## Why Google Drive, and why nothing is ever written to the VPS

The brief's hard constraint: editors upload images from inside the CMS, but
nothing lands in `public/uploads`, `uploads/`, or any other path on the
app's own disk. Two things follow from that:

1. **Storage lives entirely in Google Drive** — a Shared Drive when
   `GOOGLE_DRIVE_SHARED_DRIVE_ID` is set (preferred whenever a Google
   Workspace makes one available), otherwise a plain "My Drive" folder via
   `GOOGLE_DRIVE_FOLDER_ID`, otherwise the service account's own Drive root.
2. **The server only ever holds an uploaded file in memory**, for the
   duration of one request. `src/server/integrations/googleDrive.ts`
   accepts a `Buffer` and wraps it in a `Readable` purely so the one Drive
   API call that streams (`files.create`) has something stream-shaped to
   read from — no `fs.writeFile` anywhere in this path, ever.

Authentication is a service-account **JWT**, not user-delegated OAuth: this
is a CMS uploading on behalf of the application, not a human's own Drive,
so there is no per-editor consent screen and no refresh-token lifecycle to
manage. It requests the full `drive` scope rather than the narrower
`drive.file`, because `drive.file` only grants access to files the app
itself created *through that exact OAuth client* — a Shared Drive multiple
things write into doesn't fit that narrower scope.

## Package choice

`@googleapis/drive` (a scoped package containing only the Drive API), not
the full `googleapis` package (which bundles hundreds of unrelated Google
APIs). Its own re-exported `auth.JWT` is used instead of installing
`google-auth-library` as a direct dependency — that package pins its own
copy of `google-auth-library` transitively, and TypeScript treats two
separately-installed copies of the same-named `JWT` class as structurally
incompatible (private-field identity). Using the client's own re-export
guarantees exactly one `JWT` class exists in the dependency tree.

`image-size` was deliberately **not** used for reading an uploaded image's
dimensions, despite being the obvious npm choice — see
`src/server/validation/mediaUpload.ts`'s header comment: an `npm audit` at
the time turned up two open, unpatched high-severity DoS advisories in it
(infinite loops in its ICNS/JXL/HEIF parsers), and the package picks its
parser by sniffing the buffer's own magic bytes regardless of the declared
MIME type — so a client could label a malicious file `image/jpeg` and still
reach the vulnerable code path. `mediaUpload.ts` instead re-implements
magic-byte sniffing and dimension reading for exactly the four formats this
CMS accepts (JPEG/PNG/GIF/WEBP), with no third-party dependency in that
path at all.

## Permission matrix (brief section 1)

| Action | ADMIN | MANAGER | CONTRIBUTOR |
|---|---|---|---|
| Upload an image | ✓ | ✓ | ✓ (own use) |
| Browse the full Media Library (to reuse an asset) | ✓ | ✓ | ✓ |
| Edit alt/caption of **any** asset | ✓ | ✓ | ✗ |
| Edit alt/caption of **own** asset | ✓ | ✓ | ✓ |
| Delete an asset with **zero** usage | ✓ | ✓ | ✓ (own only) |
| Delete an asset with usage, force-clearing optional references | ✓ (`force: true`) | ✗ | ✗ |
| Delete an asset with a *required* usage (Gallery item / Video source) | ✗ (always refused) | ✗ | ✗ |
| Manual "liên kết file có sẵn" — an **image** by Drive file id | ✓ | ✓ | ✗ |
| Manual "liên kết file có sẵn" — a **video** by YouTube id | ✓ | ✓ | ✓ |
| Configure Google Drive credentials / folder / Shared Drive id | ✗ | ✗ | ✗ |

Nobody — not even Admin — configures Drive credentials from inside the
CMS; that's an environment variable set at deploy time (see
`.env.example`), never a UI setting, so it can't be read back out through
any admin screen either. Every row above is enforced in
`src/server/services/mediaService.ts`, independently of what the UI shows
or hides — the standard "don't hide-as-authorization" discipline this
codebase uses everywhere (`docs/AUTHORIZATION.md`).

The manual-link split (image vs. video) exists because a video has no
upload path to fall back to at all — a YouTube video already lives on
YouTube, there's nothing to "upload" — so linking one by id is the *only*
way to add it, and stays open to whoever can reach the picker. An image
does have a real upload path (`MediaUploader` → `POST
/api/admin/media/upload`), which validates the file server-side; the manual
Drive-file-id form bypasses that validation, so it's restricted to
`media.manage.any` (Admin/Manager) as a deliberate escape hatch, not the
everyday path.

Viewing the library is **not** scoped by actor
(`mediaService.listForAdmin`'s own header comment explains why) — a
Contributor can see and reuse an image someone else uploaded, per brief
section 5. Only *managing* an asset (edit metadata, delete) is
ownership-gated.

## Upload flow

```
Browser (MediaUploader)
  → XMLHttpRequest POST /api/admin/media/upload  (multipart/form-data, one request per file)
  → Route Handler: session + permission check
  → validateImageUpload()   — magic bytes, size, extension-vs-real-format, dimensions
  → uploadFileToDrive()     — Google Drive API v3, files.create
  → mediaService.registerUpload()  — MediaAsset row + UPLOAD_MEDIA audit log
  → 201 { media: {...} } back to the browser
```

A **Route Handler**, not a Server Action — a Server Action's request body
is capped at 1MB by default (raisable only via a global `next.config.ts`
setting), while a Route Handler has no such framework-imposed limit. One
file per `XMLHttpRequest` so `MediaUploader` gets a real
`upload.onprogress` event per file (`fetch` has none) and so one large,
slow, or failing upload never blocks the others in a multi-file selection.

The whole file is read into memory (`Buffer.from(await
file.arrayBuffer())`) before validation or upload — Next's Route Handlers
expose the incoming body as a Web `Request`, which has no API for treating
one `multipart/form-data` part as a live stream, so there was no streaming
alternative available here. The buffer is discarded once the request
finishes; it is never written to disk.

`buildStorageFilename()` names the file on Drive after a randomly generated
id, never the client-supplied filename — the original name survives only
as display metadata (`MediaAsset.filename`), never as a path or an
argument trusted for anything else (brief section 9: "Không tin
filename").

## Validation (`src/server/validation/mediaUpload.ts`)

Every upload — before a byte reaches Google Drive:

1. **Non-empty, ≤ 10 MiB.**
2. **Magic-byte sniff** confirms the buffer is actually JPEG, PNG, GIF, or
   WEBP — never trusts the declared `Content-Type`.
3. **Extension check** — the client-supplied filename's extension must
   match the *sniffed* format, not the other way around.
4. **Dimension read**, format-specific (PNG's `IHDR` chunk, GIF's Logical
   Screen Descriptor, JPEG's SOF marker segment, WEBP's VP8/VP8L/VP8X
   sub-formats) — stored on `MediaAsset.width`/`height` for any caller that
   needs an aspect ratio without fetching the file itself.

Any failure returns a plain, specific Vietnamese error string (wrong
format, size exceeded, extension mismatch) — the Route Handler relays it
as JSON, `MediaUploader` renders it inline with a **Thử lại** (retry)
button next to the failed file.

## Media metadata (`MediaAsset`)

No binary ever passes through the database — `id`, `provider`
(`GOOGLE_DRIVE` / `YOUTUBE` / `LOCAL_PLACEHOLDER`), `providerFileId`,
`type`, `mimeType`, `filename`, `width`, `height`, `size`, `alt`,
`caption`, `status`, `createdById`, `createdAt`/`updatedAt` — exactly the
field list brief section 6 asked for. `status` (`READY` / `MISSING` /
`REMOVED` / `PROCESSING`) is what a resolver checks before ever trying to
serve a file — see "Public delivery" below.

## Usage tracking and the delete policy (brief section 7)

An asset can be referenced two different ways, and `MediaUsageDetail`
(`src/server/repositories/mediaRepository.ts`) reports both together:

- **A direct, typed foreign key** — most content types point at a
  `MediaAsset` this way: `Article.coverMediaId`/`ogMediaId`,
  `Organization.logoMediaId`, `Event.coverMediaId`,
  `AuthorProfile.avatarMediaId`, `User.avatarMediaId`, `Topic.coverMediaId`
  (all **optional** — "soft" usage), and `GalleryItem.mediaId` /
  `Video.mediaId` (both **required**, `NOT NULL` — "hard" usage,
  `hardBlock: true`).
- **A `MediaUsage` row** — for the one case with no schema-level FK to
  attach to: an image referenced from inside an `ArticleBlock.data` JSON
  blob (an `IMAGE`, `GALLERY`, or `YOUTUBE` block's `mediaId`/`mediaIds`).
  `mediaRepository.replaceArticleBlockUsages()` rewrites the full set for
  one article every time `articleService` calls `replaceBlocks` (`create`,
  `update`, `autosaveDraft`, `restoreRevision`) — "whole list, not a diff,"
  the same contract `replaceBlocks` itself already uses.

"Homepage" isn't its own usage row: a homepage placement always points at
an Article/Gallery/Event/Platform, never at a `MediaAsset` directly, so it
surfaces transitively through that Article/Gallery/Event's own usage row
above. `Platform` has no media field in this schema at all.

**Delete policy** (`mediaService.remove`), in order:

1. A `hardBlock` usage (Gallery item, Video source) **always** refuses —
   Postgres can't null a `NOT NULL` column, and silently deleting the
   parent Gallery/Video the caller never asked to touch would be a
   surprising side effect. No role, not even Admin, can force past this;
   the fix is to remove the asset from that Gallery/Video first.
2. Otherwise, any usage at all refuses for Contributor and Manager
   unconditionally — "không được xóa media đang được nhiều bài sử dụng" is
   read as a hard rule for those two roles, not a warning.
3. For Admin, any *soft* usage without `force: true` throws
   `MediaInUseError`, carrying the full usage list so the UI can render it
   as a confirmation prompt (`MediaRowActions.tsx` on `/admin/media`) rather
   than a dead end.
4. Admin retrying with `force: true` nulls every optional FK pointing at
   the asset (`mediaRepository.clearOptionalReferences`) before deleting
   it. `MediaUsage` rows need no separate cleanup — deleting the
   `MediaAsset` row cascades those away (`onDelete: Cascade` in the
   schema).

Deleting the underlying Drive file is **best-effort-but-blocking**: if
`deleteFileFromDrive` fails, the `MediaAsset` row is *not* deleted either —
the alternative (deleting the DB row while the real file still exists on
Drive) would leave the system's own bookkeeping permanently wrong about
what actually got removed.

## Public delivery (brief section 8)

Nothing outside `src/server/integrations/googleDrive.ts` ever sees a raw
Google Drive URL. The full chain:

```
MediaImage(mediaAsset)
  → resolveImageUrl()          (src/lib/media/resolveMedia.ts)
  → provider === "drive" && status === "ready"
      → `/api/media/${mediaAsset.id}`
  → Route Handler: mediaId → mediaRepository.findById → providerFileId
      → getDriveFileStream()  → streamed back with Content-Type/Cache-Control
```

`GET /api/media/[mediaId]` takes a `MediaAsset.id`, not a Drive file id —
the indirection is the point: nothing upstream of this route ever needs to
know or store a Drive identifier, and this route can refuse cleanly
(404) for a missing/removed/non-Drive asset before ever calling Google.
There is no session check on this route: a published article's images are
public content, same as everything else `/tin-tuc/[slug]` serves. The
response sets a long `Cache-Control` (an asset's bytes never change in
place — replacing an image means a new upload and a new `MediaAsset` row,
never mutating an existing one).

`youtube`-provider assets are not resolved yet (`resolveImageUrl` still
returns `undefined` for that branch) — out of scope for this task, see
`docs/MEDIA_ARCHITECTURE.md`.

## Security (brief section 9)

- MIME/extension/size/dimension validation happens server-side, in one
  place (`mediaUpload.ts`), before any Drive call — see "Validation" above.
- The client-supplied filename is used only for a cosmetic extension check
  and as display metadata; the file stored on Drive is always named after a
  freshly generated random id.
- Credentials (`GOOGLE_DRIVE_CLIENT_EMAIL`/`GOOGLE_DRIVE_PRIVATE_KEY`) are
  read only inside `googleDrive.ts`, which starts with `import
  "server-only"` — an accidental import from a Client Component is a build
  error, not a code-review miss to catch by hand.
- No admin screen anywhere reads or displays these credentials; changing
  them requires editing the deploy environment directly.

## Error handling (brief section 10)

Two distinct failure modes, surfaced as different HTTP statuses and
different error classes:

- **`GoogleDriveNotConfiguredError`** (503) — the required env vars are
  simply absent. This is the state of every environment that hasn't set up
  a real service account yet (including this task's own development
  environment) — uploads and deletes fail immediately with a clear
  Vietnamese message ("Google Drive chưa được cấu hình…"), the editor page
  itself does not crash, and nothing is left half-written.
- **`GoogleDriveOperationError`** (502) — Drive is configured but the API
  call itself failed (quota, revoked credential, file not found, network).
  `describeDriveError()` never lets the raw `googleapis`/`gaxios` error
  object reach a browser (it can carry request config); it logs the real
  error server-side and returns one of a small set of safe, specific
  Vietnamese messages.

On the public delivery side, a failed/unconfigured Drive read never breaks
the page around it — `MediaImage` already treats "no URL resolved" as a
normal, first-class state and falls back to `MediaPlaceholder` (this
predates this task; see `docs/MEDIA_ARCHITECTURE.md`).

## Audit log (brief section 11)

Three actions, `entityType: "MediaAsset"`, never a credential in the
metadata: `UPLOAD_MEDIA` (both a real upload and the Admin/Manager manual
link — the metadata's `manual: true` flag distinguishes the two),
`UPDATE_MEDIA` (alt/caption changes), `DELETE_MEDIA`.

## Testing

`src/server/__tests__/authorization.test.mts`'s "Media library — tích hợp
Google Drive" suite calls `mediaService`/`articleService` directly (no
HTTP layer), against the real dev database, the same pattern the rest of
that file already uses. `@/server/integrations/googleDrive` is mocked at
the module level (`node:test`'s `mock.module`) so the suite never needs
real Drive credentials — only that one integration boundary is faked; every
permission, ownership, and usage-block rule under test still runs for
real. Covered: upload registration, metadata-edit ownership, the
manual-link image/video split, the full delete policy (own-only + hard vs.
soft usage + force-delete clearing optional FKs), and `ArticleBlock`
usage sync.

Run with `npm test`. `npm run build` and `npx tsc --noEmit` were also run
clean after this task's changes.

## Current limitations / explicitly out of scope

- **No real Google Drive credentials exist in this development
  environment** (no Google Cloud Console access was available while
  building this). Every piece of integration code is written against the
  real Drive API v3 and was verified for correct behavior *up to* the
  point of an actual network call — see "Testing" above for how the rest
  was verified without one, and `.env.example` for what to set once a real
  service account exists. Playwright verification in this environment
  confirmed the intended graceful-failure path: attempting an upload shows
  "Google Drive chưa được cấu hình…" inline, with a working retry button,
  and the rest of the article editor keeps working around it.
- **YouTube delivery resolution** (`resolveImageUrl`'s `youtube` branch)
  remains unwired, as it was before this task — this task's scope was
  Google Drive image storage, not the YouTube integration.
- **The "usage" filter on `/admin/media`** has no backing database column
  (usage is computed by walking every FK/`MediaUsage` row per asset, not
  stored), so filtering by it scans up to 500 matching rows and paginates
  the filtered result in memory rather than at the database. Acceptable
  for an internal admin tool at this CMS's scale; would need a materialized
  usage-count column to scale further.
