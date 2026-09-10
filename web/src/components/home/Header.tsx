"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import styles from "./Header.module.css";
import type { NavItem } from "@/domain/homepage";
import type { SearchResultItem } from "@/domain/search";
import type { Topic } from "@/domain/taxonomy";
import { useViewport } from "@/lib/hooks/useViewport";
import { useModalDialog } from "@/lib/hooks/useModalDialog";
import { IconChevronDown, IconMenu, IconSearch, IconUser } from "@/components/icons";
import { SearchOverlay } from "./SearchOverlay";

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
  // Signed-in visitor (any role). `undefined` = not checked yet, `null` =
  // signed out. Fetched client-side so the `(site)` pages stay static/ISR —
  // see `src/app/api/session/route.ts`.
  const [me, setMe] = useState<{ displayName: string; roleLabel: string } | null | undefined>(undefined);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
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
      setUserMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/session", { headers: { accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => {
        if (!cancelled) setMe(d?.user ?? null);
      })
      .catch(() => {
        if (!cancelled) setMe(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch {
      // ignore — redirect anyway; a stale cookie fails the next auth check
    }
    window.location.assign("/");
  }

  useModalDialog(drawerOpen, drawerRef, () => setDrawerOpen(false), drawerCloseRef);

  const compactNav = navMode === "compact";
  const navVisible = compactNav ? nav.slice(0, 4) : nav;
  const navOverflow = compactNav ? nav.slice(4) : [];

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
              <button
                ref={searchBtnRef}
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="Tìm kiếm"
                className={styles.iconBtn}
              >
                <IconSearch size={18} />
              </button>
              {/* On mobile the login pill doesn't fit next to search + the
                  hamburger — it moves into the drawer below instead. */}
              {!mobile &&
                (me ? (
                  <span style={{ position: "relative", display: "inline-flex" }}>
                    <button
                      type="button"
                      onClick={() => setUserMenuOpen((v) => !v)}
                      aria-expanded={userMenuOpen}
                      aria-haspopup="menu"
                      className={styles.moreBtn}
                      title={me.displayName}
                    >
                      <IconUser size={17} />
                      <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{me.displayName}</span>
                      <IconChevronDown size={14} />
                    </button>
                    {userMenuOpen && (
                      <span role="menu" className={styles.moreMenu}>
                        <span style={{ padding: "4px 12px 6px", fontSize: 12.5, color: "var(--text-muted)" }}>{me.roleLabel}</span>
                        <Link href="/admin/dashboard" role="menuitem" onClick={() => setUserMenuOpen(false)} className={styles.moreMenuLink}>
                          Trang quản trị
                        </Link>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={handleLogout}
                          className={styles.moreMenuLink}
                          style={{ border: 0, background: "transparent", cursor: "pointer", textAlign: "left", width: "100%" }}
                        >
                          Đăng xuất
                        </button>
                      </span>
                    )}
                  </span>
                ) : (
                  <Link href="/admin/login" className={styles.loginBtn}>
                    Đăng nhập
                  </Link>
                ))}
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
            {mobile &&
              (me ? (
                <>
                  <span className={styles.drawerLink} style={{ opacity: 0.65 }}>
                    {me.displayName} · {me.roleLabel}
                  </span>
                  <Link href="/admin/dashboard" onClick={() => setDrawerOpen(false)} className={styles.drawerLink}>
                    Trang quản trị
                    <IconUser size={18} />
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setDrawerOpen(false);
                      handleLogout();
                    }}
                    className={styles.drawerLink}
                    style={{ border: 0, background: "transparent", cursor: "pointer", width: "100%", textAlign: "left" }}
                  >
                    Đăng xuất
                  </button>
                </>
              ) : (
                <Link href="/admin/login" onClick={() => setDrawerOpen(false)} className={styles.drawerLink}>
                  Đăng nhập
                  <IconUser size={18} />
                </Link>
              ))}
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
