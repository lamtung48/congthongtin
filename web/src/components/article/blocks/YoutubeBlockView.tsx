"use client";

import { useState } from "react";
import styles from "./ArticleBody.module.css";
import { MediaVideo } from "@/components/ui/MediaVideo";
import type { YoutubeBlock } from "@/domain/articleContent";

/**
 * The one block that needs client-side state (thumbnail vs. "now playing"),
 * so it's split out from the otherwise server-rendered `ArticleBody`. Reuses
 * `MediaVideo` — the same click-to-play contract as the homepage's video
 * section, including its accessible iframe `title` once a real playback
 * source resolves (see `docs/MEDIA_ARCHITECTURE.md`).
 */
export function YoutubeBlockView({ block }: { block: YoutubeBlock }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className={styles.videoFrame}>
      <MediaVideo media={block.media} playing={playing} onPlayClick={() => setPlaying(true)} playLabel={block.title} />
    </div>
  );
}
