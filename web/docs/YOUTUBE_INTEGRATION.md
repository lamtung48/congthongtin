# YouTube Video Integration

How the CMS uploads, links, browses, and plays video entirely through a
connected YouTube channel — the task that gives editors a real video
workflow without ever storing a video file on this app's own VPS. Same
three-role model throughout (`docs/AUTHORIZATION.md`) — no fourth role, no
new permission primitive beyond `media.manage.own`/`media.manage.any`,
which already existed from the Google Drive media task
(`docs/GOOGLE_DRIVE_MEDIA.md`).

## Why YouTube, and why nothing is ever written to the VPS

The brief's hard constraint: video is uploaded/managed from inside the CMS,
but the video file itself always lives on YouTube — never on this app's own
disk, never in the database. Two things follow:

1. **Storage and playback both live entirely on YouTube.** The CMS stores
   only a `MediaAsset` row per video: YouTube's video id, cached
   title/description/visibility/duration, and a status. The public site
   embeds YouTube's own player (`youtube-nocookie.com/embed/...`); nothing
   here ever proxies or re-encodes video bytes.
2. **An uploaded file is only ever held in memory for the duration of one
   request**, same discipline as the Drive image upload path —
   `src/server/integrations/youtube.ts` accepts a `Buffer` and wraps it in a
   `Readable` purely so `videos.insert` (the one YouTube Data API call that
   streams) has something stream-shaped to read from. No `fs.writeFile`
   anywhere in this path, ever.

## Why OAuth 2.0, not a service account

Google Drive media storage authenticates as a service account (a JWT) —
that works because the CMS uploads *into its own* Drive space. YouTube has
no equivalent: uploading a video "into" a channel requires that channel
owner's own consent. There is no service-account flow for "upload to
someone else's YouTube channel," so this task uses a real OAuth 2.0
authorization-code flow instead:

1. An Admin clicks **"Kết nối kênh YouTube"** on `/admin/media/videos`
   (`youtubeService.beginConnect`, Admin-only). A random CSRF nonce
   (`state`) is generated and stored in a short-lived, httpOnly cookie
   (`yt_oauth_state`, 600s) before redirecting the Admin's browser to
   Google's consent screen (`access_type: "offline"`, `prompt: "consent"` —
   both required to reliably get a *refresh* token back, since Google only
   issues one on first consent or when explicitly re-prompted).
2. Google redirects back to `GET /api/admin/youtube/oauth/callback` with a
   `code` and the same `state`. The route re-checks `state` against the
   cookie (CSRF mitigation — without this, a third party could trick an
   Admin's browser into completing a connection with an attacker's
   authorization code) before calling `youtubeService.completeConnect`.
3. The exchanged refresh token is encrypted (AES-256-GCM, key derived via
   SHA-256 from `YOUTUBE_TOKEN_ENCRYPTION_KEY`) and stored in the single
   `YoutubeConnection` row (`id: "default"` — a fixed-id singleton, since
   this CMS connects exactly one channel at a time). Every subsequent
   upload/list/update call decrypts it, mints a short-lived access token via
   `google-auth-library`'s own refresh handling, and calls the YouTube Data
   API v3 as that channel.

Every role can see *whether* a channel is connected and its display name
(`youtubeService.getConnectionStatus`); nobody but the module that holds the
decrypted token (`src/server/integrations/youtube.ts`, `import
"server-only"`) ever sees the token itself — see "Security" below.

## Package choice

`@googleapis/youtube` (a scoped package containing only the YouTube Data
API), not the full `googleapis` package. Its own re-exported `auth.OAuth2`
is used instead of installing `google-auth-library` directly — the same
lesson learned from the Google Drive task's `JWT` class conflict
(`docs/GOOGLE_DRIVE_MEDIA.md`, "Package choice"): two separately-installed
copies of the same-named auth class are structurally incompatible to
TypeScript (private-field identity), so using the client's own re-export
guarantees exactly one `OAuth2Client` class exists in the dependency tree.
`@googleapis/youtube` and `@googleapis/drive` both depend on the same
`googleapis-common@^8.0.0`, so this holds for both integrations
simultaneously without a version-pinning workaround.

