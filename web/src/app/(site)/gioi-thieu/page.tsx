import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import styles from "./page.module.css";
import { PageHero } from "@/components/ui/PageHero";
import { Reveal } from "@/components/ui/Reveal";
import {
  IconActivity,
  IconArrowRight,
  IconConference,
  IconExternal,
  IconFileText,
  IconHands,
  IconMail,
  IconMapPin,
  IconNews,
  IconPlay,
  IconShield,
  IconSparkle,
  IconTraining,
  IconTrophy,
} from "@/components/icons";
import { pageMetadata } from "@/lib/seo";
import { categoryHref } from "@/lib/routes";
import {
  ECOSYSTEM_LINKS,
  PHONG_TRAO_SV5T_LABEL,
  PHONG_TRAO_SV5T_SLUG,
  SITE_FOOTER_ADDRESS,
  SITE_FOOTER_CONTACT_EMAIL,
  SITE_FOOTER_SOCIALS,
  HOAT_DONG_URL,
} from "@/lib/siteChrome";

export const metadata: Metadata = pageMetadata({
  title: "Giới thiệu",
  description: "Hội Sinh viên Việt Nam — tổ chức chính trị – xã hội của sinh viên Việt Nam, thành lập ngày 9/1/1950.",
  path: "/gioi-thieu",
});

const MISSION = [
  {
    icon: <IconShield size={22} />,
    title: "Đại diện & bảo vệ",
    text: "Đại diện cho tiếng nói của sinh viên; chăm lo, bảo vệ quyền và lợi ích hợp pháp, chính đáng của sinh viên.",
  },
  {
    icon: <IconSparkle size={22} />,
    title: "Đồng hành & phát triển",
    text: "Đồng hành cùng sinh viên trong học tập, nghiên cứu khoa học, rèn luyện kỹ năng, khởi nghiệp và việc làm.",
  },
  {
    icon: <IconHands size={22} />,
    title: "Kết nối & đoàn kết",
    text: "Tập hợp, đoàn kết sinh viên trong nước và du học sinh Việt Nam ở nước ngoài; kết nối với bạn bè quốc tế.",
  },
];

const PLATFORM_ICON = { activity: IconActivity, training: IconTraining, conference: IconConference } as const;

const EXPLORE = [
  { href: "/tin-tuc", icon: <IconNews size={20} />, title: "Tin tức", text: "Chuyện sinh viên nóng hổi mỗi ngày" },
  { href: categoryHref(PHONG_TRAO_SV5T_SLUG), icon: <IconTrophy size={20} />, title: PHONG_TRAO_SV5T_LABEL, text: "5 tiêu chí, 3 cấp xét chọn" },
  { href: "/tai-lieu", icon: <IconFileText size={20} />, title: "Tài liệu", text: "Văn bản, hướng dẫn, biểu mẫu" },
  { href: "/video", icon: <IconPlay size={20} />, title: "Video", text: "Khoảnh khắc sinh viên" },
];

/**
 * "Giới thiệu" — who the Hội is, what it does, and where a student goes
 * next. Deliberately limited to facts that do not change (founding date,
 * nature of the organisation, the SV5T criteria) plus the site's own
 * links; anything time-bound (leadership, statistics) belongs in articles.
 */
