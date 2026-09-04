"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageShell } from "@/components/ui/PageShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { ArticleList } from "@/components/content/ArticleList";
import { searchContent } from "@/services/contentService";
import type { ArticleSummary } from "@/domain/article";
import type { SearchSuggestion } from "@/domain/homepage";

/**
 * Static export has no per-request rendering, so `searchParams` can't be read
 * server-side (see `docs/DEPLOYMENT.md`) — this reads `?q=` client-side
 * instead. The page's `<title>` is therefore the static "Tìm kiếm" from
 * `page.tsx`'s `metadata`, not query-aware like it was as a Server Component.
 */
export function SearchPageClient() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const [rawResults, setResults] = useState<SearchSuggestion[]>([]);

  useEffect(() => {
    if (!query) return;
    let cancelled = false;
    searchContent(query).then((r) => {
      if (!cancelled) setResults(r);
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  // No query -> no results, regardless of what a previous query left behind.
  const results = query ? rawResults : [];

  // `SearchSuggestion` already carries the fields `ArticleList` needs
  // (title/category/publishedAt/url/slug) except `category` is a plain
  // string here (search doesn't resolve a full `Category` object), so it's
  // wrapped into the shape `ArticleList` expects rather than duplicating
  // the list markup for one extra field's type.
  const asArticles: ArticleSummary[] = results.map((r) => ({
    id: r.slug,
    slug: r.slug,
    url: r.url,
    title: r.title,
    category: { id: r.category, slug: r.category, name: r.category },
    publishedAt: r.publishedAt,
  }));

  return (
    <PageShell
      breadcrumb={[{ label: "Trang chủ", href: "/" }, { label: "Tìm kiếm" }]}
      eyebrow="Tìm kiếm"
      title={query ? `Kết quả cho “${query}”` : "Tìm kiếm"}
      description={query ? `${results.length} kết quả phù hợp.` : "Nhập từ khoá ở ô tìm kiếm trên thanh điều hướng để bắt đầu."}
    >
      {!query ? (
        <EmptyState title="Chưa có từ khoá tìm kiếm" description="Mở ô tìm kiếm ở đầu trang và nhập từ khoá để xem kết quả tại đây." />
      ) : results.length === 0 ? (
        <EmptyState
          title={`Không tìm thấy kết quả cho “${query}”`}
          description="Thử một từ khoá khác, hoặc xem toàn bộ tin tức."
          action={{ label: "Xem tất cả tin tức", href: "/tin-tuc" }}
        />
      ) : (
        <ArticleList articles={asArticles} />
      )}
    </PageShell>
  );
}
