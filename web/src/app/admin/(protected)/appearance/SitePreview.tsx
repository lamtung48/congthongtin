"use client";

import type { CSSProperties } from "react";
import styles from "./SitePreview.module.css";
import { backgroundTokens } from "@/lib/appearance";

/**
 * The design-system tokens the preview needs that a background choice never
 * touches. `/admin` is a separate root layout with its own stylesheet
 * (`admin.css`) and none of `globals.css`'s tokens, so the preview has to
 * carry them itself rather than inherit — which is also what keeps it honest:
 * every colour visible in the mock is either one of these fixed values or one
 * `backgroundTokens()` derived, exactly as on the real site.
 */
const SITE_TOKENS: CSSProperties = {
  "--surface-page": "#ffffff",
  "--surface-card": "#ffffff",
  "--surface-subtle": "#f7f8fa",
  "--surface-sunken": "#f0f2f6",
  "--surface-invert": "#0a0d12",
  "--border-subtle": "#e6eaef",
  "--text-strong": "#0a0d12",
  "--text-body": "#1d232c",
  "--text-muted": "#647081",
  "--text-link": "#0b5fa5",
  "--brand-primary": "#0b5fa5",
  "--brand-gold": "#ffcd00",
} as CSSProperties;

export function SitePreview({ background, narrow }: { background: string; narrow: boolean }) {
  // Same function the public layout renders into its <style> tag, so the
  // preview cannot drift from the result.
  const style = { ...SITE_TOKENS, ...(backgroundTokens(background) ?? {}) } as CSSProperties;

  return (
    <div className={`${styles.frame} ${narrow ? styles.frameNarrow : ""}`} style={style} aria-label="Xem trước giao diện trang công khai">
      <div className={styles.header}>
        <span className={styles.logo} aria-hidden="true" />
        <span>
          <span className={styles.brandName}>Hội Sinh viên Việt Nam</span>
          <br />
          <span className={styles.brandSub}>Cổng thông tin số</span>
        </span>
        <span className={styles.nav} aria-hidden="true">
          <span className={styles.navActive}>Trang chủ</span>
          <span>Tin tức</span>
          <span>Phong trào Sinh viên 5 tốt</span>
        </span>
        <span className={styles.searchDot} aria-hidden="true">⌕</span>
      </div>

      <div className={styles.hero}>
        <span className={styles.heroEyebrow}>Tiêu điểm</span>
        <p className={styles.heroTitle}>Đại hội đại biểu toàn quốc Hội Sinh viên Việt Nam lần thứ XII</p>
        <span className={styles.heroMeta}>Hà Nội · 07/09/2026</span>
      </div>

      <div className={styles.band}>
        <div className={styles.bandHead}>
          <h4 className={styles.bandTitle}>Tin tiêu điểm</h4>
          <span className={styles.bandMore}>Xem tất cả</span>
        </div>
        <div className={styles.cards}>
          {[
            { kicker: "Phong trào SV5T", title: "Chiến dịch tình nguyện hè về đích sớm", meta: "05/09/2026" },
            { kicker: "Tin từ cơ sở", title: "Sinh viên Đà Nẵng số hoá hồ sơ chi hội", meta: "04/09/2026" },
            { kicker: "Dòng chảy sinh viên", title: "Nam sinh khiếm thị và hành trình 5 tốt", meta: "03/09/2026" },
          ].map((c) => (
            <div key={c.title} className={styles.card}>
              <div className={styles.cardThumb} />
              <div className={styles.cardBody}>
                <span className={styles.cardKicker}>{c.kicker}</span>
                <p className={styles.cardTitle}>{c.title}</p>
                <span className={styles.cardMeta}>{c.meta}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={`${styles.band} ${styles.bandAlt}`}>
        <div className={styles.bandHead}>
          <h4 className={styles.bandTitle}>Dòng chảy sinh viên</h4>
          <span className={styles.bandMore}>◀ ▶</span>
        </div>
        <div className={styles.rail}>
          {["Câu chuyện khởi nghiệp từ ký túc xá", "Lớp học tiếng Việt bên kia biên giới", "Ngày hội hiến máu mùa tựu trường"].map((t) => (
            <div key={t} className={styles.railItem}>
              <div className={styles.railThumb} />
              <div className={styles.railTitle}>{t}</div>
              <div className={styles.railMeta}>Toàn quốc</div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.footer}>
        <span className={styles.footerCol}>
          <span className={styles.footerHead}>Hội Sinh viên Việt Nam</span>
          <span>62 Bà Triệu, Hoàn Kiếm, Hà Nội</span>
        </span>
        <span className={styles.footerCol} style={{ marginLeft: "auto" }}>
          <span className={styles.footerHead}>Về chúng tôi</span>
          <span>hoisinhvien.com.vn</span>
        </span>
      </div>
    </div>
  );
}
