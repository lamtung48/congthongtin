"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./page.module.css";
import { PageShell } from "@/components/ui/PageShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchResultRow } from "@/components/content/SearchResultRow";
import { IconSearch, IconWarning } from "@/components/icons";
import { fetchSearchResults } from "@/lib/searchClient";
import { searchHref } from "@/lib/routes";
import type { SearchResultItem } from "@/domain/search";

type Phase = "initial" | "loading" | "results" | "empty" | "error";

const PAGE_RESULT_LIMIT = 40;

/**
 * Static export has no per-request rendering, so `searchParams` can't be
 * read server-side (see `docs/DEPLOYMENT.md`) — this reads/writes `?q=`
 * client-side instead. Unlike the header's `SearchOverlay`, this page has
 * its own editable query input (item 3 of the brief's flow diagram: "query
 * input" is either the overlay or this page, not only the overlay) and
 * renders every state — initial/loading/results/empty/error — the same
 * five the overlay does. See `docs/SEARCH_ARCHITECTURE.md`.
 */
export function SearchPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q")?.trim() ?? "";

  const [inputValue, setInputValue] = useState(q);
  const [rawPhase, setPhase] = useState<Phase>(q ? "loading" : "initial");
  const [rawResults, setResults] = useState<SearchResultItem[]>([]);
  const [retryTick, setRetryTick] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);

  // Keep the input in sync when `?q=` changes from elsewhere (a header
  // search, a tag chip link, browser back/forward) — computed during
  // render, not an effect, since it's state derived from a prop change.
  const [prevQ, setPrevQ] = useState(q);
  if (q !== prevQ) {
    setPrevQ(q);
    setInputValue(q);
  }

  useEffect(() => {
    if (!q) return;
    let cancelled = false;
    // `q` comes from the URL (an external source), so kicking off a new
    // fetch and flagging it as loading is a legitimate effect — not state
    // React itself already had a way to derive.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase("loading");
    const requestId = ++requestIdRef.current;
    fetchSearchResults(q, PAGE_RESULT_LIMIT)
      .then((hits) => {
        if (cancelled || requestId !== requestIdRef.current) return;
        setPhase(hits.length ? "results" : "empty");
        setResults(hits);
      })
      .catch(() => {
        if (cancelled || requestId !== requestIdRef.current) return;
        setPhase("error");
        setResults([]);
      });
    return () => {
      cancelled = true;
    };
  }, [q, retryTick]);

  // No query -> always "initial", regardless of what a previous query left behind.
  const phase: Phase = q ? rawPhase : "initial";
  const results = q ? rawResults : [];

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(searchHref(inputValue));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setInputValue("");
      router.push(searchHref());
      inputRef.current?.blur();
    }
  }

  return (
    <PageShell
      breadcrumb={[{ label: "Trang chủ", href: "/" }, { label: "Tìm kiếm" }]}
      eyebrow="Tìm kiếm"
      title={q ? `Kết quả cho "${q}"` : "Tìm kiếm"}
      description={
        phase === "results"
          ? `${results.length} kết quả phù hợp.`
          : "Tìm bài viết, chuyên mục, chủ đề, đơn vị, địa phương và sự kiện trên cổng thông tin."
      }
    >
      <form onSubmit={onSubmit} role="search" aria-label="Tìm kiếm trên cổng thông tin" className={styles.searchForm}>
        <span className={styles.searchIcon}>
          <IconSearch size={19} />
        </span>
        <input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={onKeyDown}
          type="search"
          placeholder="Nhập từ khoá…"
          aria-label="Từ khoá tìm kiếm"
          autoComplete="off"
          className={styles.searchInput}
        />
        <button type="submit" className={styles.searchSubmit}>Tìm kiếm</button>
      </form>

      {phase === "initial" && (
        <EmptyState title="Chưa có từ khoá tìm kiếm" description="Nhập từ khoá ở ô tìm kiếm phía trên để bắt đầu." />
      )}

      {phase === "loading" && (
        <div aria-live="polite" aria-busy="true" className={styles.skeletonList}>
          {[0, 1, 2, 3].map((k) => (
            <div key={k} className={styles.skeletonRow}>
              <div className={styles.skelLabel} />
              <div className={styles.skelLine} />
            </div>
          ))}
        </div>
      )}

      {phase === "results" && (
        <ul aria-label="Kết quả tìm kiếm" aria-live="polite" className={styles.resultsList}>
          {results.map((r) => (
            <li key={r.id} className={styles.resultItem}>
              <SearchResultRow item={r} full />
            </li>
          ))}
        </ul>
      )}

      {phase === "empty" && (
        <EmptyState
          title={`Không tìm thấy kết quả cho "${q}"`}
          description="Thử một từ khoá khác, hoặc xem toàn bộ tin tức."
          action={{ label: "Xem tất cả tin tức", href: "/tin-tuc" }}
        />
      )}

      {phase === "error" && (
        <div className={styles.errorBox} role="alert">
          <IconWarning size={28} className={styles.errorIcon} />
          <span className={styles.errorTitle}>Không thể tải kết quả tìm kiếm</span>
          <p className={styles.errorDesc}>Đã có lỗi khi kết nối tới dịch vụ tìm kiếm. Vui lòng thử lại.</p>
          <button type="button" onClick={() => setRetryTick((t) => t + 1)} className={styles.retryBtn}>Thử lại</button>
        </div>
      )}
    </PageShell>
  );
}