export default function AboutPage() {
  return (
    <>
      <PageHero
        tone="brand"
        breadcrumb={[{ label: "Trang chủ", href: "/" }, { label: "Giới thiệu" }]}
        eyebrow="Về chúng tôi"
        icon={<IconSparkle size={12} />}
        title="Hội Sinh viên"
        mark="Việt Nam"
        description="Ngôi nhà chung của sinh viên Việt Nam từ năm 1950 — nơi mỗi bạn trẻ được học tập, rèn luyện, cống hiến và cùng nhau lớn lên."
        stats={[
          { label: "Thành lập", value: "1950" },
          { label: "Ngày truyền thống", value: "9/1" },
          { label: "Tiêu chí SV5T", value: 5 },
          { label: "Nền tảng số", value: ECOSYSTEM_LINKS.length },
        ]}
      >
        <div className={styles.heroCtas}>
          <Link href={categoryHref(PHONG_TRAO_SV5T_SLUG)} className={styles.ctaGold}>
            Khám phá Sinh viên 5 tốt <IconArrowRight size={14} />
          </Link>
          <a href={HOAT_DONG_URL} target="_blank" rel="noopener noreferrer" className={styles.ctaGlass}>
            Tham gia hoạt động <IconExternal size={13} />
          </a>
        </div>
      </PageHero>

      <div className={styles.wrap}>
        <section className={styles.who} aria-labelledby="about-who">
          <div className={styles.whoLead}>
            <span className={styles.kicker}>Chúng tôi là ai</span>
            <h2 id="about-who" className={styles.bigQuote}>
              Tổ chức của sinh viên, <em>vì sinh viên.</em>
            </h2>
          </div>
          <div className={styles.whoBody}>
            <p>
              Hội Sinh viên Việt Nam là tổ chức chính trị – xã hội của sinh viên Việt Nam, được thành lập ngày
              <strong> 9 tháng 1 năm 1950</strong>. Ngày 9/1 hằng năm được chọn là Ngày truyền thống học sinh, sinh viên Việt Nam.
            </p>
            <p>
              Đoàn Thanh niên Cộng sản Hồ Chí Minh là nòng cốt chính trị trong tổ chức và hoạt động của Hội. Hội có mặt tại các
              trường đại học, học viện, cao đẳng trên cả nước và trong cộng đồng du học sinh Việt Nam ở nước ngoài.
            </p>
            <p>
              Cổng thông tin số này là nơi Trung ương Hội kết nối trực tiếp với từng sinh viên: tin tức, phong trào, tài liệu
              và các nền tảng số dùng chung — tất cả ở một địa chỉ.
            </p>
          </div>
        </section>

        <section className={styles.block} aria-labelledby="about-mission">
          <div className={styles.head}>
            <span className={styles.kicker}>Sứ mệnh</span>
            <h2 id="about-mission" className={styles.title}>Ba điều chúng tôi luôn làm</h2>
          </div>
          <ol className={styles.mission}>
            {MISSION.map((m, i) => (
              <Reveal as="li" key={m.title} className={styles.missionCard} style={{ "--i": i } as CSSProperties}>
                <span className={styles.missionNum}>0{i + 1}</span>
                <span className={styles.missionIcon}>{m.icon}</span>
                <h3 className={styles.missionTitle}>{m.title}</h3>
                <p className={styles.missionText}>{m.text}</p>
              </Reveal>
            ))}
          </ol>
        </section>

        <section className={styles.block} aria-labelledby="about-platforms">
          <div className={styles.head}>
            <span className={styles.kicker}>Hệ sinh thái số</span>
            <h2 id="about-platforms" className={styles.title}>Một tài khoản, mọi hoạt động</h2>
            <p className={styles.headDesc}>Đăng nhập một lần tại cổng này để dùng các nền tảng của Hội.</p>
          </div>
          <div className={styles.platforms}>
            {ECOSYSTEM_LINKS.map((p) => {
              const Icon = PLATFORM_ICON[p.key];
              return (
                <a key={p.key} href={p.href} target="_blank" rel="noopener noreferrer" className={styles.platform} data-key={p.key}>
                  <span className={styles.platformIcon}><Icon size={24} /></span>
                  <span className={styles.platformName}>{p.label}</span>
                  <span className={styles.platformHint}>{p.hint}</span>
                  <span className={styles.platformGo}>
                    {p.sso ? "Dùng chung tài khoản" : "Mở nền tảng"} <IconExternal size={13} />
                  </span>
                </a>
              );
            })}
          </div>
        </section>

        <section className={styles.block} aria-labelledby="about-explore">
          <div className={styles.head}>
            <span className={styles.kicker}>Khám phá</span>
            <h2 id="about-explore" className={styles.title}>Bắt đầu từ đâu?</h2>
          </div>
          <div className={styles.explore}>
            {EXPLORE.map((e) => (
              <Link key={e.href} href={e.href} className={styles.exploreCard}>
                <span className={styles.exploreIcon}>{e.icon}</span>
                <span className={styles.exploreText}>
                  <span className={styles.exploreTitle}>{e.title}</span>
                  <span className={styles.exploreSub}>{e.text}</span>
                </span>
                <IconArrowRight size={16} className={styles.exploreArrow} />
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.contact} aria-labelledby="about-contact">
          <div>
            <span className={styles.kickerLight}>Liên hệ</span>
            <h2 id="about-contact" className={styles.contactTitle}>Có ý tưởng hay? Kể cho chúng tôi nghe.</h2>
            <ul className={styles.contactList}>
              <li><IconMapPin size={16} /> {SITE_FOOTER_ADDRESS}</li>
              <li>
                <IconMail size={16} /> <a href={`mailto:${SITE_FOOTER_CONTACT_EMAIL}`}>{SITE_FOOTER_CONTACT_EMAIL}</a>
              </li>
            </ul>
          </div>
          <div className={styles.socials}>
            {SITE_FOOTER_SOCIALS.map((s) => (
              <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer" className={styles.social}>
                {s.name} <IconExternal size={12} />
              </a>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
