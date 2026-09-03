"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type RefObject } from "react";
import styles from "./SearchOverlay.module.css";
import { tags, searchCorpus } from "@/lib/data/homepage";
import { IconClose, IconSearch } from "@/components/icons";

function norm(v: string) {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase();
}

type Phase = "idle" | "loading" | "results" | "empty";

export function SearchOverlay({
  open,
  onClose,
  returnFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [results, setResults] = useState<typeof searchCorpus>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Reset the search state when the overlay opens — computed during render
  // (not an effect) since it's state derived from the `open` prop change.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setPhase("idle");
      setResults([]);
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
    if (!value.trim()) {
      setPhase("idle");
      setResults([]);
      return;
    }
    setPhase("loading");
    timerRef.current = setTimeout(() => {
      const k = norm(value.trim());
      const hits = searchCorpus.filter((c) => norm(c.title + " " + c.category).includes(k));
      setPhase(hits.length ? "results" : "empty");
      setResults(hits.slice(0, 5));
    }, 420);
  }

  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Tìm kiếm trên cổng thông tin"
      onClick={() => {
        onClose();
        setTimeout(() => returnFocusRef.current?.focus(), 0);
      }}
    >
      <div className={styles.panel} ref={panelRef} onClick={(e) => e.stopPropagation()}>
        <div className={styles.head}>
          <span className={styles.title}>Tìm kiếm</span>
          <button type="button" onClick={onClose} aria-label="Đóng tìm kiếm" className={styles.closeBtn}>
            <IconClose size={17} />
          </button>
        </div>
        <div className={styles.inputRow}>
          <span style={{ color: "var(--text-muted)", display: "flex" }}>
            <IconSearch size={19} />
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => runSearch(e.target.value)}
            aria-label="Từ khoá tìm kiếm"
            placeholder="Tìm tin tức, phong trào, văn bản…"
            className={styles.input}
          />
          <span className={styles.escHint}>ESC để đóng</span>
        </div>

        {phase === "idle" && (
          <div className={styles.body}>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
              <span className={styles.label}>Tìm nhiều nhất</span>
              {searchCorpus.slice(0, 4).map((s) => (
                <Link
                  key={s.title}
                  href="#"
                  aria-disabled="true"
                  title="Chưa khả dụng trong bản mẫu — cần URL thật khi triển khai"
                  className={styles.suggestLink}
                >
                  <span style={{ fontFamily: "var(--font-ui)", fontSize: 14.5 }}>{s.title}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>{s.category}</span>
                </Link>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)", paddingTop: "var(--sp-5)", borderTop: "1px solid var(--border-subtle)" }}>
              <span className={styles.label}>Chủ đề sẵn có</span>
              <div className={styles.tagRow}>
                {tags.map((t) => (
                  <Link key={t.name} href={t.href} prefetch={false} className={styles.tagChip}>
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
          <div className={styles.resultsList} aria-live="polite">
            <span className={styles.label} style={{ padding: "8px var(--sp-3) var(--sp-3)" }}>
              {results.length} kết quả
            </span>
            {results.map((r) => (
              <Link key={r.title} href="/tin-tuc" prefetch={false} className={styles.resultLink}>
                <span className={styles.resultMeta}>
                  <span className={styles.resultCat}>{r.category}</span>
                  <span className={styles.resultDate}>{r.date}</span>
                </span>
                <span className={styles.resultTitle}>{r.title}</span>
              </Link>
            ))}
            <Link href="/tin-tuc" prefetch={false} className={styles.allResults}>
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
      </div>
    </div>
  );
}
