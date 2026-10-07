import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import styles from "./Sv5tIntro.module.css";
import { Reveal } from "@/components/ui/Reveal";
import { IconActivity, IconArrowRight, IconBolt, IconBook, IconExternal, IconFileText, IconGlobe, IconHands, IconHeart } from "@/components/icons";
import { HOAT_DONG_URL } from "@/lib/siteChrome";

interface Criterion {
  n: string;
  name: string;
  text: string;
  icon: ReactNode;
  tone: string;
}

/** Generic wording on purpose: the exact thresholds change with each năm
 *  học's hướng dẫn, which is published under /tai-lieu. */
const CRITERIA: Criterion[] = [
  { n: "01", name: "Đạo đức tốt", text: "Sống có lý tưởng, chấp hành tốt pháp luật và nội quy nhà trường, kết quả rèn luyện nổi bật.", icon: <IconHeart size={22} />, tone: "red" },
  { n: "02", name: "Học tập tốt", text: "Kết quả học tập tốt, chủ động nghiên cứu khoa học, sáng tạo và dám thử những điều mới.", icon: <IconBook size={22} />, tone: "blue" },
  { n: "03", name: "Thể lực tốt", text: "Rèn luyện thể dục thể thao thường xuyên, sống khoẻ, sống năng động và tích cực.", icon: <IconBolt size={22} />, tone: "green" },
  { n: "04", name: "Tình nguyện tốt", text: "Xung kích trong các hoạt động tình nguyện, vì cộng đồng, sẵn sàng sẻ chia.", icon: <IconHands size={22} />, tone: "orange" },
  { n: "05", name: "Hội nhập tốt", text: "Ngoại ngữ, kỹ năng số và hiểu biết văn hoá để tự tin bước ra thế giới.", icon: <IconGlobe size={22} />, tone: "violet" },
];

const LEVELS = [
  { name: "Cấp trường", text: "Khởi đầu hành trình tại trường, học viện của bạn." },
  { name: "Cấp tỉnh, thành phố", text: "Hội Sinh viên tỉnh, thành phố xét chọn từ các trường." },
  { name: "Cấp Trung ương", text: "Danh hiệu cao nhất, do Trung ương Hội xét chọn và tuyên dương." },
];

/**
 * Campaign intro shown above the article feed on page 1 of the
 * "Phong trào Sinh viên 5 tốt" category: the five criteria as colour tiles,
 * the award levels as steps, and where to go next.
 */
export function Sv5tIntro() {
  return (
    <div className={styles.intro}>
      <section id="tieu-chi" aria-labelledby="sv5t-criteria" className={styles.block}>
        <div className={styles.head}>
          <span className={styles.kicker}>Bộ tiêu chí</span>
          <h2 id="sv5t-criteria" className={styles.title}>5 tiêu chí, một phiên bản tốt hơn của bạn</h2>
        </div>
        <ol className={styles.criteria}>
          {CRITERIA.map((c, i) => (
            <Reveal as="li" key={c.n} className={styles.criterion} data-tone={c.tone} style={{ "--i": i } as CSSProperties}>
              <span className={styles.cIcon}>{c.icon}</span>
              <span className={styles.cNum}>{c.n}</span>
              <h3 className={styles.cName}>{c.name}</h3>
              <p className={styles.cText}>{c.text}</p>
            </Reveal>
          ))}
        </ol>
      </section>

      <section aria-labelledby="sv5t-levels" className={styles.levelsBlock}>
        <div className={styles.head}>
          <span className={styles.kicker}>Các cấp danh hiệu</span>
          <h2 id="sv5t-levels" className={styles.title}>Từ giảng đường tới vinh danh toàn quốc</h2>
        </div>
        <ol className={styles.levels}>
          {LEVELS.map((l, i) => (
            <li key={l.name} className={styles.level}>
              <span className={styles.step}>{i + 1}</span>
              <span className={styles.levelName}>{l.name}</span>
              <span className={styles.levelText}>{l.text}</span>
            </li>
          ))}
        </ol>
        <div className={styles.ctas}>
          <Link href="/tai-lieu" className={styles.ctaPrimary}>
            <IconFileText size={16} /> Tài liệu hướng dẫn <IconArrowRight size={14} />
          </Link>
          <a href={HOAT_DONG_URL} target="_blank" rel="noopener noreferrer" className={styles.ctaGhost}>
            <IconActivity size={16} /> Tìm hoạt động tình nguyện <IconExternal size={13} />
          </a>
        </div>
      </section>
    </div>
  );
}