The one OAuth scope requested is
`https://www.googleapis.com/auth/youtube` — full read/write over the
connected channel's videos. There is no narrower "upload only" scope that
also permits listing/updating existing videos, which "chọn video đã có
trên kênh" (brief section 2) needs.

## Permission matrix (brief section 1)

| Action | ADMIN | MANAGER | CONTRIBUTOR |
|---|---|---|---|
| Connect/disconnect the YouTube channel (OAuth) | ✓ | ✗ | ✗ |
| View connection status (channel name, connected date) | ✓ | — (not shown) | — (not shown) |
| Upload a new video | ✓ | ✓ | Only if `YOUTUBE_ALLOW_CONTRIBUTOR_UPLOAD=true` |
| Choose visibility (public/unlisted/private) on upload | ✓ | ✓ | ✗ — always forced to `unlisted` |
| Paste an existing video's URL/ID to link it | ✓ | ✓ | ✓ |
| Browse the connected channel's own uploads | ✓ | ✓ | ✗ |
| Import a video found by browsing the channel | ✓ | ✓ | ✗ |
| Edit metadata (title/description) of **own** video | ✓ | ✓ | ✓ |
| Edit metadata of **any** video | ✓ | ✓ | ✗ |
| Change a video's visibility | ✓ (any value) | ✓ (any value) | Only to `unlisted`, only own |
| Attach a **PRIVATE** video to an article's YouTube block | ✗ (blocked for everyone) | ✗ | ✗ |
| Unlink a video from the CMS library (never deletes it on YouTube) | ✓ | ✓ | ✓ (own only, subject to usage policy) |

Every row is enforced inside `src/server/services/youtubeService.ts`,
independently of what the UI shows or hides — the same "don't
hide-as-authorization" discipline as the rest of this codebase
(`docs/AUTHORIZATION.md`). The **PRIVATE-blocked-from-article-block** row
applies to every role including Admin: this was a deliberate product
decision (see "Policy decisions" below), not a permission gap — a private
video can never be embedded for an anonymous site visitor regardless of who
attached it.

## Three ways to add a video (brief section 2)

All three end up as one `MediaAsset` row with `provider: "YOUTUBE"`:

1. **Upload from the CMS** — `VideoUploader.tsx` → `POST
   /api/admin/media/videos/upload` → `youtubeService.uploadVideo` →
   `uploadVideoToYoutube` (`videos.insert`). Creates a *new* video on the
   connected channel.
2. **Paste a URL or raw video id** — `parseYoutubeVideoId()`
   (`src/server/validation/youtubeUrl.ts`) accepts a bare 11-character id or
   any of YouTube's common URL shapes (`watch?v=`, `youtu.be/`, `/embed/`,
   `/shorts/`, `/v/`, with or without `www.`/`m.`/`music.`) and normalizes
   it to the 11-character id. `youtubeService.linkExistingVideo` then
   verifies that id against the real Data API (`videos.list`) before
   creating a `MediaAsset` — a syntactically valid id that doesn't actually
   exist is a normal outcome (a clear "không tìm thấy video" error), not a
   crash.
3. **Browse the connected channel's uploads** —
   `youtubeService.listChannelUploadsForPicker` reads the channel's uploads
   *playlist* (`playlistItems.list`), not `search.list` — one API-quota unit
   instead of a hundred, and no eventual-consistency delay after a fresh
   upload. Selecting a result calls `importChannelVideo`, which shares its
   verify-then-create logic with path 2 above (`importChannelVideoById`).

