"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import styles from "./VideoSection.module.css";
import { MediaImage } from "@/components/ui/MediaImage";
import { MediaVideo } from "@/components/ui/MediaVideo";
import { Reveal } from "@/components/ui/Reveal";
import { IconArrowRight, IconPlay } from "@/components/icons";
import type { Video } from "@/domain/video";
import { formatDateVi } from "@/lib/formatDate";
import { useModalDialog } from "@/lib/hooks/useModalDialog";


/**
 * The homepage shows a fixed six: one in the large player and five stacked
 * in the column beside it. `getVideos()` returns the whole catalogue (it also
 * backs `/video`'s full listing), so the cap belongs here, next to the layout
 * that depends on it — the two-column grid is designed around this count, and
 * a growing catalogue would otherwise stretch the right-hand column well past
 * the player.
 *
 * Which six: the order `getVideos()` already produced — CMS-pinned first, in
 * pin order, then newest (`lib/videoOrder.ts`). So pinning a video on
 * /admin/media/videos both puts it in the player and decides who makes the
 * cut.
 */
const HOMEPAGE_VIDEO_COUNT = 6;

export function VideoSection({ videos }: { videos: Video[] }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const shown = videos.slice(0, HOMEPAGE_VIDEO_COUNT);
  // Clamp rather than trust the state: the list can shrink under a selection
  // that was valid a moment ago (a video unpublished between two ISR
  // revalidations), and `shown[stale]` would be `undefined` — the same shape
  // of crash an empty gallery once caused during prerender.
  const active = Math.min(index, Math.max(shown.length - 1, 0));
  const main = shown[active];

  useEffect(() => {
    if (!playing) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [playing]);

  useModalDialog(playing, backdropRef, () => setPlaying(false), closeBtnRef);

  function selectVideo(i: number) {
    if (i === active) return;
    setIndex(i);
    setPlaying(false);
  }

  // No published video at all: no section. Also the guard that keeps `main`
  // from being `undefined` two lines into the JSX — an empty Gallery once
  // failed `next build` outright for exactly this reason, and this component
  // dereferences its main item just as directly.
  if (!main) return null;

  return (
    <section aria-label="Video và phóng sự" className={styles.section}>
      <div className={styles.inner}>
        <div className={styles.head}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span className={styles.eyebrow}>Kênh YouTube của Hội</span>
            <h2 className={styles.title}>Video &amp; phóng sự</h2>
          </div>
          <Link href="/video" className={styles.playlistLink}>
            Toàn bộ playlist
            <IconArrowRight size={14} />
          </Link>
        </div>

        <div data-l="video" className={styles.grid}>
          <Reveal className={styles.mainCol}>
            <div className={styles.player}>
              <MediaVideo media={main.media} onPlayClick={() => setPlaying(true)} playLabel={`Phát video: ${main.title}`} />
              <span className={styles.playerScrim} />
              <span className={styles.duration}>{main.durationLabel}</span>
            </div>
            <div className={styles.metaBlock}>
              <div className={styles.metaRow}>
                <span className={styles.cat}>{main.category.name}</span>
                <span className={styles.date}>{formatDateVi(main.publishedAt)}</span>
              </div>
              <h3 className={styles.mainTitle}>{main.title}</h3>
              <p className={styles.mainDesc}>{main.description}</p>
            </div>
          </Reveal>

          <div role="list" aria-label="Danh sách phát" className={styles.playlist}>
            <span className={styles.playlistLabel}>Trong playlist</span>
            {/* The five that are not currently in the player — the one that
                is already fills the large slot, and listing it again would
                make the section read as seven items instead of six. */}
            {shown.map((v, i) => ({ v, i })).filter(({ i }) => i !== active).map(({ v, i }) => (
              <div key={v.id} role="listitem" className={styles.playlistItem}>
                <button type="button" onClick={() => selectVideo(i)} aria-label={`Chọn video: ${v.title}`} className={styles.thumbBtn}>
                  <MediaImage media={v.media} sizes="120px" />
                  <span className={styles.thumbOverlay}>
                    <IconPlay size={18} />
                  </span>
                </button>
                <div className={styles.plMeta}>
                  <div className={styles.plMetaRow}>
                    <span className={styles.plCat}>{v.category.name}</span>
                    <span className={styles.plDuration}>{v.durationLabel}</span>
                    {!(v.media.status === "ready" && v.media.sourceId) && <span className={styles.plBadgeOffline}>Chưa có nguồn</span>}
                  </div>
                  <button type="button" onClick={() => selectVideo(i)} className={styles.plTitleBtn} style={{ color: "var(--ink-300)" }}>
                    {v.title}
                  </button>
                </div>
              </div>
            ))}
            <div className={styles.plFootRow}>
              <span />
              <span className={styles.plFootNote}>Trình phát chỉ nạp khi bạn bấm phát. Không có video nào tự phát kèm âm thanh.</span>
            </div>
          </div>
        </div>
      </div>

      {playing && (
        <div ref={backdropRef} onClick={() => setPlaying(false)} role="dialog" aria-modal="true" aria-label="Trình phát video" className={styles.modalBackdrop}>
          <div className={styles.modalInner} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalFrame}>
              <MediaVideo media={main.media} playing playLabel={main.title} />
            </div>
            <div className={styles.modalFoot}>
              <span className={styles.modalTitle}>{main.title}</span>
              <button ref={closeBtnRef} type="button" onClick={() => setPlaying(false)} className={styles.modalCloseBtn}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
