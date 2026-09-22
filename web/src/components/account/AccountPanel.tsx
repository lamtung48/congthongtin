"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import styles from "./AccountPanel.module.css";
import { MemberCardBlock } from "./MemberCardBlock";
import type { MembershipCardPayload } from "@/domain/account";
import { ECOSYSTEM_LINKS } from "@/lib/siteChrome";
import { initialsOf } from "@/lib/initials";
import { IconActivity, IconClose, IconConference, IconEdit, IconExternal, IconIdCard, IconLogout, IconPen, IconTraining } from "@/components/icons";

export interface HeaderUser {
  displayName: string;
  /** CMS role label when this person is also in the Ban biên tập, else null. */
  editorRole: string | null;
}

const PLATFORM_ICON = { activity: IconActivity, training: IconTraining, conference: IconConference } as const;

// Loaded once per page view on first open; re-opening the panel reuses it. Keyed by the signed-in name so a different account
// (signed in on another platform, picked up by the header's re-check) never sees the previous person's card.
let cardCache: { owner: string; data: MembershipCardPayload } | null = null;

/**
 * Header → click your name. Desktop only — on mobile the header's account
 * button is a plain link to `/tai-khoan` instead (see Header.tsx), so this
 * only ever renders as a popover under the button, never a sheet. The
 * personal account at a glance: the Thẻ Hội viên (from Hoạt động), "Sửa
 * thông tin tài khoản", straight-in links to the SSO platforms, and — only
 * for Ban biên tập members — the admin area. Esc / outside click / the
 * close button dismiss it.
 */
export function AccountPanel({
  user,
  onClose,
  onLogout,
  anchorRef,
}: {
  user: HeaderUser;
  onClose: () => void;
  onLogout: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const cached = cardCache?.owner === user.displayName ? cardCache.data : null;
  const [data, setData] = useState<MembershipCardPayload | null>(cached);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (cardCache?.owner === user.displayName) return;
    let cancelled = false;
    fetch("/api/me/membership-card", { cache: "no-store", headers: { accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: MembershipCardPayload) => {
        cardCache = { owner: user.displayName, data: d };
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user.displayName]);

  useEffect(() => {
    const anchor = anchorRef.current;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || anchor?.contains(t)) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      anchor?.focus({ preventScroll: true });
    };
  }, [onClose, anchorRef]);

  return (
    <div ref={panelRef} role="dialog" aria-label="Tài khoản của bạn" className={styles.panel}>
      <div className={styles.head}>
        <span className={styles.avatar} aria-hidden>
          {initialsOf(user.displayName)}
        </span>
        <div className={styles.who}>
          <strong className={styles.name}>{user.displayName}</strong>
          <span className={styles.login}>{data?.login ?? "Tài khoản HSV-ID"}</span>
        </div>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Đóng" className={styles.close}>
          <IconClose size={16} />
        </button>
      </div>

      <div className={styles.roles}>
        <span className={styles.role}>Tài khoản cá nhân</span>
        {user.editorRole && <span className={`${styles.role} ${styles.roleEditor}`}>Ban biên tập · {user.editorRole}</span>}
        {data?.isMember && <span className={`${styles.role} ${styles.roleMember}`}>Hội viên</span>}
      </div>

      <div className={styles.cardArea}>
        {data ? (
          <MemberCardBlock data={data} compact />
        ) : failed ? (
          <p className={styles.loadError}>Không tải được Thẻ Hội viên. Mở “Thẻ Hội viên &amp; tài khoản” để thử lại.</p>
        ) : (
          <div className={styles.skeleton} aria-label="Đang tải Thẻ Hội viên" role="status" />
        )}
      </div>

      <nav className={styles.menu} aria-label="Tài khoản">
        <Link href="/tai-khoan" onClick={onClose} className={styles.item}>
          <span className={styles.itemIcon}>
            <IconIdCard size={17} />
          </span>
          <span className={styles.itemText}>
            Thẻ Hội viên &amp; tài khoản
            <small>Xem hồ sơ dùng chung, thẻ và các nền tảng đã kết nối</small>
          </span>
        </Link>
        <Link href="/tai-khoan/sua" onClick={onClose} className={styles.item}>
          <span className={styles.itemIcon}>
            <IconEdit size={16} />
          </span>
          <span className={styles.itemText}>
            Sửa thông tin tài khoản
            <small>Họ tên, ngày sinh, đơn vị, chức vụ — cập nhật cho mọi nền tảng</small>
          </span>
        </Link>
        {user.editorRole && (
          <Link href="/admin/dashboard" onClick={onClose} className={styles.item}>
            <span className={`${styles.itemIcon} ${styles.itemIconDark}`}>
              <IconPen size={15} />
            </span>
            <span className={styles.itemText}>
              Trang quản trị
              <small>Khu vực Ban biên tập · {user.editorRole}</small>
            </span>
          </Link>
        )}
      </nav>

      <div className={styles.platforms}>
        <span className={styles.platformsLabel}>Vào thẳng — không cần đăng nhập lại</span>
        <div className={styles.platformRow}>
          {ECOSYSTEM_LINKS.filter((l) => l.sso).map((l) => {
            const Icon = PLATFORM_ICON[l.key];
            return (
              <a key={l.key} href={l.href} target="_blank" rel="noopener noreferrer" className={styles.platform} data-tone={l.key}>
                <span className={styles.platformIcon}>
                  <Icon size={17} />
                </span>
                {l.label}
                <IconExternal size={12} />
              </a>
            );
          })}
        </div>
      </div>

      <div className={styles.foot}>
        <button type="button" onClick={onLogout} className={styles.logout}>
          <IconLogout size={16} />
          Đăng xuất
        </button>
        <span className={styles.footNote}>Đăng xuất khỏi mọi nền tảng dùng chung tài khoản</span>
      </div>
    </div>
  );
}
