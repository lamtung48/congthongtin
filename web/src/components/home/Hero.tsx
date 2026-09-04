"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import styles from "./Hero.module.css";
import { MediaPlaceholder } from "@/components/ui/MediaPlaceholder";
import { IconArrowRight, IconMapPin } from "@/components/icons";
import type { HeroContent } from "@/domain/homepage";
import { formatDateTimeVi } from "@/lib/formatDate";

export function Hero({ hero }: { hero: HeroContent }) {
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
            <span className={styles.badge}>{hero.eyebrow}</span>
            <span className={styles.timestamp}>{formatDateTimeVi(hero.publishedAt)}</span>
          </div>
          <h1 className={styles.headline}>
            {hero.headline}{" "}
            {hero.headlineAccent && <span className={styles.headlineAccent}>{hero.headlineAccent}</span>}
          </h1>
          <p className={styles.lead}>{hero.lead}</p>
          <div className={styles.metaRow}>
            <span>{hero.author.name}</span>
            <span className={styles.dot} />
            <span>{hero.readingTimeMinutes} phút đọc</span>
            <span className={styles.dot} />
            <span>{hero.topicLabel}</span>
          </div>
          <div className={styles.ctaRow}>
            <Link href={hero.articleUrl} prefetch={false} className={styles.ctaPrimary}>
              Đọc bài viết
              <IconArrowRight size={17} />
            </Link>
            <Link href={hero.secondaryCtaHref} prefetch={false} className={styles.ctaSecondary}>
              {hero.secondaryCtaLabel}
            </Link>
          </div>
        </div>

        <Link
          data-hero-media
          href={hero.articleUrl} prefetch={false}
          aria-label={`${hero.headline} ${hero.headlineAccent ?? ""}`.trim()}
          className={styles.mediaLink}
        >
          <span className={styles.mediaShift} ref={mediaRef}>
            <MediaPlaceholder need={hero.media.placeholderNote ?? ""} />
          </span>
          <span className={styles.mediaVignette} />
          <span className={styles.mediaScrim} />
          <span className={styles.mediaCaption}>
            <IconMapPin size={13} />
            {hero.media.locationLabel}
          </span>
        </Link>
      </div>
    </section>
  );
}
