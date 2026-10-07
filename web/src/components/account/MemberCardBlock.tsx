"use client";

import { useState } from "react";
import { MembershipCard } from "@hsv/membership-card";
import styles from "./MemberCardBlock.module.css";
import type { MembershipCardPayload } from "@/domain/account";
import { HOAT_DONG_URL } from "@/lib/siteChrome";
import { IconArrowRight, IconArrowUp, IconCheck, IconIdCard, IconLink } from "@/components/icons";

/**
 * The Thẻ Hội viên exactly as Hoạt động and Đào tạo render it (shared package
 * `@hsv/membership-card`), plus "Tải ảnh thẻ" / "Chia sẻ" / "Nâng hạng" — or a clear empty
 * state when the card isn't issued yet or Hoạt động can't be reached.
 */
export function MemberCardBlock({ data, compact = false }: { data: MembershipCardPayload; compact?: boolean }) {
  if (!data.card) {
    return (
      <div className={styles.empty} data-compact={compact || undefined}>
        <span className={styles.emptyIcon}>
          <IconIdCard size={22} />
        </span>
        <div className={styles.emptyCopy}>
          <strong>{data.cardState === "unavailable" ? "Chưa tải được Thẻ Hội viên" : "Bạn chưa có Thẻ Hội viên"}</strong>
          <span>
            {data.cardState === "unavailable"
              ? "Nền tảng Hoạt động đang tạm gián đoạn, vui lòng thử lại sau ít phút."
              : data.isMember
                ? "Thẻ đang được cấp — tham gia hoạt động để tích luỹ điểm và thăng hạng."
                : "Thẻ được cấp khi tư cách Hội viên của bạn được xác nhận (chức vụ được duyệt hoặc do Ban quản trị xác nhận)."}
          </span>
          <a href={HOAT_DONG_URL} target="_blank" rel="noopener noreferrer" className={styles.emptyLink}>
            Mở nền tảng Hoạt động <IconArrowRight size={13} />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap} data-compact={compact || undefined}>
      <MembershipCard view={data.card} fullName={data.fullName} organizationName={data.organizationName} qrSrc={data.qrSrc} />
      {data.shareUrl && data.fileName && <CardActions fileName={data.fileName} shareUrl={data.shareUrl} />}
    </div>
  );
}

function CardActions({ fileName, shareUrl }: { fileName: string; shareUrl: string }) {
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch("/api/me/membership-card-image", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Không tạo được ảnh thẻ.");
        return;
      }
      const href = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = href;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch {
      setError("Không kết nối được máy chủ, vui lòng thử lại.");
    } finally {
      setDownloading(false);
    }
  }

  // Phones: the native share sheet. Desktop / unsupported: copy the public card link.
  async function share() {
    setError(null);
    try {
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({ title: "Thẻ Hội viên", url: shareUrl });
          return;
        } catch (err) {
          if ((err as { name?: string })?.name === "AbortError") return;
        }
      }
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Không chia sẻ được lúc này, vui lòng thử lại.");
    }
  }

  return (
    <>
      <div className={styles.actions}>
        <button type="button" onClick={download} disabled={downloading} className={styles.action}>
          {downloading ? "Đang tạo ảnh…" : "Tải ảnh thẻ"}
        </button>
        <button type="button" onClick={share} className={styles.action}>
          {copied ? <IconCheck size={14} /> : <IconLink size={14} />}
          {copied ? "Đã sao chép" : "Chia sẻ"}
        </button>
        <a href={`${HOAT_DONG_URL}/nang-hang-the`} target="_blank" rel="noopener noreferrer" className={`${styles.action} ${styles.actionPrimary}`}>
          <IconArrowUp size={14} />
          Nâng hạng
        </a>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </>
  );
}