Every path is available from two places: the standalone video library
(`/admin/media/videos`, `AddVideoPanel.tsx`) and inline inside the article
editor's YouTube block (`VideoPicker.tsx`, used by `ArticleYoutubeView` in
`tiptap/nodes.tsx`) — both are thin UI shells over the same
`youtubeService`/Server Action functions in
`src/app/admin/(protected)/media/videos/actions.ts`.

## Upload flow

```
Browser (VideoUploader)
  → XMLHttpRequest POST /api/admin/media/videos/upload  (multipart/form-data)
  → Route Handler: session + permission check
  → validateVideoUpload()     — magic bytes, size, extension-vs-real-format
  → youtubeService.uploadVideo()
      → resolvePrivacyForUpload()   — forces "unlisted" for a Contributor upload
      → uploadVideoToYoutube()      — YouTube Data API v3, videos.insert
      → getVideoStatus()            — best-effort immediate read (often still PROCESSING)
      → mediaRepository.create()    — MediaAsset row + UPLOAD_VIDEO audit log
  → 201 { media: {...} } back to the browser
```

A Route Handler, not a Server Action, for the same reason as the image
upload path (`docs/GOOGLE_DRIVE_MEDIA.md`, "Upload flow"): a Server
Action's default request-body cap is smaller than a video file, while a
Route Handler has no such framework-imposed limit. The whole file is
buffered into memory before validation or upload (Next's Route Handlers
expose the body as a Web `Request`, with no API for treating one
`multipart/form-data` part as a live stream) — accepted up to **200 MiB**
(`MAX_VIDEO_UPLOAD_BYTES`, `src/server/validation/videoUpload.ts`), a larger
cap than images since it's the same in-memory-buffer approach applied to a
much bigger file type; see "Current limitations" below for what that
implies at scale.

`sniffVideoFormat()` confirms the buffer is actually MP4/MOV/WEBM/AVI by
magic bytes — never trusts the declared `Content-Type`: WEBM's EBML header
(`1A 45 DF A3`), AVI's `RIFF...AVI` container, and MP4 vs. MOV distinguished
by the `ftyp` box's "major brand" field (`"qt  "` → MOV, everything else →
MP4). Unlike the image path, this does **not** read duration or resolution
locally — YouTube's own processing pipeline is the source of truth for
those, read back via `getVideoStatus()` after upload (or on demand via
"Làm mới trạng thái").

## Video Library (`/admin/media/videos`)

A dedicated page rather than folded entirely into `/admin/media` — video
has its own OAuth connection banner (Admin-only), its own add-video panel
(upload / paste / browse-channel), and columns no image row needs
(visibility, duration, processing/error status). It shares its underlying
data layer with the image library — `mediaRepository`/`mediaService`'s
generic `MediaAdminFilter` (now including an optional `visibility` filter)
and the same usage-tracking/delete-policy engine — so a video's "Sử dụng"
badge and unlink confirmation flow behave identically to an image's (see
`docs/GOOGLE_DRIVE_MEDIA.md`, "Usage tracking and the delete policy").

Table columns: thumbnail (`https://img.youtube.com/vi/<id>/mqdefault.jpg`,
a public YouTube URL — no server proxying needed, unlike a private Drive
file), title, video id, visibility badge, duration (formatted from
`durationSeconds`), status badge plus a specific error-reason line when one
applies (see "Error handling" below), uploader, created date, and per-row
actions (edit metadata, refresh status, unlink).

**Unlinking a video from this library never deletes it on YouTube** —
`mediaService.remove()` only calls the provider's real delete for
`GOOGLE_DRIVE`; a `YOUTUBE`-provider `MediaAsset` row is always just a
pointer the CMS forgets, never a command sent to the channel. A channel's
videos can outlive their presence in any one CMS's content, and an Admin
who unlinks by mistake hasn't destroyed anything.

## Article block (brief section 5/6)

