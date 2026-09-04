"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type RefObject } from "react";
import styles from "./SearchOverlay.module.css";
import { SearchResultRow } from "@/components/content/SearchResultRow";
import type { SearchResultItem } from "@/domain/search";
import type { Topic } from "@/domain/taxonomy";
import { searchHref } from "@/lib/routes";
import { searchContent } from "@/services/contentService";
import { IconClose, IconSearch, IconWarning } from "@/components/icons";

/** Matches the task brief's five states exactly — "initial" is the empty
 *  input / trending-suggestions state, not a loading placeholder. */
type Phase = "initial" | "loading" | "results" | "empty" | "error";

const DEBOUNCE_MS = 350;
const OVERLAY_RESULT_LIMIT = 8;

export function SearchOverlay({
  open,
  onClose,
  returnFocusRef,
  topics,
  corpus,
}: {
  open: boolean;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  topics: Topic[];
  corpus: SearchResultItem[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<Phase>("initial");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const requestIdRef = useRef(0);

  const suggestions = corpus.slice(0, 4);
  // The list arrow keys move through — whichever one is actually on screen.
  const visibleItems = phase === "initial" ? suggestions : phase === "results" ? results : [];

  // Reset the search state when the overlay opens — computed during render
  // (not an effect) since it's state derived from the `open` prop change.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setPhase("initial");
      setResults([]);
      setHighlightIndex(-1);
    }
  }

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        setTimeout(() => returnFocusRef.current?.focus(), 0);
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        const focusable = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>('a[href],button,input,[tabindex]:not([tabindex="-1"])')
        ).filter((el) => el.offsetParent !== null);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, returnFocusRef]);

  function runSearch(value: string) {
    clearTimeout(timerRef.current);
    setQuery(value);
    setHighlightIndex(-1);
    if (!value.trim()) {
      setPhase("initial");
      setResults([]);
      return;
    }
    setPhase("loading");
    const requestId = ++requestIdRef.current;
    timerRef.current = setTimeout(() => {
      searchContent(value, OVERLAY_RESULT_LIMIT)
        .then((hits) => {
          if (requestId !== requestIdRef.current) return; // a newer keystroke has already superseded this request
          setPhase(hits.length ? "results" : "empty");
          setResults(hits);
        })
        .catch(() => {
          if (requestId !== requestIdRef.current) return;
          setPhase("error");
          setResults([]);
        });
    }, DEBOUNCE_MS);
  }

  function closeAndReturnFocus() {
    onClose();
    setTimeout(() => returnFocusRef.current?.focus(), 0);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const picked = highlightIndex >= 0 ? visibleItems[highlightIndex] : undefined;
    if (picked) {
      router.push(picked.url);
      closeAndReturnFocus();
      return;
    }
    if (!query.trim()) return;
    router.push(searchHref(query));
    closeAndReturnFocus();
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!visibleItems.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => (i + 1) % visibleItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => (i <= 0 ? visibleItems.length - 1 : i - 1));
    }
  }

  if (!open) return null;

  const activeId = highlightIndex >= 0 ? `search-option-${highlightIndex}` : undefined;

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Tìm kiếm trên cổng thông tin"
      onClick={closeAndReturnFocus}
    >
      <div className={styles.panel} ref={panelRef} onClick={(e) => e.stopPropagation()}>
        <div className={styles.head}>
          <span className={styles.title}>Tìm kiếm</span>
          <button type="button" onClick={onClose} aria-label="Đóng tìm kiếm" className={styles.closeBtn}>
            <IconClose size={17} />
          </button>
        </div>
        <form onSubmit={onSubmit} className={styles.inputRow}>
          <span style={{ color: "var(--text-muted)", display: "flex" }}>
            <IconSearch size={19} />
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => runSearch(e.target.value)}
            onKeyDown={onInputKeyDown}
            role="combobox"
            aria-expanded={visibleItems.length > 0}
            aria-controls="search-listbox"
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            aria-label="Từ khoá tìm kiếm"
            placeholder="Tìm bài viết, chuyên mục, đơn vị, địa phương…"
            autoComplete="off"
            className={styles.input}
          />
          <span className={styles.escHint}>ESC để đóng</span>
        </form>

        {phase === "initial" && (
          <div className={styles.body}>
            <div id="search-listbox" role="listbox" aria-label="Tìm nhiều nhất" style={{ display: "flex", flexDirection: "column", gap: "var(--sp-1)" }}>
              <span className={styles.label}>Tìm nhiều nhất</span>
              {suggestions.map((s, i) => (
                <SearchResultRow key={s.id} item={s} id={`search-option-${i}`} highlighted={i === highlightIndex} />
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)", paddingTop: "var(--sp-5)", borderTop: "1px solid var(--border-subtle)" }}>
              <span className={styles.label}>Chủ đề sẵn có</span>
              <div className={styles.tagRow}>
                {topics.map((t) => (
                  <Link key={t.slug} href={t.url} className={styles.tagChip}>
                    #{t.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {phase === "loading" && (
          <div className={styles.body} aria-live="polite" aria-busy="true">
            <span className={styles.label}>Đang tìm…</span>
            {[0, 1, 2].map((k) => (
              <div key={k} style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                <div className={styles.skelLabel} />
                <div className={styles.skelLine} />
              </div>
            ))}
          </div>
        )}

        {phase === "results" && (
          <div id="search-listbox" role="listbox" aria-label="Kết quả tìm kiếm" className={styles.resultsList} aria-live="polite">
            <span className={styles.label} style={{ padding: "8px var(--sp-3) var(--sp-3)" }}>
              {results.length} kết quả
            </span>
            {results.map((r, i) => (
              <SearchResultRow key={r.id} item={r} id={`search-option-${i}`} highlighted={i === highlightIndex} />
            ))}
            <Link href={searchHref(query)} onClick={onClose} className={styles.allResults}>
              Xem tất cả kết quả
            </Link>
          </div>
        )}

        {phase === "empty" && (
          <div className={styles.centered} aria-live="polite">
            <span style={{ fontFamily: "var(--font-editorial)", fontSize: "var(--fs-h5)", color: "var(--text-strong)" }}>
              Không tìm thấy kết quả cho “{query}”
            </span>
            <span style={{ fontSize: "var(--fs-body-sm)", lineHeight: 1.6, color: "var(--text-muted)", maxWidth: "46ch" }}>
              Thử từ khoá ngắn hơn, hoặc chọn một chủ đề sẵn có bên dưới.
            </span>
            <button type="button" onClick={() => runSearch("")} className={styles.retryBtn}>
              Xoá từ khoá
            </button>
          </div>
        )}

        {phase === "error" && (
          <div className={styles.centered} role="alert">
            <IconWarning size={26} className={styles.errorIcon} />
            <span style={{ fontFamily: "var(--font-editorial)", fontSize: "var(--fs-h5)", color: "var(--text-strong)" }}>
              Không thể tải kết quả tìm kiếm
            </span>
            <span style={{ fontSize: "var(--fs-body-sm)", lineHeight: 1.6, color: "var(--text-muted)", maxWidth: "46ch" }}>
              Đã có lỗi khi kết nối tới dịch vụ tìm kiếm. Vui lòng thử lại.
            </span>
            <button type="button" onClick={() => runSearch(query)} className={styles.retryBtn}>
              Thử lại
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
