import type { Metadata } from "next";
import { PageShell } from "@/components/ui/PageShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { ArticleList } from "@/components/content/ArticleList";
import { searchContent } from "@/services/contentService";
import { pageMetadata } from "@/lib/seo";
import { searchHref } from "@/lib/routes";
import type { ArticleSummary } from "@/domain/article";

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  return pageMetadata({
    title: q ? `Kết quả cho “${q}”` : "Tìm kiếm",
    description: "Tìm kiếm tin tức trên Cổng thông tin số Hội Sinh viên Việt Nam.",
    path: searchHref(q),
    noIndex: true,
  });
}

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const results = query ? await searchContent(query) : [];

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