The `YOUTUBE` article block stores **only** `{ mediaId, title }` in its JSON
`data` — never an `<iframe>` string, never a raw embed URL. Rendering is
resolved fresh every time from the referenced `MediaAsset`:

```
ArticleYoutubeView (editor) / YoutubeBlockView (public site)
  → MediaVideo(media)
      → resolveVideoUnavailableReason(media)   (src/lib/media/resolveMedia.ts)
      → resolveVideoPlaybackSource(media)
          → https://www.youtube-nocookie.com/embed/<videoId>?rel=0
```

`youtube-nocookie.com` is YouTube's own privacy-enhanced embed domain — it
sets no cookies until a visitor actually presses play inside the iframe,
which `MediaVideo` only renders once its `playing` state is already true
(a deliberate click-to-play gate, doubling as the "lazy-load the iframe"
brief asked for: the real `<iframe>` never exists in the DOM until a
visitor opts in).

**A PRIVATE video can never be selected into this block** — brief section
3's explicit decision (see "Policy decisions" below): filtered out at the
data source (`articles/[id]/edit/page.tsx` only ever sends non-`PRIVATE`
videos into `options.video`) and, independently, in the picker UI itself
(`VideoPicker.tsx` filters its dropdown, and its `registerAndSelect` guard
refuses to auto-select a freshly linked/imported video that turns out to be
`PRIVATE` — it's still saved to the library, just not attached to the
block, with an inline warning explaining why).

## Error handling and status states (brief section 7)

