"use client";

import Link from "next/link";
import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import styles from "./VideoSection.module.css";
import { MediaImage } from "@/components/ui/MediaImage";
import { MediaVideo } from "@/components/ui/MediaVideo";
import { Reveal } from "@/components/ui/Reveal";
import { IconArrowLeft, IconArrowRight, IconClose, IconExternal, IconOffline, IconPlay, IconVideoChannel } from "@/components/icons";
import type { Video } from "@/domain/video";
import { formatDateVi } from "@/lib/formatDate";
import { resolveVideoPlaybackSource, resolveVideoWatchUrl } from "@/lib/media/resolveMedia";
import { YOUTUBE_CHANNEL_URL } from "@/lib/siteChrome";

/**
 * "Kênh YouTube của Hội" — a cinematic stage plus a playlist rail.
 *
 * - **Stage**: the selected video's still (its custom CMS thumbnail when one
 *   is set, else YouTube's own — `resolveImageUrl`), title overlaid, a glass
 *   play orb. Pressing play swaps the still for the embed *in place* (no
 *   modal); the iframe only exists after that click, so nothing loads or
 *   plays on its own.
 * - **Ambient light**: every listed video's still sits blurred behind the
 *   stage and the active one fades in, so the section's glow takes the
 *   colour of whatever is selected. Small images, heavily blurred — the
 *   rail already loads the same URLs.
 * - **Rail**: the playlist, active item marked; scrolls within the stage's
 *   height on desktop, becomes a swipeable strip on narrow screens.
 *
 * Which videos: the order `getVideos()` already produced — CMS-pinned
 * first, in pin order, then newest (`lib/videoOrder.ts`) — capped here so a
 * growing catalogue stays a rail, not a wall; `/video` lists everything.
 */
