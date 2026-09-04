"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import styles from "./Header.module.css";
import type { NavItem, SearchSuggestion } from "@/domain/homepage";
import type { Topic } from "@/domain/taxonomy";
import { useViewport } from "@/lib/hooks/useViewport";
import { IconChevronDown, IconMenu, IconSearch, IconUser } from "@/components/icons";
import { SearchOverlay } from "./SearchOverlay";

export function Header({
  nav,
  searchTopics,
  searchCorpus,
}: {
  nav: NavItem[];
  searchTopics: Topic[];
  searchCorpus: SearchSuggestion[];
}) {
  const { navMode, narrow, mobile } = useViewport();
  const pathname = usePathname();
  const [compact, setCompact] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchBtnRef = useRef<HTMLButtonElement>(null);

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
      setDrawerOpen(false);
      setMoreOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const compactNav = navMode === "compact";
  const navVisible = compactNav ? nav.slice(0, 4) : nav;
  const navOverflow = compactNav ? nav.slice(4) : [];

  return (
    <>
      <div className={styles.wrap}>
        <header className={`${styles.bar} ${compact ? styles.compact : ""}`}>
          <div className={styles.inner}>
            <Link href="/" className={styles.brand}>
              <Image src="/images/hsv-logo.png" alt="Huy hiệu Hội Sinh viên Việt Nam" width={40} height={40} style={{ flex: "0 0 auto", display: "block", objectFit: "contain" }} />
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
                      <span key={item.label} aria-disabled="true" title="Trang chưa có trong bản mẫu" className={styles.navLink}>
                        {item.label}
                      </span>
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
                            <span key={item.label} aria-disabled="true" title="Trang chưa có trong bản mẫu" className={styles.moreMenuLink}>
                              {item.label}
                            </span>
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
              {!mobile && (
                <span aria-disabled="true" title="Đăng nhập chưa khả dụng trong bản mẫu" className={styles.loginBtn}>
                  Đăng nhập
                </span>
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
        <div role="dialog" aria-modal="true" aria-label="Điều hướng" className={styles.drawer}>
          <div className={styles.drawerHead}>
            <span className={styles.drawerEyebrow}>Điều hướng</span>
            <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Đóng menu" className={styles.iconBtn}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <div className={styles.drawerList}>
            {nav.map((item) =>
              item.soon ? (
                <span key={item.label} aria-disabled="true" title="Trang chưa có trong bản mẫu" className={styles.drawerLink}>
                  {item.label}
                </span>
              ) : (
                <Link key={item.label} href={item.href} onClick={() => setDrawerOpen(false)} className={styles.drawerLink}>
                  {item.label}
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <path d="M5 12h13M13 6l6 6-6 6" />
                  </svg>
                </Link>
              )
            )}
            {mobile && (
              <span aria-disabled="true" title="Đăng nhập chưa khả dụng trong bản mẫu" className={styles.drawerLink}>
                Đăng nhập
                <IconUser size={18} />
              </span>
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
