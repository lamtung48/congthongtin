"use client";

import { useEffect, useRef, useState } from "react";
import { MediaPlaceholder } from "./MediaPlaceholder";
import type { MediaAsset } from "@/domain/media";
import { resolveImageUrl } from "@/lib/media/resolveMedia";
import { VARIANT_WIDTHS } from "@/lib/media/variantWidths";

/**
 * Drop-in replacement for `<MediaPlaceholder need="..." />` wherever a slot
 * might eventually hold a real image. Fills its parent exactly like
 * `MediaPlaceholder` does (`position: absolute; inset: 0`) — every parent
 * keeps controlling size/aspect-ratio through its own CSS, unchanged.
 *
 * States handled: `missing` (no resolvable source — see `resolveMedia.ts`
 * for what counts as one per provider) falls back to `MediaPlaceholder`, and
 * so does `failed` (the URL 404s or the file was removed) rather than a
 * broken-image icon. While an image is still arriving, the slot shows its
 * parent's own background; the browser paints the image over it.
 *
 * The image is **never hidden behind React state**, and that is the whole
 * point of the `complete` check below. It used to render at `opacity: 0`
 * until an `onLoad` handler flipped a `loaded` flag — which worked on a cold
 * first visit and broke on every reload afterwards. `/api/media/[id]`
 * responses carry `Cache-Control: public, max-age=31536000, immutable`, so on
 * F5 the browser satisfies them from its own cache almost instantly: the
 * `load` event fires on the server-rendered `<img>` *before* React hydrates
 * and attaches `onLoad`, the event is missed, the flag never flips, and every
 * cached image stays permanently invisible with the grey slot showing
 * through. Visibility now belongs to the browser, and React state only
 * decides whether to swap in a placeholder after a genuine failure.
 *
 * `priority` opts out of the default `loading="lazy"` for the rare image
 * that's above the fold on first paint (the Hero cover, Featured News' main
 * card) — everywhere else, deferring the image request until it's near the
 * viewport is free, native lazy loading with no JS cost. See
 * `docs/PERFORMANCE.md`.
 */
export function MediaImage({
  media,
  className,
  priority = false,
  sizes = "(max-width: 700px) 100vw, 50vw",
  highRes = false,
}: {
  media: MediaAsset;
  className?: string;
  priority?: boolean;
  /** CSS `sizes` for the `srcset` ladder. The default assumes a card that is
   *  full-width on phones and about half the viewport on desktop; a full-bleed
   *  slot (the Hero) should pass `"100vw"`. */
  sizes?: string;
  /** For a large slot showing a YouTube still: try the 1280px version first
   *  and quietly drop back to the default one if this video has none
   *  (YouTube answers that with a 404 or a 120×90 grey tile). No effect on
   *  Drive images, which already get a `srcset`. */
  highRes?: boolean;
}) {
  const baseSrc = resolveImageUrl(media);
  const hiSrc = highRes ? resolveImageUrl(media, { youtubeSize: "max" }) : undefined;
  const imgRef = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);
  const [hiFailed, setHiFailed] = useState(false);
  // Reset on a new source — computed during render (not an effect) since it's
  // state derived from a prop change.
  const [prevSrc, setPrevSrc] = useState(baseSrc);
  if (baseSrc !== prevSrc) {
    setPrevSrc(baseSrc);
    setFailed(false);
    setHiFailed(false);
  }
  const tryingHi = !!hiSrc && hiSrc !== baseSrc && !hiFailed;
  const src = tryingHi ? hiSrc : baseSrc;

  function onBroken() {
    if (tryingHi) setHiFailed(true);
    else setFailed(true);
  }

  // An image that finished (or failed) before hydration fired its event with
  // no handler attached, so ask the element directly instead of waiting for
  // one that will never come. `complete` with `naturalWidth === 0` is the
  // standard "this one errored" signal; a ≤120px-wide answer to a hi-res
  // request is YouTube's "no such size" tile.
  useEffect(() => {
    const img = imgRef.current;
    if (!img || !img.complete) return;
    if (img.naturalWidth === 0 || (tryingHi && img.naturalWidth <= 120)) onBroken();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-check only when the requested URL changes
  }, [src]);

  const missing = !src || failed;
  const placeholderText = media.placeholder ?? media.caption ?? "";

  // Drive-backed images can be served at a chosen width (`?w=`), so offer the
  // browser the ladder and let it pick — a 300px card was otherwise
  // downloading the full 1600px original. Only for our own delivery route:
  // YouTube thumbnail URLs have fixed sizes we don't control.
  const isOwnRoute = src?.startsWith("/api/media/") ?? false;
  const srcSet = isOwnRoute
    ? VARIANT_WIDTHS.map((w) => `${src}?w=${w} ${w}w`).join(", ")
    : undefined;

  return (
    <div className={className} style={{ position: "absolute", inset: 0 }}>
      {missing && <MediaPlaceholder need={placeholderText} />}
      {src && !failed && (
        // A plain `<img>`, not `next/image`: sources span this app's own
        // `/api/media/[id]` route (Drive) and YouTube's public thumbnail
        // host, and this component has no server-side context to pick a
        // `next/image` loader/remotePattern per asset at render time.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={src}
          srcSet={srcSet}
          sizes={srcSet ? sizes : undefined}
          alt={media.alt ?? ""}
          loading={priority ? "eager" : "lazy"}
          decoding={priority ? "sync" : "async"}
          fetchPriority={priority ? "high" : "auto"}
          onError={onBroken}
          onLoad={tryingHi ? (e) => { if (e.currentTarget.naturalWidth <= 120) setHiFailed(true); } : undefined}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      )}
    </div>
  );
}
