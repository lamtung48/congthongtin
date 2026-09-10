import Image from "next/image";
import Link from "next/link";
import styles from "./Footer.module.css";
import type { FooterConfiguration } from "@/domain/homepage";
import { IconExternal } from "@/components/icons";

export function Footer({ footer }: { footer: FooterConfiguration }) {
  return (
    <footer className={styles.footer}>
      <div data-l="footer" className={styles.cols}>
        <div className={styles.brandCol}>
          <span className={styles.brandRow}>
            <Image src="/images/hsv-logo.png" alt="Huy hiệu Hội Sinh viên Việt Nam" width={44} height={44} style={{ flex: "0 0 auto", display: "block", objectFit: "contain" }} />
            <span className={styles.brandName}>{footer.orgName}</span>
          </span>
          <p className={styles.brandDesc}>{footer.orgDescription}</p>
          <span className={styles.addrBlock}>
            <span className={styles.addrLabel}>Địa chỉ</span>
            <span className={styles.addrText}>{footer.address}</span>
          </span>
          <span className={styles.addrBlock}>
            <span className={styles.addrLabel}>Email</span>
            <a href={`mailto:${footer.contactEmail}`} className={styles.contactLink}>{footer.contactEmail}</a>
          </span>
        </div>

        {footer.columns.map((c) => (
          <div key={c.title} className={styles.col}>
            <span className={styles.colTitle}>{c.title}</span>
            <div className={styles.colLinks}>
              {c.items.map((l) =>
                l.href && l.external ? (
                  <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className={styles.colLink}>{l.label}</a>
                ) : l.href ? (
                  <Link key={l.label} href={l.href} className={styles.colLink}>{l.label}</Link>
                ) : (
                  <span key={l.label} title="Trang chưa được xây dựng" className={styles.colLinkSoon}>{l.label}</span>
                )
              )}
            </div>
          </div>
        ))}

        <div className={styles.col}>
          <span className={styles.colTitle}>Kết nối</span>
          <div className={styles.socialList}>
            {footer.socials.map((s) => (
              <a
                key={s.name}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.socialLink}
              >
                <IconExternal size={15} />
                {s.name}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.bottomRow}>
        <span className={styles.bottomGroup}>
          <span className={styles.bottomText}>{footer.copyrightLine}</span>
          <span className={styles.bottomText}>{footer.governingBodyLine}</span>
        </span>
      </div>
    </footer>
  );
}