const HOMEPAGE_VIDEO_COUNT = 10;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function VideoSection({ videos }: { videos: Video[] }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  // The still being replaced stays underneath while the new one fades in.
  const [leaving, setLeaving] = useState<number | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLOListElement>(null);

  const shown = videos.slice(0, HOMEPAGE_VIDEO_COUNT);
  // Clamp rather than trust the state: the list can shrink under a selection
  // that was valid a moment ago (a video unpublished between two ISR
  // revalidations), and `shown[stale]` would be `undefined` — the same shape
  // of crash an empty gallery once caused during prerender.
  const active = Math.min(index, Math.max(shown.length - 1, 0));
  const main = shown[active];

  function selectVideo(i: number, { scrollRail = false } = {}) {
    if (i === active || !shown[i]) return;
    setLeaving(active);
    setIndex(i);
    setPlaying(false);
    if (scrollRail) {
      railRef.current?.querySelector<HTMLElement>(`[data-rail-index="${i}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    }
  }

  // A soft light that follows the pointer across the stage (fine pointers
  // only — CSS hides it for touch and reduced motion).
  function trackPointer(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse" || !stageRef.current) return;
    const r = stageRef.current.getBoundingClientRect();
    stageRef.current.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    stageRef.current.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
  }

  // No published video at all: no section. Also the guard that keeps `main`
  // from being `undefined` two lines into the JSX — an empty Gallery once
  // failed `next build` outright for exactly this reason, and this component
  // dereferences its main item just as directly.
  if (!main) return null;

  const playable = !!resolveVideoPlaybackSource(main.media);
  const watchUrl = resolveVideoWatchUrl(main.media);
  const hasDuration = main.durationLabel !== "—";
  const leavingVideo = leaving !== null && leaving !== active ? shown[leaving] : undefined;

  return (
    <section aria-labelledby="video-section-title" className={styles.section}>
      <div aria-hidden className={styles.ambient}>
        {shown.map((v, i) => (
          <span key={v.id} className={styles.ambientLayer} data-active={i === active ? "true" : undefined}>
            <MediaImage media={v.media} sizes="160px" />
          </span>
        ))}
      </div>
      <span aria-hidden className={styles.grain} />

      <div className={styles.inner}>
        <div className={styles.head}>
          <div className={styles.headCopy}>
            <span className={styles.eyebrow}>
              <span className={styles.liveDot} />
              Kênh YouTube của Hội
            </span>
            <h2 id="video-section-title" className={styles.title}>
              Video <em>&amp;</em> phóng sự
            </h2>
          </div>
          <div className={styles.headActions}>
            <a href={YOUTUBE_CHANNEL_URL} target="_blank" rel="noopener noreferrer" className={styles.subscribe}>
              <IconVideoChannel size={18} />
              Đăng ký kênh
            </a>
            <Link href="/video" className={styles.allLink}>
              Xem tất cả {videos.length} video
              <IconArrowRight size={14} />
            </Link>
          </div>
        </div>

        <div data-l="video" className={styles.layout}>
          <Reveal className={styles.stageCol}>
            <div
              ref={stageRef}
              className={styles.stage}
              data-playing={playing ? "true" : undefined}
              onPointerMove={trackPointer}
            >
              {playing && playable ? (
                <MediaVideo media={main.media} playing playLabel={main.title} />
              ) : (
                <>
                  {leavingVideo && (
                    <span className={styles.still} data-leaving="true">
                      <MediaImage media={leavingVideo.media} sizes="(max-width: 1100px) 100vw, 66vw" highRes />
                    </span>
                  )}
                  <span key={main.id} className={styles.still} data-entering="true" onAnimationEnd={() => setLeaving(null)}>
                    <MediaImage media={main.media} sizes="(max-width: 1100px) 100vw, 66vw" highRes />
                  </span>
                  <span aria-hidden className={styles.spotlight} />
                  <span aria-hidden className={styles.stageScrim} />

                  <span className={styles.counter} aria-hidden>
                    <strong>{pad2(active + 1)}</strong> / {pad2(shown.length)}
                  </span>

                  <div key={`meta-${main.id}`} className={styles.stageMeta}>
                    <div className={styles.chips}>
                      <span className={styles.chip}>{main.category.name}</span>
                      <span className={styles.chipGhost}>{formatDateVi(main.publishedAt)}</span>
                      {hasDuration && <span className={styles.chipGhost}>{main.durationLabel}</span>}
                    </div>
                    <h3 className={styles.stageTitle}>{main.title}</h3>
                  </div>

                  {playable ? (
                    // The whole still is the click target; the orb is its visible face.
                    <button type="button" className={styles.playOrb} onClick={() => setPlaying(true)} aria-label={`Phát video: ${main.title}`}>
                      <span className={styles.orb}>
                        <span aria-hidden className={styles.orbRing} />
                        <span aria-hidden className={styles.orbRing} data-delay="true" />
                        <span className={styles.orbCore}>
                          <IconPlay size={30} />
                        </span>
                      </span>
                    </button>
                  ) : (
                    <span className={styles.offline}>
                      <IconOffline size={18} />
                      Video tạm thời chưa phát được
                    </span>
                  )}
                </>
              )}
            </div>

            <div className={styles.stageFoot}>
              <div className={styles.stageFootCopy}>
                {/* Narrow screens: the overlay keeps only the title, so the rest of the meta lives here. */}
                <p className={styles.footMeta}>
                  <span>{main.category.name}</span>
                  <span>{formatDateVi(main.publishedAt)}</span>
                  {hasDuration && <span>{main.durationLabel}</span>}
                </p>
                <p className={styles.stageDesc}>{main.description || "Phóng sự từ Kênh YouTube của Hội Sinh viên Việt Nam."}</p>
              </div>
              <div className={styles.stageNav}>
                {playing && (
                  <button type="button" className={styles.stopBtn} onClick={() => setPlaying(false)}>
                    <IconClose size={14} />
                    Đóng trình phát
                  </button>
                )}
                {watchUrl && (
                  <a href={watchUrl} target="_blank" rel="noopener noreferrer" className={styles.watchLink}>
                    Mở trên YouTube
                    <IconExternal size={13} />
                  </a>
                )}
                <div className={styles.stepper}>
                  <button
                    type="button"
                    className={styles.stepBtn}
                    onClick={() => selectVideo(active - 1, { scrollRail: true })}
                    disabled={active === 0}
                    aria-label="Video trước"
                  >
                    <IconArrowLeft size={16} />
                  </button>
                  <button
                    type="button"
                    className={styles.stepBtn}
                    onClick={() => selectVideo(active + 1, { scrollRail: true })}
                    disabled={active >= shown.length - 1}
                    aria-label="Video tiếp theo"
                  >
                    <IconArrowRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal as="aside" className={styles.rail} aria-label="Danh sách phát">
            <div className={styles.railInner}>
              <div className={styles.railHead}>
                <span className={styles.railLabel}>Danh sách phát</span>
                <span className={styles.railCount}>{shown.length} video</span>
              </div>
              <ol ref={railRef} className={styles.railList}>
                {shown.map((v, i) => {
                  const isActive = i === active;
                  return (
                    <li key={v.id} data-rail-index={i} style={{ "--i": i } as CSSProperties}>
                      <button
                        type="button"
                        className={styles.item}
                        data-active={isActive ? "true" : undefined}
                        aria-current={isActive ? "true" : undefined}
                        onClick={() => selectVideo(i)}
                        aria-label={`${isActive ? "Đang chọn" : "Chọn video"}: ${v.title}`}
                      >
                        <span className={styles.itemThumb}>
                          <MediaImage media={v.media} sizes="(max-width: 1100px) 240px, 140px" />
                          <span aria-hidden className={styles.itemThumbShade} />
                          {isActive ? (
                            <span aria-hidden className={styles.eq} data-playing={playing ? "true" : undefined}>
                              <i />
                              <i />
                              <i />
                            </span>
                          ) : (
                            <span aria-hidden className={styles.itemPlay}>
                              <IconPlay size={16} />
                            </span>
                          )}
                          {v.durationLabel !== "—" && <span className={styles.itemDuration}>{v.durationLabel}</span>}
                        </span>
                        <span className={styles.itemBody}>
                          <span className={styles.itemIndex}>{isActive ? "Đang chọn" : pad2(i + 1)}</span>
                          <span className={styles.itemTitle}>{v.title}</span>
                          <span className={styles.itemDate}>{formatDateVi(v.publishedAt)}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
              <p className={styles.railNote}>Video chỉ phát khi bạn bấm — không tự phát kèm âm thanh.</p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
