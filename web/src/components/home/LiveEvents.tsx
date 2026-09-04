"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./LiveEvents.module.css";
import { MediaImage } from "@/components/ui/MediaImage";
import { Reveal } from "@/components/ui/Reveal";
import { IconArrowLeft, IconArrowRight, IconMapPin, IconOffline } from "@/components/icons";
import type { Event } from "@/domain/event";
import { buildEventView } from "@/lib/eventView";

function dd(d: Date) {
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}
function hh(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function LiveEvents({ events }: { events: Event[] }) {
  const railRef = useRef<HTMLDivElement>(null);
  const prevRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  // Event status/countdown depends on "now", which must not be computed
  // during SSR (it would differ from the client's hydration-time clock and
  // trigger a hydration mismatch) — so it starts null and is set post-mount.
  const [now, setNow] = useState<Date | null>(null);
  const [counter, setCounter] = useState("");
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  useEffect(() => {
    // Deliberately client-only: reading the real clock here (not in a lazy
    // initializer) is what keeps the first client render identical to the
    // server-rendered markup.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
  }, []);

  const eventViews = now
    ? events.map((e) => buildEventView(e, now)).sort((a, b) => a.order - b.order || a.sortKey - b.sortKey)
    : [];

  function updateRail() {
    const vp = railRef.current;
    if (!vp) return;
    const max = vp.scrollWidth - vp.clientWidth;
    setAtStart(vp.scrollLeft <= 2);
    setAtEnd(vp.scrollLeft >= max - 2);
    const cards = Array.from(vp.querySelectorAll<HTMLElement>("[data-event-card]"));
    if (!cards.length) return;
    const box = vp.getBoundingClientRect();
    let first = -1;
    let last = 0;
    cards.forEach((c, i) => {
      const r = c.getBoundingClientRect();
      if (r.left >= box.left - 4 && r.right <= box.right + 4) {
        if (first < 0) first = i;
        last = i;
      }
    });
    if (first < 0) { first = 0; last = 0; }
    setCounter(`${first + 1}–${last + 1} / ${cards.length}`);
  }

  useEffect(() => {
    updateRail();
    const vp = railRef.current;
    if (!vp) return;
    vp.addEventListener("scroll", updateRail, { passive: true });
    window.addEventListener("resize", updateRail);
    return () => {
      vp.removeEventListener("scroll", updateRail);
      window.removeEventListener("resize", updateRail);
    };
  }, []);

  function step(dir: number) {
    const vp = railRef.current;
    if (!vp) return;
    const card = vp.querySelector<HTMLElement>("[data-event-card]");
    const w = card ? card.getBoundingClientRect().width + 20 : 320;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    vp.scrollBy({ left: dir * w, behavior: reduced ? "auto" : "smooth" });
  }

  function onKey(e: React.KeyboardEvent) {
    const vp = railRef.current;
    if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
    else if (e.key === "Home" && vp) { e.preventDefault(); vp.scrollTo({ left: 0, behavior: "smooth" }); }
    else if (e.key === "End" && vp) { e.preventDefault(); vp.scrollTo({ left: vp.scrollWidth, behavior: "smooth" }); }
  }

  return (
    <section aria-label="Đang diễn ra" className={styles.section}>
      <div className={styles.head}>
        <div className={styles.headText}>
          <span className={styles.eyebrow}>Sự kiện</span>
          <h2 className={styles.title}>Đang diễn ra</h2>
          <span className={styles.clock}>{now ? `Mốc thời gian: ${hh(now)} · ${dd(now)}` : ""}</span>
        </div>
        <div className={styles.controls}>
          <span className={styles.noCalendar}>
            <IconOffline size={14} />
            Trang lịch sự kiện chưa có
          </span>
          <span aria-live="polite" className={styles.counter}>{counter}</span>
          <div className={styles.btnRow}>
            <button ref={prevRef} type="button" onClick={() => step(-1)} disabled={atStart} aria-label="Sự kiện trước" className={styles.navBtn}>
              <IconArrowLeft size={18} />
            </button>
            <button ref={nextRef} type="button" onClick={() => step(1)} disabled={atEnd} aria-label="Sự kiện sau" className={styles.navBtn}>
              <IconArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {!now ? (
        <div aria-hidden="true" className={styles.skeletonGrid}>
          {[0, 1, 2, 3].map((k) => (
            <div key={k} className={styles.skelCard}>
              <span className={styles.skelImg} />
              <span className={styles.skelBody}>
                <span className={styles.skelLabel} />
                <span className={styles.skelLine} />
                <span className={styles.skelLineShort} />
                <span className={styles.skelLabelSm} />
              </span>
            </div>
          ))}
        </div>
      ) : eventViews.length === 0 ? (
        <div className={styles.emptyBox}>
          <span className={styles.emptyTitle}>Chưa có sự kiện trong kỳ này</span>
          <span className={styles.emptyDesc}>Không có sự kiện nào đang hoặc sắp diễn ra theo dữ liệu hiện có. Mục này sẽ hiển thị lại khi hệ thống nhận được sự kiện mới.</span>
        </div>
      ) : (
        <div className={styles.railWrap}>
          <div
            ref={railRef}
            onKeyDown={onKey}
            role="group"
            tabIndex={0}
            aria-label="Danh sách sự kiện — dùng mũi tên trái, phải để chuyển"
            className={`hsvRail ${styles.rail}`}
          >
            {eventViews.map((e) => (
              <Reveal
                key={e.slug}
                as="article"
                data-event-card
                className={styles.card}
                style={{ borderColor: e.borderColor, opacity: e.cardOpacity }}
              >
                <span className={styles.cardMedia}>
                  <MediaImage media={e.cover} />
                  <span className={styles.statusBadge} style={{ background: e.badgeBg, color: e.badgeFg }}>
                    {e.isLive && <span className={styles.livePulse} />}
                    {e.statusLabel}
                  </span>
                </span>
                <span className={styles.cardBody}>
                  <span className={styles.timeBlock}>
                    <span className={styles.whenLine} style={{ color: e.timeColor }}>{e.whenLine}</span>
                    <span className={styles.dateLine}>{e.dateLine}</span>
                  </span>
                  <span className={styles.eventTitle} style={{ color: e.titleColor }}>{e.title}</span>
                  <span className={styles.placeRow}>
                    <IconMapPin size={14} className={styles.placeIcon} />
                    {e.place}
                  </span>
                  <span className={styles.footBlock}>
                    {e.hasSeats && <span className={styles.seatLine} style={{ color: e.seatColor }}>{e.seatLine}</span>}
                    {e.hasCta ? (
                      <a href={e.ctaHref} className={styles.ctaLink}>
                        {e.cta}
                        <IconArrowRight size={15} />
                      </a>
                    ) : (
                      <span className={styles.noCtaBlock}>
                        <span className={styles.noCtaLabel}>
                          <IconOffline size={14} />
                          {e.cta} — chưa khả dụng
                        </span>
                        <span className={styles.noCtaNote}>{e.ctaNote}</span>
                      </span>
                    )}
                  </span>
                </span>
              </Reveal>
            ))}
          </div>
          <span aria-hidden="true" className={styles.fade} style={{ opacity: atEnd ? 0 : 1 }} />
        </div>
      )}
    </section>
  );
}
