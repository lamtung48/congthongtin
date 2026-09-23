"use client";

import { useState } from "react";
import { MediaVideo } from "@/components/ui/MediaVideo";
import type { MediaAsset } from "@/domain/media";

/** Click-to-play for one card on `/video` — the still (custom thumbnail or
 *  YouTube's own) until pressed, then the embed in place. Same contract as
 *  the homepage section and article YouTube blocks (`MediaVideo`). */
export function VideoCardPlayer({ media, title }: { media: MediaAsset; title: string }) {
  const [playing, setPlaying] = useState(false);
  return <MediaVideo media={media} playing={playing} onPlayClick={() => setPlaying(true)} playLabel={`Phát video: ${title}`} />;
}
