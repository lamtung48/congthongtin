"use client";

import { useState } from "react";
import { MediaPlaceholder } from "./MediaPlaceholder";
import type { MediaAsset } from "@/domain/media";
import { resolveImageUrl } from "@/lib/media/resolveMedia";

type LoadState = "idle" | "loading" | "loaded" | "error";

/**
 * Drop-in replacement for `<MediaPlaceholder need="..." />` wherever a slot
 * might eventually hold a real image. Fills its parent exactly like
 * `MediaPlaceholder` does (`position: absolute; inset: 0`) — every parent
 * keeps controlling size/aspect-ratio through its own CSS, unchanged.
 *
 * States handled: `missing` (no resolvable source — including every asset
 * today, since Drive/YouTube resolution isn't wired up yet, see
 * `resolveMedia.ts`) falls back to `MediaPlaceholder`; `loading` shows the
 * same placeholder underneath while the image decodes; `loaded` cross-fades
 * the real image in; `error` (the URL 404s or the file was removed) falls
 * back to `MediaPlaceholder` again rather than a broken-image icon.
 */
export function MediaImage({ media, className }: { media: MediaAsset; className?: string }) {
  const src = resolveImageUrl(media);
  const [state, setState] = useState<LoadState>(src ? "loading" : "idle");
  // Reset the load state when `src` changes — computed during render (not an
  // effect) since it's state derived from a prop change.
  const [prevSrc, setPrevSrc] = useState(src);
  if (src !== prevSrc) {
    setPrevSrc(src);
    setState(src ? "loading" : "idle");
  }

  const missing = !src || state === "error";
  const placeholderText = media.placeholder ?? media.caption ?? "";

  return (
    <div className={className} style={{ position: "absolute", inset: 0 }}>
      {missing && <MediaPlaceholder need={placeholderText} />}
      {src && state !== "error" && (
        // Source host isn't known yet (Drive/YouTube, behind a future
        // media service) — next/image needs a configured remotePattern,
        // which doesn't exist until a real one is chosen.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={media.alt ?? ""}
          onLoad={() => setState("loaded")}
          onError={() => setState("error")}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: state === "loaded" ? 1 : 0,
            transition: "opacity 200ms ease",
          }}
        />
      )}
    </div>
  );
}
