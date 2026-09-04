"use client";

import styles from "./MediaVideo.module.css";
import { MediaImage } from "./MediaImage";
import { IconOffline, IconPlay } from "@/components/icons";
import type { MediaAsset } from "@/domain/media";
import { resolveVideoPlaybackSource } from "@/lib/media/resolveMedia";

/**
 * The one place that knows how to render a video slot in either of its two
 * modes — a clickable thumbnail (`playing={false}`), or the "now playing"
 * surface (`playing={true}`) a caller swaps in once the viewer presses play
 * (e.g. inside a modal, as `VideoSection` does).
 *
 * States handled:
 * - **thumbnail**: `<MediaImage>` for the cover, plus a play button when
 *   `media.status === "ready"` and a `sourceId` exists.
 * - **unavailable**: `status !== "ready"` (or no `sourceId`) — no source has
 *   been connected yet. Renders a muted icon + `unavailableLabel` instead of
 *   a play button; the thumbnail below still renders normally.
 * - **removed**: `status === "removed"` — a source existed and was taken
 *   down. Same visual slot as unavailable, distinct label.
 * - **playing / embed disabled fallback**: `resolveVideoPlaybackSource()`
 *   is the only thing that can produce a real embeddable URL; today it
 *   always returns `undefined` (no YouTube integration in scope — see
 *   `docs/MEDIA_ARCHITECTURE.md`), so `playing` mode always renders the
 *   fallback note. Once a resolver returns a URL, this same branch renders
 *   a real `<iframe>` instead, with no caller-side change.
 * - **responsive ratio**: like `MediaImage`, this fills its parent
 *   (`position: absolute; inset: 0`) — the caller's own CSS controls the
 *   aspect ratio (e.g. `aspect-ratio: 16/9` on `.player`), unchanged.
 */
export function MediaVideo({
  media,
  playing = false,
  onPlayClick,
  playLabel,
  unavailableLabel = "Chưa kết nối nguồn video",
  removedLabel = "Video đã bị gỡ khỏi kênh",
  className,
}: {
  media: MediaAsset;
  playing?: boolean;
  onPlayClick?: () => void;
  playLabel?: string;
  unavailableLabel?: string;
  removedLabel?: string;
  className?: string;
}) {
  const removed = media.status === "removed";
  const connected = media.status === "ready" && !!media.sourceId;

  if (playing) {
    const playback = resolveVideoPlaybackSource(media);
    if (playback) {
      return (
        <div className={className} style={{ position: "absolute", inset: 0 }}>
          <iframe
            src={playback.url}
            title={playLabel ?? media.alt ?? "Video"}
            className={styles.embedFrame}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }
    return (
      <div className={`${styles.playing} ${className ?? ""}`}>
        <span className={styles.playCircle}>
          <IconPlay size={22} />
        </span>
        <span className={styles.note}>
          {removed
            ? "Video này đã bị gỡ khỏi kênh. Vui lòng chọn video khác trong playlist."
            : "Video sẽ phát tại đây. Nếu video không khả dụng, bản dựng thật sẽ hiển thị liên kết mở trên kênh YouTube của Hội."}
        </span>
      </div>
    );
  }

  return (
    <div className={className} style={{ position: "absolute", inset: 0 }}>
      <MediaImage media={media} />
      {connected ? (
        <button type="button" onClick={onPlayClick} aria-label={playLabel} className={styles.playBtn}>
          <IconPlay size={24} />
        </button>
      ) : (
        <span className={styles.unavailable}>
          <span className={styles.unavailIcon}>
            <IconOffline size={22} />
          </span>
          <span className={styles.unavailLabel}>{removed ? removedLabel : unavailableLabel}</span>
        </span>
      )}
    </div>
  );
}
