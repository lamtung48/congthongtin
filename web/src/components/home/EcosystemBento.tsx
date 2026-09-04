import styles from "./EcosystemBento.module.css";
import { Reveal } from "@/components/ui/Reveal";
import { IconArrowRight } from "@/components/icons";
import type { Platform } from "@/domain/platform";
import { buildPlatformView } from "@/lib/view/platformView";

function ConferenceIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-1.6a3.4 3.4 0 0 0-3.4-3.4H6.4A3.4 3.4 0 0 0 3 19.4V21" />
      <circle cx="9.5" cy="8" r="3.4" />
      <path d="M21 21v-1.6a3.4 3.4 0 0 0-2.6-3.3" />
      <path d="M15.5 4.8a3.4 3.4 0 0 1 0 6.4" />
    </svg>
  );
}
function TrainingIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.5 9.4L12 4.8 2.5 9.4 12 14l9.5-4.6z" />
      <path d="M6.2 11.4v4.3c0 1.5 2.6 2.7 5.8 2.7s5.8-1.2 5.8-2.7v-4.3" />
    </svg>
  );
}
function StarIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3.6l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17.5l-5.4 2.9 1-6.1L3.2 10l6.1-.9L12 3.6z" />
    </svg>
  );
}
function VolunteerIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20.4l-6.2-5.9a3.6 3.6 0 0 1 5.1-5.1l1.1 1.1 1.1-1.1a3.6 3.6 0 0 1 5.1 5.1L12 20.4z" />
    </svg>
  );
}
function DataIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V11M10 20V4M16 20v-6.5M22 20H2" />
    </svg>
  );
}

export function EcosystemBento({ platforms }: { platforms: Platform[] }) {
  const [conference, training, sv5tot, volunteer, data] = platforms;
  const p1 = buildPlatformView(conference);
  const p2 = buildPlatformView(training);
  const p3 = buildPlatformView(sv5tot);
  const p4 = buildPlatformView(volunteer);
  const p5 = buildPlatformView(data);

  return (
    <section aria-label="Hệ sinh thái số Hội Sinh viên Việt Nam" className={styles.section}>
      <div className={styles.head}>
        <span className={styles.eyebrow}>Nền tảng số</span>
        <h2 className={styles.title}>Hệ sinh thái số Hội Sinh viên Việt Nam</h2>
        <p className={styles.desc}>
          Năm nền tảng phục vụ sinh viên và cán bộ Hội: hội nghị, đào tạo, Sinh viên 5 tốt, tình nguyện và dữ liệu phong trào. Mỗi ô cho biết nền tảng đang ở trạng thái nào và cần đăng nhập hay không.
        </p>
      </div>

      <div data-l="bento" className={styles.grid}>
        {/* Hội nghị — ô nổi bật */}
        <Reveal className={styles.featured}>
          <span className={styles.featuredGlow} />
          <span className={styles.cardTop}>
            <span className={`${styles.iconBox} ${styles.iconBoxDark}`}><ConferenceIcon /></span>
            {p1.isLive && (
              <span className={`${styles.badge} ${styles.badgeLive}`}>
                <span className={styles.badgeDot} />Đang diễn ra
              </span>
            )}
            {p1.isActive && <span className={`${styles.badge} ${styles.badgeNeutralDark}`}>Đang hoạt động</span>}
            {p1.isMaint && <span className={`${styles.badge} ${styles.badgeWarn}`}>Đang bảo trì</span>}
          </span>
          <span className={styles.featuredBody}>
            <span className={styles.featuredName}>{p1.name}</span>
            {p1.isLive && <span className={styles.featuredActivity}>{p1.activity}</span>}
            <span className={styles.featuredDesc}>{p1.desc}</span>
            {p1.hasCta ? (
              <a href={p1.url} className={styles.ctaWhite}>{p1.cta}<IconArrowRight size={15} /></a>
            ) : (
              <span className={styles.noteDark}>{p1.note}</span>
            )}
            <span className={styles.accessDark}>{p1.access}</span>
          </span>
        </Reveal>

        {/* Đào tạo */}
        <Reveal className={`${styles.card} ${styles.cardSpan2}`}>
          <span className={styles.cardTop}>
            <span className={`${styles.iconBox} ${styles.iconBoxSoft}`}><TrainingIcon /></span>
            <span className={`${styles.badge} ${styles.badgeSoft}`}>Đang hoạt động · {p2.metric}</span>
          </span>
          <span className={styles.cardBody}>
            <span className={styles.cardName}>{p2.name}</span>
            <span className={styles.cardDesc}>{p2.desc}</span>
            <a href={p2.url} className={styles.ctaLink}>{p2.cta}<IconArrowRight size={15} /></a>
            <span className={styles.accessLight}>{p2.access}</span>
          </span>
        </Reveal>

        {/* Sinh viên 5 tốt */}
        <Reveal className={`${styles.card} ${styles.cardSpan1} ${styles.cardSoft}`}>
          <span className={`${styles.iconBox} ${styles.iconBoxBrand}`}><StarIcon /></span>
          <span className={styles.cardBody}>
            <span className={styles.cardName}>{p3.name}</span>
            <span className={styles.cardDesc}>{p3.desc}</span>
            <a href={p3.url} className={styles.ctaLink}>{p3.cta}<IconArrowRight size={15} /></a>
            <span className={styles.accessLight}>{p3.access}</span>
          </span>
        </Reveal>

        {/* Tình nguyện */}
        <Reveal className={`${styles.card} ${styles.cardSpan1}`}>
          <span className={styles.cardTop}>
            <span className={`${styles.iconBox} ${styles.iconBoxSoft}`}><VolunteerIcon /></span>
            {p4.isOpen && <span className={`${styles.badge} ${styles.badgeSuccess}`}>Đang mở đăng ký</span>}
            {p4.isMaint && <span className={`${styles.badge} ${styles.badgeWarn}`}>Đang bảo trì</span>}
            {p4.isDown && <span className={`${styles.badge} ${styles.badgeDown}`}>Tạm không truy cập</span>}
          </span>
          <span className={styles.cardBody}>
            <span className={styles.cardName}>{p4.name}</span>
            <span className={styles.cardDesc}>{p4.desc}</span>
            {p4.hasCta ? (
              <a href={p4.url} className={styles.ctaLink}>{p4.cta}<IconArrowRight size={15} /></a>
            ) : (
              <span className={styles.noteLight}>{p4.note}</span>
            )}
            <span className={styles.accessLight}>{p4.access}</span>
          </span>
        </Reveal>

        {/* Dữ liệu & Báo cáo */}
        <Reveal className={`${styles.card} ${styles.cardSpan2} ${styles.cardDashed}`}>
          <span className={styles.cardTop}>
            <span className={`${styles.iconBox} ${styles.iconBoxMuted}`}><DataIcon /></span>
            {p5.isSoon && <span className={`${styles.badge} ${styles.badgeWarn}`}>Sắp ra mắt</span>}
            {p5.isActive && <span className={`${styles.badge} ${styles.badgeSoft}`}>Đang hoạt động</span>}
          </span>
          <span className={styles.cardBody}>
            <span className={styles.cardName}>{p5.name}</span>
            <span className={styles.cardDesc}>{p5.desc}</span>
            {p5.hasCta ? (
              <a href={p5.url} className={styles.ctaLink}>{p5.cta}<IconArrowRight size={15} /></a>
            ) : (
              <span className={styles.noteLight}>{p5.note}</span>
            )}
            <span className={styles.accessLight}>{p5.access}</span>
          </span>
        </Reveal>
      </div>
    </section>
  );
}
