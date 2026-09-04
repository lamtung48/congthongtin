# Media Architecture

## Goal

The VPS that eventually serves this site should never be the long-term home
for media files. Images live in Google Drive; videos live on YouTube. This
document describes that target architecture and the contract the frontend
was built against so it can adopt it later **without changing any
component**. No Google Drive API or YouTube API call, and no media
proxy/CDN service, was implemented in this task — see "What's stubbed today"
below for exactly what's real vs. placeholder.

## The contract: `MediaAsset`

Every image and video in the app — Hero, Featured News, the story rail,
video section, activity map cards, the gallery, local news, live events —
is described by one shape, `src/domain/media.ts`:

```ts
interface MediaAsset {
  id: string;
  provider: "drive" | "youtube" | "local-placeholder";
  type: "image" | "video";
  sourceId?: string;       // Drive file id or YouTube video id
  alt?: string;
  caption?: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
  mimeType?: string;
  placeholder?: string;    // shown when no real source resolves
  status: "ready" | "missing" | "removed" | "processing";
  metadata?: Record<string, string | number>;
}
```

No component ever sees a raw Google Drive URL or a raw YouTube URL — not
Hero, not Featured News, not Gallery, not the (future) article page. They
all receive a `MediaAsset` and render it through `MediaImage` or
`MediaVideo`. This is what makes the storage backend swappable later: moving
from "no real file yet" to "a real Drive file" changes fixture/CMS data
(`status`, `sourceId`), never a component.

### `provider`

- **`drive`** — a real photo/document meant to come from Google Drive.
  Every such asset in the current fixtures has `status: "missing"` (no file
  uploaded yet) but already carries its real caption/alt/placeholder text —
  it's genuinely waiting on an upload, not a permanent stand-in.
- **`youtube`** — a video meant to be a YouTube upload. `sourceId` is the
  YouTube video id once connected.
