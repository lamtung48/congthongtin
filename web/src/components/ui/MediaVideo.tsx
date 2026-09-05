"use client";

import styles from "./MediaVideo.module.css";
import { MediaImage } from "./MediaImage";
import { IconOffline, IconPlay } from "@/components/icons";
import type { MediaAsset } from "@/domain/media";
import { resolveVideoPlaybackSource, resolveVideoUnavailableReason, type VideoUnavailableReason } from "@/lib/media/resolveMedia";

/**
 * The one place that knows how to render a video slot in either of its two
 * modes — a clickable thumbnail (`playing={false}`), or the "now playing"
 * surface (`playing={true}`) a caller swaps in once the viewer presses play
 * (e.g. inside a modal, as `VideoSection` does).
 *
 * States handled (via `resolveVideoUnavailableReason` — see its own doc
 * comment for the full list):
 * - **thumbnail**: `<MediaImage>` for the cover, plus a play button once
 *   `resolveVideoPlaybackSource` can actually resolve a URL.
 * - **unavailable / removed / processing**: no source connected yet, taken
 *   down, or a freshly-uploaded YouTube video still being transcoded — same
 *   visual slot as unavailable, each with its own label.
 * - **private / embed_disabled / upload_failed / quota_exceeded**:
 *   YouTube-specific states where the CMS has a row for the video but it
 *   genuinely cannot be embedded right now (brief section 7) — same slot,
 *   specific label.
 * - **playing**: a real `<iframe>` once `resolveVideoPlaybackSource`
 *   resolves a URL; otherwise the same reason-specific note.
 * - **responsive ratio**: like `MediaImage`, this fills its parent
 *   (`position: absolute; inset: 0`) — the caller's own CSS controls the
 *   aspect ratio (e.g. `aspect-ratio: 16/9` on `.player`), unchanged.
 */

const REASON_LABELS: Record<Exclude<VideoUnavailableReason, "missing" | "removed">, string> = {
  processing: "Video đang được xử lý, vui lòng quay lại sau.",
  private: "Video này đang ở chế độ riêng tư.",
  embed_disabled: "Chủ kênh đã tắt tính năng nhúng cho video này.",
  upload_failed: "Video tải lên không thành công.",
  quota_exceeded: "Không thể tải video lúc này, vui lòng thử lại sau.",
};

const PLAYING_FALLBACK_NOTE: Record<Exclude<VideoUnavailableReason, "missing">, string> = {
  ...REASON_LABELS,
  removed: "Video này đã bị gỡ khỏi kênh. Vui lòng chọn video khác trong playlist.",
};

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
  const unavailableReason = resolveVideoUnavailableReason(media);
  const connected = !unavailableReason;

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
          {unavailableReason && unavailableReason !== "missing"
            ? PLAYING_FALLBACK_NOTE[unavailableReason]
            : "Video sẽ phát tại đây. Nếu video không khả dụng, bản dựng thật sẽ hiển thị liên kết mở trên kênh YouTube của Hội."}
        </span>
      </div>
    );
  }

  const unavailableLabelText =
    unavailableReason === "removed"
      ? removedLabel
      : unavailableReason && unavailableReason !== "missing"
        ? REASON_LABELS[unavailableReason]
        : unavailableLabel;

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
          <span className={styles.unavailLabel}>{unavailableLabelText}</span>
        </span>
      )}
    </div>
  );
}