`MediaAsset.status` (`READY`/`MISSING`/`REMOVED`/`PROCESSING`) tracks the
asset's general lifecycle; a separate `errorReason` free-text field
(`youtubeService.ts`'s `mapUploadStatusToMedia`) carries the *specific*
reason a `READY` (or `REMOVED`) video still can't actually be embedded:

| `status` | `errorReason` | Meaning | Shown as |
|---|---|---|---|
| `PROCESSING` | — | YouTube is still transcoding a freshly-uploaded video | "Video đang được xử lý, vui lòng quay lại sau." |
| `READY` | `private` | Video exists and processed, but its privacy is `private` | "Video này đang ở chế độ riêng tư." (also hard-blocked from article blocks) |
| `READY` | `embed_disabled` | Channel owner disabled embedding for this video | "Chủ kênh đã tắt tính năng nhúng cho video này." |
| `REMOVED` | `removed` | The video no longer resolves on YouTube at all | "Video đã bị gỡ khỏi kênh." |
| `REMOVED` | `upload_failed` | YouTube rejected/failed the upload itself | "Video tải lên không thành công." |
| (any) | `quota_exceeded` | The YouTube Data API call itself hit a quota limit | "Không thể tải video lúc này, vui lòng thử lại sau." |

Both the admin library (`/admin/media/videos`'s status column) and the
public/preview renderer (`MediaVideo.tsx`'s `resolveVideoUnavailableReason`
+ its `REASON_LABELS`/`PLAYING_FALLBACK_NOTE` maps) read the same two
fields, so an editor and a site visitor see consistent, specific messages
for the same underlying state — never a generic "something went wrong."
"Làm mới trạng thái" (`youtubeService.refreshStatus`) re-reads the video's
current state from YouTube on demand, since these fields are cached at
upload/link time and don't otherwise update themselves.

At the integration-boundary level, `src/server/integrations/youtube.ts`
raises exactly one of:

- **`YoutubeNotConfiguredError`** — the four `YOUTUBE_OAUTH_*`/
  `YOUTUBE_TOKEN_ENCRYPTION_KEY` env vars aren't all set. This is the state
  of every environment that hasn't provisioned real OAuth credentials yet
  (including this task's own development environment).
- **`YoutubeNotConnectedError`** — configured, but no Admin has completed
  the consent flow yet. Distinct from "not configured" so the UI can tell
  "nobody set up credentials" apart from "credentials exist, someone just
  needs to click Connect."
- **`YoutubeOperationError`** — the Data API call itself failed (quota,
  revoked/expired consent, video not found, network).
  `describeYoutubeError()` never lets the raw `googleapis`/`gaxios` error
  reach a browser; it logs server-side and returns one of a small set of
  safe, specific Vietnamese messages, classified into a short machine
  `reason` code (`quota_exceeded`/`unauthorized`/`forbidden`/`not_found`/
  `unknown`) any caller can persist without re-parsing a message string.

All three are caught at every entry point (route handlers, Server Actions)
and surfaced as a clear inline message — never a crash, never a half-saved
`MediaAsset`.

## Audit log (brief section 8)

Five actions, `entityType` either `"MediaAsset"` or `"YoutubeConnection"`,
never a token in the metadata: `UPLOAD_VIDEO`, `LINK_VIDEO` (covers both
"dán URL/ID" and "chọn từ kênh" — both are "attach an existing video," not
a new upload), `UPDATE_VIDEO`, `CONNECT_YOUTUBE`, `DISCONNECT_YOUTUBE`.
"Làm mới trạng thái" is deliberately **not** audited — a read-triggered
cache refresh isn't itself a content change worth its own log entry.

## Security (brief section 9)

- The OAuth client secret and the connected channel's refresh token are
  only ever held inside `src/server/integrations/youtube.ts`, which starts
  with `import "server-only"` — an accidental import from a Client
  Component is a build error, not a code-review miss to catch by hand.
- The refresh token is never stored in plaintext — AES-256-GCM at rest
  (`encryptToken`/`decryptToken`), keyed by a hash of
  `YOUTUBE_TOKEN_ENCRYPTION_KEY`. No admin screen, API response, or Server
  Action return value ever includes it — `getConnectionStatus` returns only
  `channelId`/`channelTitle`/`connectedAt`.
- A CONTRIBUTOR can never read connection status, start/complete the OAuth
  flow, or browse the raw channel — those are Admin-only
  (`assertIsAdmin`)/Admin-or-Manager-only (`media.manage.any`) checks inside
  `youtubeService.ts`, re-verified on every call regardless of what the UI
  shows.
- The OAuth callback route validates `state` against a short-lived httpOnly
  cookie before accepting a `code` — see "Why OAuth 2.0" above.

## Policy decisions (env var, not a UI setting)

Two choices in the original brief were left open for this deployment to
decide, and were made explicitly (not by default) for this build:

1. **"CONTRIBUTOR nếu được upload" is a deployment-wide environment
   variable, `YOUTUBE_ALLOW_CONTRIBUTOR_UPLOAD`** (default `false`), not a
   database-backed, live-editable setting. Changing it requires a redeploy.
   This keeps the policy surface identical to how Google Drive credentials
   themselves are configured (`.env.example`, never a UI screen) and avoids
   building a settings table/UI for a single boolean. A Contributor's
   upload is forced to `unlisted` regardless of this flag or what the form
   requests (`resolvePrivacyForUpload`) — the flag only ever widens *whether
   they can upload at all*, never *what visibility they can choose*.
2. **A `PRIVATE` video is blocked entirely from an article's YouTube
   block**, for every role, not merely flagged with a warning. This is
   stricter than image/other media handling elsewhere in this codebase (which
   generally warns rather than hard-blocks), chosen because a private
   video's failure mode for a public visitor is total and silent — an
   embedded private video simply won't play for anyone outside the
   channel's own permissions, with no useful in-page fallback to show. See
   "Article block" above for where this is enforced (both server-side data
   filtering and client-side picker filtering).

## Testing

`src/server/__tests__/authorization.test.mts`'s "Video library — tích hợp
YouTube" suite calls `youtubeService`/`mediaService` directly (no HTTP
layer), against the real dev database — the same pattern the Google Drive
suite in the same file already uses.
`@/server/integrations/youtube` is mocked at the module level
(`node:test`'s `mock.module`), keyed by a small set of fixed 11-character
video ids (the exact format `parseYoutubeVideoId` requires) mapped to
different YouTube states (public/unlisted/private/embed-disabled/removed),
so `linkExistingVideo`/`importChannelVideo` exercise the same
"verify-against-the-real-API" code path production traffic takes, just
against this in-memory fake. Only that one integration boundary is faked;
every permission/policy/visibility rule inside `youtubeService` itself
still runs for real. Covered: the Contributor-upload env-var gate (and that
it always forces `unlisted`), free visibility choice for Manager/Admin,
URL/id parsing and its "not found" rejection, channel-browse permission
(Admin/Manager only), metadata-edit ownership + the "Contributor can only
set unlisted" rule, `refreshStatus` correctly detecting a video removed out
from under the CMS, the visibility filter on `/admin/media/videos`'s
`listForAdmin`, and the full OAuth connect/disconnect flow's Admin-only
gate. One pre-existing test in the same file
(`registerManualLink`'s old "liên kết video vẫn mở cho Contributor" case)
was updated to reflect that this task removed that carve-out —
`mediaService.registerManualLink` no longer has a video-specific branch at
all, since `youtubeService.linkExistingVideo` (verified against the real
API) fully replaces the old "trust a hand-typed id" manual-link path for
video.

Run with `npm test`. `npm run build`, `npx tsc --noEmit`, and `npx eslint .`
were all run clean after this task's changes. Playwright verification in
this environment (no real Google OAuth client available) confirmed:

- The permission matrix renders correctly per role on
  `/admin/media/videos` — Admin sees the connection banner and every
  add-video option; Manager sees upload/paste/browse but no connection
  banner; Contributor sees only "Dán URL/ID".
- With no OAuth env vars configured, the connection banner correctly shows
  "Chưa kết nối kênh YouTube… Hệ thống chưa cấu hình OAuth client," and
  attempting to link a video surfaces
  `YoutubeNotConfiguredError`'s exact message inline, with no crash.
- The article editor's YouTube block correctly shows the same three
  add-video options as the standalone library page, and an existing
  fixture video block with no resolvable option renders its fallback badge
  instead of breaking the editor.

## Current limitations / explicitly out of scope

- **No real Google OAuth client exists in this development environment**
  (no Google Cloud Console access was available while building this).
  Every piece of integration code is written against the real YouTube Data
  API v3 and was verified for correct behavior *up to* the point of an
  actual network call — see "Testing" above for how the rest was verified
  without one, and `.env.example` for what to set once a real OAuth client
  exists.
- **The whole video file is buffered in memory** during upload (same
  constraint as the Drive image path, at a much larger 200 MiB scale) —
  acceptable for this CMS's editorial-team upload volume, but a
  higher-traffic deployment would want a streaming multipart parser or a
  resumable-upload flow instead.
- **No cross-tab/cross-node live-sync for the video picker's option list**
  — unlike `MediaPicker`'s `registerMediaOption` registry for images,
  `VideoPicker` only updates its own local state when a video is
  added/imported/uploaded from inside one open editor tab. A second tab (or
  a second editor open at the same time) won't see a video added elsewhere
  until it reloads. A known, accepted limitation at this CMS's scale, not a
  bug.
- **The public site (`/tin-tuc/[slug]`) still reads from fixture data, not
  the real database** — this predates the YouTube task (see
  `docs/GOOGLE_DRIVE_MEDIA.md` and `src/server/content/
  articleContentResolver.ts`'s own header comment) and remains out of
  scope here. `resolveVideoPlaybackSource`/`resolveVideoUnavailableReason`
  are fully implemented in `src/lib/media/resolveMedia.ts` and already
  power `/admin/articles/[id]/preview` (which does read the real
  database) — wiring the public route to the same real data source is a
  separate, already-flagged task, not something the YouTube integration
  needed to touch.
