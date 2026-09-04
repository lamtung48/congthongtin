"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import styles from "./Footer.module.css";
import type { FooterConfiguration } from "@/domain/homepage";
import { IconExternal } from "@/components/icons";

type NlPhase = "idle" | "invalid" | "loading" | "done" | "error";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function Footer({ footer }: { footer: FooterConfiguration }) {
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<NlPhase>("idle");
  const [msg, setMsg] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = email.trim();
    if (!v) {
      setPhase("invalid");
      setMsg("Vui lòng nhập địa chỉ email.");
      return;
    }
    if (!EMAIL_RE.test(v)) {
      setPhase("invalid");
      setMsg("Email chưa đúng định dạng. Ví dụ: ten@truong.edu.vn");
      return;
    }
    setPhase("loading");
    setMsg("Đang kiểm tra…");
    setTimeout(() => {
      setPhase("done");
      setEmail("");
      setMsg(
        `Bản mẫu đã nhận “${v}” trong phiên làm việc này. Chưa có dịch vụ bản tin được kết nối nên email không được gửi đi và không được lưu.`
      );
    }, 900);
  }

  const invalid = phase === "invalid" || phase === "error";
  const msgColor = invalid ? "var(--red-300)" : phase === "done" ? "var(--green-100)" : "var(--ink-400)";
  const buttonLabel = phase === "loading" ? "Đang gửi" : phase === "done" ? "Đã nhận" : "Nhận bản tin";

  return (
    <footer className={styles.footer}>
      <form onSubmit={submit} data-l="footer-nl" className={styles.nlForm}>
        <div className={styles.nlText}>
          <span className={styles.nlTitle}>Bản tin tuần của Hội</span>
          <span className={styles.nlNote}>
            Bản mẫu chưa kết nối dịch vụ gửi thư: địa chỉ email bạn nhập chỉ được kiểm tra định dạng ngay trên trang và không được gửi ra ngoài.
          </span>
        </div>
        <div className={styles.nlField}>
          <label htmlFor="hsv-nl" className={styles.nlLabel}>Email nhận bản tin</label>
          <span className={styles.nlRow}>
            <input
              id="hsv-nl"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setPhase("idle");
                setMsg("");
              }}
              aria-describedby="hsv-nl-msg"
              aria-invalid={invalid}
              placeholder="ten@truong.edu.vn"
              className={`${styles.nlInput} ${invalid ? styles.nlInputInvalid : ""}`}
            />
            <button type="submit" disabled={phase === "loading"} className={styles.nlSubmit}>
              {phase === "loading" && <span className={styles.nlSpinner} />}
              {buttonLabel}
            </button>
          </span>
          <span id="hsv-nl-msg" aria-live="polite" className={styles.nlMsg} style={{ color: msgColor }}>{msg}</span>
        </div>
      </form>

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
          <span className={styles.contactNote}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" className={styles.contactIcon}>
              <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.2v.1" />
            </svg>
            {footer.contactNote}
          </span>
        </div>

        {footer.columns.map((c) => (
          <div key={c.title} className={styles.col}>
            <span className={styles.colTitle}>{c.title}</span>
            <div className={styles.colLinks}>
              {c.items.map((l) =>
                l.href ? (
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
          <div role="list" className={styles.socialList}>
            {footer.socials.map((name) => (
              <span key={name} role="listitem" className={styles.socialItem}>
                <IconExternal size={15} />
                {name}
              </span>
            ))}
          </div>
          <span className={styles.socialNote}>Tài khoản chính thức chờ xác nhận — chưa gắn liên kết.</span>
        </div>
      </div>

      <div className={styles.bottomRow}>
        <span className={styles.bottomGroup}>
          <span className={styles.bottomText}>{footer.copyrightLine}</span>
          <span className={styles.bottomText}>{footer.governingBodyLine}</span>
        </span>
        <span className={styles.bottomGroup}>
          {footer.policies.map((p) => (
            <span key={p.label} className={styles.policySoon}>{p.label} · chưa có trang</span>
          ))}
        </span>
      </div>
    </footer>
  );
}
