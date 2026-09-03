"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import styles from "./Hero.module.css";
import { MediaPlaceholder } from "@/components/ui/MediaPlaceholder";
import { IconArrowRight, IconMapPin } from "@/components/icons";
import { articleHref } from "@/lib/data/news";

const HERO_SLUG = "dai-hoi-xii-khai-mac";

export function Hero() {
  const mediaRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const el = mediaRef.current;
        if (!el) return;
        // Total shift stays ≤32px so the image edge never shows.
        const shift = Math.min(window.scrollY * 0.09, 32);
        el.style.transform = `translate3d(0,${shift.toFixed(1)}px,0)`;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section aria-label="Tin tiêu điểm" className={styles.section}>
      <div data-l="hero" className={styles.grid}>
        <div data-hero-copy className={styles.copy}>
          <div className={styles.eyebrowRow}>
            <span className={styles.badge}>Đại hội XII</span>
            <span className={styles.timestamp}>02.09.2026 · 07:40</span>
          </div>
          <h1 className={styles.headline}>
            Đại hội đại biểu toàn quốc Hội Sinh viên Việt Nam lần thứ XII{" "}
            <span className={styles.headlineAccent}>khai mạc tại Hà Nội</span>
          </h1>
          <p className={styles.lead}>
            Hơn 700 đại biểu đại diện cho sinh viên cả nước và du học sinh Việt Nam ở nước ngoài thảo luận phương hướng công tác Hội nhiệm kỳ 2026 – 2031.
          </p>
          <div className={styles.metaRow}>
            <span>Ban Biên tập</span>
            <span className={styles.dot} />
            <span>6 phút đọc</span>
            <span className={styles.dot} />
            <span>Chuyên đề Đại hội</span>
          </div>
          <div className={styles.ctaRow}>
            <Link href={articleHref(HERO_SLUG)} prefetch={false} className={styles.ctaPrimary}>
              Đọc bài viết
              <IconArrowRight size={17} />
            </Link>
            <Link href="/chu-de/dai-hoi-xii" prefetch={false} className={styles.ctaSecondary}>
              Chuyên đề Đại hội XII
            </Link>
          </div>
        </div>

        <Link
          data-hero-media
          href={articleHref(HERO_SLUG)} prefetch={false}
          aria-label="Đại hội đại biểu toàn quốc Hội Sinh viên Việt Nam lần thứ XII khai mạc tại Hà Nội"
          className={styles.mediaLink}
        >
          <span className={styles.mediaShift} ref={mediaRef}>
            <MediaPlaceholder need="Ảnh phiên khai mạc Đại hội XII — ngang, tối thiểu 2400px" />
          </span>
          <span className={styles.mediaVignette} />
          <span className={styles.mediaScrim} />
          <span className={styles.mediaCaption}>
            <IconMapPin size={13} />
            Trung tâm Hội nghị Quốc gia, Hà Nội
          </span>
        </Link>
      </div>
    </section>
  );
}