- **`local-placeholder`** — an intentionally generic, decorative slot with
  no per-item file, ever (e.g. a news card's generic "Ảnh bài viết" box).
  This is the one category that doesn't correspond to a future real file —
  see `docs/DATA_MODEL.md`'s note on this same distinction.

### `status`

The content-level lifecycle, known ahead of any render attempt — not to be
confused with a component's runtime load state (below).

| Status | Meaning |
|---|---|
| `ready` | Has a real `sourceId`; safe to attempt resolving/loading |
| `missing` | No file uploaded/connected yet — permanent until content ops does |
| `removed` | A file existed and was taken down |
| `processing` | Uploaded but not yet ready (e.g. Drive/YouTube still processing) |

## The components

### `MediaImage`

`src/components/ui/MediaImage.tsx`. Drop-in replacement for
`<MediaPlaceholder need="..." />` — same box model
(`position: absolute; inset: 0`, fills whatever aspect-ratio'd container the
caller already has), so swapping one for the other changes no CSS anywhere.

| State | When | Renders |
|---|---|---|
| missing | no resolvable URL (every asset today) | `MediaPlaceholder` with `media.placeholder`/`caption` |
| loading | a URL resolved, image not yet decoded | `MediaPlaceholder` underneath, image fading in |
| loaded | `<img onLoad>` fired | the real image, cross-faded in |
| error | `<img onError>` fired (404, removed file) | falls back to `MediaPlaceholder` again, not a broken-image icon |

Alt text (`media.alt`), responsive sizing (fills the parent, which controls
aspect ratio via its own CSS), and the missing/loading/loaded/error state
machine are all handled here, once, instead of per-component.

### `MediaVideo`

`src/components/ui/MediaVideo.tsx`. Handles a video slot in two modes:

- **`playing={false}`** (thumbnail): renders `MediaImage` for the cover, plus
  a play button when `status === "ready"` and a `sourceId` exists, or a
  muted "unavailable"/"removed" message otherwise.
- **`playing={true}`**: renders a real `<iframe>` if
  `resolveVideoPlaybackSource()` returns one (see below — today it never
  does), otherwise the same "video sẽ phát tại đây" fallback that
  `VideoSection`'s modal always showed.

`VideoSection` now composes `MediaVideo` for both its main cover and its
modal's "now playing" surface, instead of hardcoding placeholder/embed
markup in each spot.

### `MediaPlaceholder`

Unchanged (`src/components/ui/MediaPlaceholder.tsx`), and still the thing
every fallback path in `MediaImage`/`MediaVideo` renders. It continues to be
the single source of the "clean neutral placeholder with a note on what's
needed" look used everywhere in this project.

## What's stubbed today

`src/lib/media/resolveMedia.ts` is the **only** place that would turn a
`sourceId` into a real URL:

```ts
export function resolveImageUrl(media: MediaAsset): string | undefined {
  if (media.status !== "ready" || !media.sourceId) return undefined;
  return undefined; // ← always "not resolved" today, see below
}

export function resolveVideoPlaybackSource(media: MediaAsset): { url: string } | undefined {
  if (media.status !== "ready" || !media.sourceId) return undefined;
  return undefined; // ← always "not resolved" today, see below
}
```

Both always return "not resolved" — this task did not integrate the Google
Drive API, the YouTube API, or build any media proxy/CDN service, by
explicit scope. `MediaImage`/`MediaVideo` treat "not resolved" as a normal,
first-class state (fall back to `MediaPlaceholder`), not an error, which is
exactly why nothing else had to change: the frontend was already built
assuming most assets don't have a real URL yet.

## Target architecture (not built yet)

### Image flow

```
CMS (editor uploads a photo)
   │
   ▼
direct upload → Google Drive
   │  (Drive file id)
   ▼
mediaId  ── stored on the Article/Gallery/... record as MediaAsset.sourceId
   │
   ▼
Media Service   (new backend component — not built in this task)
   │  resolves mediaId → a cached, transformed, CDN-fronted URL
   │  (this is what keeps Drive's own sharing/quota model off the hot path,
   │   and is the ONLY thing that talks to the Drive API)
   ▼
cache / CDN
   │
   ▼
frontend  →  resolveImageUrl() returns that CDN URL  →  <MediaImage>
```

The VPS itself never stores the image; at most the Media Service's cache
layer holds transient, regenerable copies.

### Video flow

```
CMS (editor pastes/selects a YouTube video)
   │
   ▼
YouTube  (the video already lives there — no upload through this app)
   │  (video id)
   ▼
youtubeVideoId  ── stored as MediaAsset.sourceId, provider: "youtube"
   │
   ▼
frontend player  →  resolveVideoPlaybackSource() returns an embed URL
                     (e.g. youtube-nocookie.com/embed/{id})  →  <MediaVideo playing>
```

No proxy needed for video at all — YouTube serves the player directly: the
frontend never touches raw video bytes, just an id.

### Wiring it up later

1. Implement the Media Service (image flow) and decide the real embed URL
   scheme (video flow).
2. Fill in `resolveImageUrl`/`resolveVideoPlaybackSource` in
   `resolveMedia.ts` to call them.
3. Set fixture/CMS data's `status` to `"ready"` and `sourceId` to the real
   Drive file id / YouTube video id as content is migrated.
4. If the Media Service's CDN domain is known and stable, consider swapping
   `MediaImage`'s plain `<img>` for `next/image` with that domain added to
   `images.remotePatterns` in `next.config.ts` — optional, not required for
   the contract to work.

Nothing in this list touches a component.

## Report: what uses what today

**Using `MediaImage`/`MediaVideo` with real per-item `MediaAsset` data**
(`provider: "drive"`/`"youtube"`, ready to receive a real file later):
Hero (hero image), Featured News (main article cover), Gallery (all 9
photos), Local News (per-item photo), Live Events (per-event cover),
Video Section (main video + playlist "unavailable" state, via `Video.media`).

**Using `MediaImage` with an inline `local-placeholder` asset** (generic,
non-per-item decorative slots — same visual as before, not wired to
fixture/CMS content because they never were): Featured News (secondary
items' "Ảnh bài viết"), Latest News (lead/card "Ảnh bài viết"), Story Rail
(card "Ảnh phóng sự địa phương"), Video Section (playlist row thumbnails,
"Ảnh video").

**Still `MediaPlaceholder` directly (not migrated in this task):** none in
the homepage — every call site now goes through `MediaImage`/`MediaVideo`.
`MediaPlaceholder` itself is unchanged and is still what every fallback path
renders.

**Not covered by this task (out of scope):** the activity map
(`VietnamMapSvg`) draws SVG shapes, not photos/video — no media contract
applies there. The header/footer logo (`/images/hsv-logo.png`) is a real,
already-shipped static asset via `next/image`, not a Drive/YouTube asset —
left as-is.

## What needs a real backend next

- The Media Service itself (image cache/CDN in front of Drive).
- A decision on the real YouTube embed URL scheme and whether embedding is
  restricted per-video (the "embed disabled" state `MediaVideo` already has
  a slot for, but nothing can trigger without real integration).
- A CMS write path that sets `MediaAsset.status`/`sourceId` when an editor
  actually uploads a Drive file or pastes a YouTube link — today all of that
  is hand-authored in `src/data-access/fixtures/`.
- Once a Media Service domain exists: decide whether to move `MediaImage`
  from a plain `<img>` to `next/image` for automatic resizing/`srcset`.
