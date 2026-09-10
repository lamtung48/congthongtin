import styles from "./EcosystemBento.module.css";
import { Reveal } from "@/components/ui/Reveal";
import { IconArrowRight } from "@/components/icons";
import type { Platform } from "@/domain/platform";
import { buildPlatformView, type PlatformView } from "@/lib/view/platformView";

/**
 * `p.url === "#"` means the platform is a real, separate system that simply
 * doesn't have a known address yet — rendering `<a href="#">` there would be
 * a dead link with no destination, so this renders a disabled-looking note
 * instead (never an anchor with nowhere to go). See "Không để href=#" in
 * `docs/ROUTES.md`.
 */
function PlatformCta({ view, ctaClass, noteClass }: { view: PlatformView; ctaClass: string; noteClass: string }) {
  if (view.hasCta && view.url !== "#") {
    // A platform on its own domain (Hội nghị, Đào tạo, …) opens in a new
    // tab; an in-site link (e.g. a topic page) navigates normally.
    const isExternal = /^https?:\/\//.test(view.url);
    return (
      <a
        href={view.url}
        className={ctaClass}
        {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {view.cta}
        <IconArrowRight size={15} />
      </a>
    );
  }
  const message = !view.hasCta ? view.note : "Đường dẫn nền tảng chưa được kết nối.";
  return <span className={noteClass}>{message}</span>;
}

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

/**
 * Ecosystem integration task, brief section 4/6: reads the real Platform
 * Registry (`getPlatforms()` → `DatabaseProvider`, ordered by the admin's
 * `order` field) by *category*, not array position — the DB order can
 * change, and each cell's chrome (icon, badge vocabulary, card treatment) is
 * hand-designed for one specific category, not "the Nth platform returned".
 *
 * A platform an Admin has disabled (`Platform.isEnabled = false`, brief
 * section 7's "display state") never reaches this component: both
 * `homepageRepository.fallback.platforms` and `resolvePlatformPlacements`
 * filter it out. This used to render its cell anyway with a grey
 * "Chưa được cấu hình hoặc đang tạm ẩn." placeholder, which meant turning a
 * platform off left an empty card sitting on the homepage instead of
 * removing it. Now an absent platform means **no cell at all**, and a
 * homepage with no enabled platform drops the whole section rather than
 * showing an empty grid under a heading.
 *
 * Because cells can now disappear, the column spans can no longer be
 * hard-coded per cell — a missing one would tear a hole in the 4-column
 * grid. `SPANS` assigns them by how many cells actually render, so every
 * row stays full at any count.
 */
function findByCategory(platforms: Platform[], category: Platform["category"]): Platform | undefined {
  return platforms.find((p) => p.category === category);
}

/** Per-category chrome, in the order the bento reads. `conference` is the
 *  featured cell and is handled separately below. */
const CARD_DEFS: {
  category: Platform["category"];
  fallbackName: string;
  icon: React.ReactNode;
  iconBoxClass: string;
  cardClass?: string;
  badges: (v: PlatformView) => React.ReactNode;
}[] = [
  {
    category: "training",
    fallbackName: "Nền tảng Đào tạo",
    icon: <TrainingIcon />,
    iconBoxClass: "iconBoxSoft",
    badges: (v) => <span className={`${styles.badge} ${styles.badgeSoft}`}>Đang hoạt động · {v.metric}</span>,
  },
  {
    category: "sv5tot",
    fallbackName: "Sinh viên 5 tốt",
    icon: <StarIcon />,
    iconBoxClass: "iconBoxBrand",
    cardClass: "cardSoft",
    badges: () => null,
  },
  {
    category: "volunteer",
    fallbackName: "Tình nguyện",
    icon: <VolunteerIcon />,
    iconBoxClass: "iconBoxSoft",
    badges: (v) => (
      <>
        {v.isOpen && <span className={`${styles.badge} ${styles.badgeSuccess}`}>Đang mở đăng ký</span>}
        {v.isMaint && <span className={`${styles.badge} ${styles.badgeWarn}`}>Đang bảo trì</span>}
        {v.isDown && <span className={`${styles.badge} ${styles.badgeDown}`}>Tạm không truy cập</span>}
      </>
    ),
  },
  {
    category: "data",
    fallbackName: "Dữ liệu & Báo cáo",
    icon: <DataIcon />,
    iconBoxClass: "iconBoxMuted",
    cardClass: "cardDashed",
    badges: (v) => (
      <>
        {v.isSoon && <span className={`${styles.badge} ${styles.badgeWarn}`}>Sắp ra mắt</span>}
        {v.isActive && <span className={`${styles.badge} ${styles.badgeSoft}`}>Đang hoạt động</span>}
      </>
    ),
  },
];

/**
 * Column spans for the non-featured cards, keyed by how many render. The
 * grid is 4 columns and the featured cell occupies 2 of them across 2 rows,
 * so the two tables differ: with the featured cell present, the first two
 * rows only have 2 free columns each.
 */
const SPANS: Record<"withFeatured" | "plain", Record<number, number[]>> = {
  withFeatured: { 1: [2], 2: [2, 2], 3: [2, 1, 1], 4: [2, 1, 1, 2] },
  plain: { 1: [4], 2: [2, 2], 3: [2, 1, 1], 4: [1, 1, 1, 1] },
};

/** The featured cell is 2 columns wide and normally 2 rows tall, which only
 *  works when there are enough cards to fill the 2 columns beside it on both
 *  rows. With one card it would leave a visibly empty half-row, and with
 *  none it would leave half the grid empty — so it shortens/widens instead. */
function featuredShapeClass(cardCount: number): string {
  if (cardCount === 0) return styles.featuredFull;
  if (cardCount === 1) return styles.featuredShort;
  return "";
}

const SPAN_CLASS: Record<number, string> = {
  1: styles.cardSpan1,
  2: styles.cardSpan2,
  4: styles.cardSpan4,
};

export function EcosystemBento({ platforms }: { platforms: Platform[] }) {
  const conference = findByCategory(platforms, "conference");
  const featured = conference ? buildPlatformView(conference) : null;

  const cards = CARD_DEFS.flatMap((def) => {
    const platform = findByCategory(platforms, def.category);
    return platform ? [{ def, view: buildPlatformView(platform) }] : [];
  });

  // Nothing enabled at all: no heading, no empty grid, no section.
  if (!featured && cards.length === 0) return null;

  const spans = SPANS[featured ? "withFeatured" : "plain"][cards.length] ?? cards.map(() => 1);

  return (
    <section aria-label="Hệ sinh thái số Hội Sinh viên Việt Nam" className={styles.section}>
      <div className={styles.head}>
        <span className={styles.eyebrow}>Nền tảng số</span>
        <h2 className={styles.title}>Hệ sinh thái số Hội Sinh viên Việt Nam</h2>
        <p className={styles.desc}>Các nền tảng phục vụ sinh viên và cán bộ Hội.</p>
      </div>

      <div data-l="bento" className={styles.grid}>
        {featured && (
          <Reveal className={`${styles.featured} ${featuredShapeClass(cards.length)}`}>
            <span className={styles.featuredGlow} />
            <span className={styles.cardTop}>
              <span className={`${styles.iconBox} ${styles.iconBoxDark}`}><ConferenceIcon /></span>
              {featured.isLive && (
                <span className={`${styles.badge} ${styles.badgeLive}`}>
                  <span className={styles.badgeDot} />Đang diễn ra
                </span>
              )}
              {featured.isActive && <span className={`${styles.badge} ${styles.badgeNeutralDark}`}>Đang hoạt động</span>}
              {featured.isMaint && <span className={`${styles.badge} ${styles.badgeWarn}`}>Đang bảo trì</span>}
            </span>
            <span className={styles.featuredBody}>
              <span className={styles.featuredName}>{featured.name}</span>
              {featured.isLive && <span className={styles.featuredActivity}>{featured.activity}</span>}
              <span className={styles.featuredDesc}>{featured.desc}</span>
              <PlatformCta view={featured} ctaClass={styles.ctaWhite} noteClass={styles.noteDark} />
              <span className={styles.accessDark}>{featured.access}</span>
            </span>
          </Reveal>
        )}

        {cards.map(({ def, view }, i) => (
          <Reveal
            key={def.category}
            className={`${styles.card} ${SPAN_CLASS[spans[i]] ?? styles.cardSpan1} ${def.cardClass ? styles[def.cardClass] : ""}`}
          >
            <span className={styles.cardTop}>
              <span className={`${styles.iconBox} ${styles[def.iconBoxClass]}`}>{def.icon}</span>
              {def.badges(view)}
            </span>
            <span className={styles.cardBody}>
              <span className={styles.cardName}>{view.name}</span>
              <span className={styles.cardDesc}>{view.desc}</span>
              <PlatformCta view={view} ctaClass={styles.ctaLink} noteClass={styles.noteLight} />
              <span className={styles.accessLight}>{view.access}</span>
            </span>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
