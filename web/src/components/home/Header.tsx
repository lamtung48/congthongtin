"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./Header.module.css";
import type { NavItem } from "@/domain/homepage";
import type { SearchResultItem } from "@/domain/search";
import type { Topic } from "@/domain/taxonomy";
import { useViewport } from "@/lib/hooks/useViewport";
import { useModalDialog } from "@/lib/hooks/useModalDialog";
import { IconActivity, IconChevronDown, IconConference, IconMenu, IconSearch, IconTraining, IconUser } from "@/components/icons";
import { SearchOverlay } from "./SearchOverlay";
import { AccountPanel, type HeaderUser } from "@/components/account/AccountPanel";
import { initialsOf } from "@/lib/initials";
import { ECOSYSTEM_LINKS } from "@/lib/siteChrome";

const PLATFORM_ICON = { activity: IconActivity, training: IconTraining, conference: IconConference } as const;

export function Header({
  nav,
  searchTopics,
  searchCorpus,
}: {
  nav: NavItem[];
  searchTopics: Topic[];
  searchCorpus: SearchResultItem[];
}) {
  const { navMode, narrow, mobile } = useViewport();
  const pathname = usePathname();
  const [compact, setCompact] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // Signed-in visitor — any personal (HSV-ID / SSO) account; `editorRole`
  // only for Ban biên tập members. `undefined` = not checked yet, `null` =
  // signed out. Fetched client-side so the `(site)` pages stay static/ISR —
  // see `src/app/api/session/route.ts`.
  const [me, setMe] = useState<HeaderUser | null | undefined>(undefined);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const closeUserMenu = useCallback(() => setUserMenuOpen(false), []);
  const accountBtnRef = useRef<HTMLButtonElement>(null);
  const searchBtnRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 96);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Reset the drawer when the layout grows out of "narrow" — computed during
  // render (not an effect) since it's state derived from a prop change.
  const [prevNarrow, setPrevNarrow] = useState(narrow);
  if (narrow !== prevNarrow) {
    setPrevNarrow(narrow);
    if (!narrow) setDrawerOpen(false);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMoreOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Re-checked on every navigation, not just on mount: the header lives in
  // the shared `(site)` layout, which a client-side navigation keeps
  // mounted — so after signing in (the login action redirects client-side)
  // a mount-only check would keep showing "Đăng nhập" until a full reload.
  // Also re-checked when the tab becomes visible again, since signing in or
  // out on Hoạt động / Đào tạo changes the shared SSO cookie behind our back.
  useEffect(() => {
    let cancelled = false;
    const check = () =>
      fetch("/api/session", { headers: { accept: "application/json" }, cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { user: null }))
        .then((d) => {
          if (!cancelled) setMe(d?.user ?? null);
        })
        .catch(() => {
          if (!cancelled) setMe(null);
        });
    check();
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname]);

  async function handleLogout() {
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch {
      // ignore — redirect anyway; a stale cookie fails the next auth check
    }
    window.location.assign("/");
  }

  useModalDialog(drawerOpen, drawerRef, () => setDrawerOpen(false), drawerCloseRef);

  const loginHref = pathname && pathname !== "/" && !pathname.startsWith("/dang-nhap") ? `/dang-nhap?next=${encodeURIComponent(pathname)}` : "/dang-nhap";
  const compactNav = navMode === "compact";
  const navVisible = compactNav ? nav.slice(0, 3) : nav;
  const navOverflow = compactNav ? nav.slice(3) : [];

  return (
    <>
      <div className={styles.wrap}>
        <header className={`${styles.bar} ${compact ? styles.compact : ""}`}>
          <div className={styles.inner}>
            <Link href="/" className={styles.brand}>
              <Image src="/images/hsv-logo.png" alt="Huy hiệu Hội Sinh viên Việt Nam" width={40} height={40} priority style={{ flex: "0 0 auto", display: "block", objectFit: "contain" }} />
              <span className={styles.brandText}>
                <span className={styles.brandName}>Hội Sinh viên Việt Nam</span>
                <span className={styles.brandSub}>Cổng thông tin số</span>
              </span>
            </Link>

            {navMode !== "drawer" && (
              <nav aria-label="Điều hướng chính" className={styles.nav}>
                {navVisible.map((item) => {
                  if (item.soon) {
                    return (
                      <span key={item.label} aria-disabled="true" title="Trang đang được xây dựng" className={styles.navLink}>
                        {item.label}
                      </span>
                    );
                  }
                  if (item.external) {
                    return (
                      <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer" className={styles.navLink}>
                        {item.label}
                      </a>
                    );
                  }
                  const active = item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
                  return (
                    <Link key={item.label} href={item.href} aria-current={active ? "page" : undefined} className={active ? styles.navLinkActive : styles.navLink}>
                      {item.label}
                    </Link>
                  );
                })}
                {compactNav && (
                  <span style={{ position: "relative", display: "inline-flex" }}>
                    <button type="button" onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen} className={styles.moreBtn}>
                      Thêm <IconChevronDown size={14} />
                    </button>
                    {moreOpen && (
                      <span className={styles.moreMenu}>
                        {navOverflow.map((item) =>
                          item.soon ? (
                            <span key={item.label} aria-disabled="true" title="Trang đang được xây dựng" className={styles.moreMenuLink}>
                              {item.label}
                            </span>
                          ) : item.external ? (
                            <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer" onClick={() => setMoreOpen(false)} className={styles.moreMenuLink}>
                              {item.label}
                            </a>
                          ) : (
                            <Link key={item.label} href={item.href} onClick={() => setMoreOpen(false)} className={styles.moreMenuLink}>
                              {item.label}
                            </Link>
                          )
                        )}
                      </span>
                    )}
                  </span>
                )}
              </nav>
            )}

            <div className={styles.actions}>
              {/* Hoạt động · Đào tạo · Hội nghị — small quick buttons (the big
                  cards live in the launchpad under the Hero). Labels collapse
                  to icons on narrower desktops; the drawer lists them below. */}
              {navMode !== "drawer" && (
                <nav aria-label="Nền tảng số" className={styles.platforms}>
                  {ECOSYSTEM_LINKS.map((l) => {
                    const Icon = PLATFORM_ICON[l.key];
                    return (
                      <a
                        key={l.key}
                        href={l.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.platformBtn}
                        data-tone={l.key}
                        aria-label={`Nền tảng ${l.label} (mở tab mới)`}
                      >
                        <span className={styles.platformIcon}>
                          <Icon size={14} />
                        </span>
                        <span className={styles.platformLabel}>{l.label}</span>
                      </a>
                    );
                  })}
                </nav>
              )}
              <button
                ref={searchBtnRef}
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="Tìm kiếm"
                className={styles.iconBtn}
              >
                <IconSearch size={18} />
              </button>
              {me ? (
                <span className={styles.accountWrap}>
                  {mobile ? (
                    // Mobile: no room for a dropdown next to search + the hamburger, and a small popover is
                    // fiddly to reach with a thumb — go straight to the full account page instead (it has
                    // everything the dropdown would: Thẻ Hội viên, sửa thông tin, các nền tảng, đăng xuất).
                    <Link href="/tai-khoan" className={styles.accountBtn} title={me.displayName}>
                      <span className={styles.avatar} aria-hidden>
                        {initialsOf(me.displayName)}
                      </span>
                      <span className="srOnly">Mở tài khoản — {me.displayName}</span>
                    </Link>
                  ) : (
                    <button
                      ref={accountBtnRef}
                      type="button"
                      onClick={() => setUserMenuOpen((v) => !v)}
                      aria-expanded={userMenuOpen}
                      aria-haspopup="dialog"
                      className={styles.accountBtn}
                      title={me.displayName}
                    >
                      <span className={styles.avatar} aria-hidden>
                        {initialsOf(me.displayName)}
                      </span>
                      <span className={styles.accountName}>{me.displayName}</span>
                      <IconChevronDown size={14} />
                      <span className="srOnly">Mở bảng tài khoản</span>
                    </button>
                  )}
                  {!mobile && userMenuOpen && <AccountPanel user={me} onClose={closeUserMenu} onLogout={handleLogout} anchorRef={accountBtnRef} />}
                </span>
              ) : me === null ? (
                /* On mobile the login pill doesn't fit next to search + the
                   hamburger — it moves into the drawer below instead. */
                !mobile && (
                  <Link href={loginHref} className={styles.loginBtn}>
                    <IconUser size={16} />
                    Đăng nhập
                  </Link>
                )
              ) : (
                // Session not checked yet: hold the space instead of flashing "Đăng nhập" at a signed-in visitor.
                !mobile && <span aria-hidden className={styles.accountPending} />
              )}
              {narrow && (
                <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Mở menu" aria-expanded={drawerOpen} className={styles.iconBtn}>
                  <IconMenu size={19} />
                </button>
              )}
            </div>
          </div>
        </header>
      </div>

      {narrow && drawerOpen && (
        <div ref={drawerRef} role="dialog" aria-modal="true" aria-label="Điều hướng" className={styles.drawer}>
          <div className={styles.drawerHead}>
            <span className={styles.drawerEyebrow}>Điều hướng</span>
            <button ref={drawerCloseRef} type="button" onClick={() => setDrawerOpen(false)} aria-label="Đóng menu" className={styles.iconBtn}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <div className={styles.drawerList}>
            {nav.map((item) =>
              item.soon ? (
                <span key={item.label} aria-disabled="true" title="Trang đang được xây dựng" className={styles.drawerLink}>
                  {item.label}
                </span>
              ) : item.external ? (
                <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer" onClick={() => setDrawerOpen(false)} className={styles.drawerLink}>
                  {item.label}
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <path d="M5 12h13M13 6l6 6-6 6" />
                  </svg>
                </a>
              ) : (
                <Link key={item.label} href={item.href} onClick={() => setDrawerOpen(false)} className={styles.drawerLink}>
                  {item.label}
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <path d="M5 12h13M13 6l6 6-6 6" />
                  </svg>
                </Link>
              )
            )}
            <span className={styles.drawerSection}>Nền tảng số</span>
            <div className={styles.drawerPlatforms}>
              {ECOSYSTEM_LINKS.map((l) => {
                const Icon = PLATFORM_ICON[l.key];
                return (
                  <a key={l.key} href={l.href} target="_blank" rel="noopener noreferrer" onClick={() => setDrawerOpen(false)} className={styles.drawerPlatform} data-tone={l.key}>
                    <span className={styles.platformIcon}>
                      <Icon size={17} />
                    </span>
                    <span>
                      {l.label}
                      <small>{l.hint}</small>
                    </span>
                  </a>
                );
              })}
            </div>
            {mobile && !me && (
              <Link href={loginHref} onClick={() => setDrawerOpen(false)} className={styles.drawerLogin}>
                <IconUser size={18} />
                Đăng nhập
              </Link>
            )}
          </div>
        </div>
      )}

      <SearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        returnFocusRef={searchBtnRef}
        topics={searchTopics}
        corpus={searchCorpus}
      />
    </>
  );
}
