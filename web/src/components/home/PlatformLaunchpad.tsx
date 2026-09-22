import Link from "next/link";
import styles from "./PlatformLaunchpad.module.css";
import { Reveal } from "@/components/ui/Reveal";
import { IconActivity, IconArrowRight, IconConference, IconShield, IconTraining } from "@/components/icons";
import type { Platform, PlatformCategory } from "@/domain/platform";
import { buildPlatformView, type PlatformView } from "@/lib/view/platformView";
import { ECOSYSTEM_LINKS } from "@/lib/siteChrome";

/**
 * "Nền tảng số" band directly under the Hero: the three platforms a visitor
 * most often jumps to — Hoạt động, Đào tạo, Hội nghị — as large, clickable
 * cards with a live figure (the refresher sidecar keeps `currentActivity`
 * fresh for API-integrated platforms), what each one is for, and a way in.
 *
 * Data is the real Platform registry (`getPlatforms()`), picked by category:
 * a platform an Admin disabled never arrives here, so its card simply goes
 * (no placeholder), and with none enabled the whole band is omitted. The
 * per-category chrome (glyph, accent, feature list) is design, not content,
 * so it lives here. The lower "Hệ sinh thái số" bento shows only the
 * categories this band does not (see `LAUNCHPAD_CATEGORIES`).
 */
export const LAUNCHPAD_CATEGORIES: PlatformCategory[] = ["activity", "training", "conference"];

const CHROME: Record<"activity" | "training" | "conference", { icon: React.ReactNode; features: string[]; tone: string }> = {
  activity: {
    icon: <IconActivity size={24} />,
    features: ["Đăng ký hoạt động", "Điểm danh QR", "Thẻ Hội viên"],
    tone: "activity",
  },
  training: {
    icon: <IconTraining size={24} />,
    features: ["Khoá học trực tuyến", "Bài kiểm tra", "Chứng nhận điện tử"],
    tone: "training",
  },
  conference: {
    icon: <IconConference size={24} />,
    features: ["Điểm danh đại biểu", "Tài liệu phiên họp", "Biểu quyết"],
    tone: "conference",
  },
};

/**
 * "2 khoá đang mở" → big "2" + "khoá đang mở"; "Tham gia ngay 3 hội nghị" →
 * "Tham gia ngay" + big "3" + "hội nghị". The lead-in must be a short phrase
 * with no digits or punctuation, so a sentence that merely contains a number
 * ("… lần thứ 3 — phiên …") stays one line of text, like anything else.
 */
function splitFigure(text: string | undefined): { prefix: string | null; value: string | null; label: string } | null {
  const t = text?.trim();
  if (!t) return null;
  const m = t.match(/^(?:([^\d—–:·.,!?]{1,24}?)\s+)?(\d[\d.,]*)\s+(.+)$/);
  return m ? { prefix: m[1] ?? null, value: m[2], label: m[3] } : { prefix: null, value: null, label: t.replace(/\.$/, "") };
}

function statusOf(view: PlatformView): { label: string; kind: "live" | "ok" | "warn" } {
  if (view.isLive) return { label: "Đang diễn ra", kind: "live" };
  if (view.isMaint) return { label: "Đang bảo trì", kind: "warn" };
  return { label: "Đang hoạt động", kind: "ok" };
}

function shortName(name: string): string {
  return name.replace(/^Nền tảng\s+/i, "");
}

export function PlatformLaunchpad({ platforms }: { platforms: Platform[] }) {
  const cards = LAUNCHPAD_CATEGORIES.flatMap((category) => {
    const platform = platforms.find((p) => p.category === category);
    if (!platform) return [];
    const key = category as keyof typeof CHROME;
    return [{ key, platform, view: buildPlatformView(platform), link: ECOSYSTEM_LINKS.find((l) => l.key === key) }];
  });
  if (cards.length === 0) return null;

  return (
    <section aria-labelledby="launchpad-title" className={styles.section}>
      <span aria-hidden className={styles.aurora} />
      <div className={styles.inner}>
        <div className={styles.head}>
          <div className={styles.headCopy}>
            <span className={styles.eyebrow}>Nền tảng số · Hệ sinh thái Hội</span>
            <h2 id="launchpad-title" className={styles.title}>
              Một tài khoản, vào thẳng các nền tảng của Hội
            </h2>
          </div>
          <Link href="/tai-khoan" className={styles.ssoNote}>
            <span className={styles.ssoIcon}>
              <IconShield size={16} />
            </span>
            <span>
              <strong>Đăng nhập một lần bằng HSV-ID</strong>
              <span className={styles.ssoSub}>Dùng chung cho Hoạt động và Đào tạo — không cần đăng nhập lại</span>
            </span>
            <IconArrowRight size={15} className={styles.ssoArrow} />
          </Link>
        </div>

        <div className={styles.grid} data-count={cards.length}>
          {cards.map(({ key, platform, view, link }) => {
            const chrome = CHROME[key];
            const status = statusOf(view);
            // Conference: "Tham gia ngay N hội nghị" (conferenceAdapter) — shown whether or not one is live.
            const figure = splitFigure(key === "conference" ? platform.currentActivity ?? platform.metric : view.metric);
            const external = /^https?:\/\//.test(view.url);
            const clickable = view.hasCta && view.url !== "#";
            return (
              <Reveal key={key} as="article" className={styles.card} data-tone={chrome.tone}>
                <span aria-hidden className={styles.glow} />
                <div className={styles.cardTop}>
                  <span className={styles.iconTile}>{chrome.icon}</span>
                  <span className={styles.status} data-kind={status.kind}>
                    <span className={styles.statusDot} />
                    {status.label}
                  </span>
                </div>

                <div className={styles.cardBody}>
                  <span className={styles.kicker}>Nền tảng</span>
                  <h3 className={styles.name}>{shortName(view.name)}</h3>
                  <p className={styles.desc}>{view.desc}</p>
                </div>

                {figure && (
                  <p className={styles.figure} data-numeric={figure.value ? "true" : undefined}>
                    {figure.prefix && <span className={styles.figurePrefix}>{figure.prefix}</span>}
                    {figure.value && <span className={styles.figureValue}>{figure.value}</span>}
                    <span className={styles.figureLabel}>{figure.label}</span>
                  </p>
                )}

                <ul className={styles.features} aria-label={`Tính năng ${shortName(view.name)}`}>
                  {chrome.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>

                <div className={styles.cardFoot}>
                  {clickable ? (
                    <a href={view.url} className={styles.cta} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                      {view.cta}
                      <IconArrowRight size={15} />
                    </a>
                  ) : (
                    <span className={styles.note}>{view.note ?? "Đường dẫn nền tảng chưa được kết nối."}</span>
                  )}
                  {link?.sso && <span className={styles.ssoBadge}>Đăng nhập chung</span>}
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
