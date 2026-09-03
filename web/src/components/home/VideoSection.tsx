"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./VideoSection.module.css";
import { MediaPlaceholder } from "@/components/ui/MediaPlaceholder";
import { Reveal } from "@/components/ui/Reveal";
import { IconExternal, IconOffline, IconPlay } from "@/components/icons";
import { videos } from "@/lib/data/homepage";

export function VideoSection() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const main = videos[index];

  useEffect(() => {
    if (!playing) return;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPlaying(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [playing]);

  function selectVideo(i: number) {
    if (i === index) return;
    setIndex(i);
    setPlaying(false);
  }

  return (
    <section aria-label="Video và phóng sự" className={styles.section}>
      <div className={styles.inner}>
        <div className={styles.head}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span className={styles.eyebrow}>Kênh YouTube của Hội</span>
            <h2 className={styles.title}>Video &amp; phóng sự</h2>
          </div>
          <a href="#" aria-disabled="true" title="Chưa khả dụng trong bản mẫu — cần URL thật khi triển khai" className={styles.playlistLink}>
            Toàn bộ playlist
            <IconExternal size={14} />
          </a>
        </div>

        <div data-l="video" className={styles.grid}>
          <Reveal className={styles.mainCol}>
            <div className={styles.player}>
              <MediaPlaceholder need="Ảnh bìa phóng sự" />
              <span className={styles.playerScrim} />
              {main.videoId ? (
                <button type="button" onClick={() => setPlaying(true)} aria-label={`Phát video: ${main.title}`} className={styles.playBtn} style={{ color: "var(--ink-1000)" }}>
                  <IconPlay size={24} />
                </button>
              ) : (
                <span className={styles.unavailable}>
                  <span className={styles.unavailIcon}>
                    <IconOffline size={22} />
                  </span>
                  <span className={styles.unavailLabel}>Chưa kết nối nguồn video</span>
                </span>
              )}
              <span className={styles.duration}>{main.duration}</span>
            </div>
            <div className={styles.metaBlock}>
              <div className={styles.metaRow}>
                <span className={styles.cat}>{main.category}</span>
                <span className={styles.date}>{main.date}</span>
              </div>
              <h3 className={styles.mainTitle}>{main.title}</h3>
              <p className={styles.mainDesc}>{main.desc}</p>
            </div>
          </Reveal>

          <div role="list" aria-label="Danh sách phát" className={styles.playlist}>
            <span className={styles.playlistLabel}>Trong playlist</span>
            {videos.map((v, i) => {
              const active = i === index;
              return (
                <div key={v.videoId || v.title} role="listitem" className={styles.playlistItem}>
                  {active && <span className={styles.activeBar} />}
                  <button type="button" onClick={() => selectVideo(i)} aria-label={`Chọn video: ${v.title}`} className={styles.thumbBtn}>
                    <MediaPlaceholder need="Ảnh video" />
                    <span className={styles.thumbOverlay}>
                      <IconPlay size={18} />
                    </span>
                  </button>
                  <div className={styles.plMeta}>
                    <div className={styles.plMetaRow}>
                      <span className={styles.plCat}>{v.category}</span>
                      <span className={styles.plDuration}>{v.duration}</span>
                      {active && <span className={styles.plBadgeActive}>Đang chọn</span>}
                      {!v.videoId && <span className={styles.plBadgeOffline}>Chưa có nguồn</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => selectVideo(i)}
                      className={styles.plTitleBtn}
                      style={{ color: active ? "#fff" : "var(--ink-300)" }}
                    >
                      {v.title}
                    </button>
                  </div>
                </div>
              );
            })}
            <div className={styles.plFootRow}>
              <span />
              <span className={styles.plFootNote}>Trình phát chỉ nạp khi bạn bấm phát. Không có video nào tự phát kèm âm thanh.</span>
            </div>
          </div>
        </div>
      </div>

      {playing && (
        <div ref={backdropRef} onClick={() => setPlaying(false)} role="dialog" aria-label="Trình phát video" className={styles.modalBackdrop}>
          <div className={styles.modalInner} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalFrame}>
              <div className={styles.modalPlaceholder}>
                <span className={styles.modalPlayCircle}>
                  <IconPlay size={22} />
                </span>
                <span className={styles.modalNote}>
                  Video sẽ phát tại đây. Nếu video không khả dụng, bản dựng thật sẽ hiển thị liên kết mở trên kênh YouTube của Hội.
                </span>
              </div>
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
