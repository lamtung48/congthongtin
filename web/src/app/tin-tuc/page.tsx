import type { Metadata } from "next";
import { PageShell } from "@/components/ui/PageShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { ArticleList } from "@/components/content/ArticleList";
import { getLatestArticles } from "@/services/homepageService";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Tin tức",
  description: "Toàn bộ tin tức mới nhất của Hội Sinh viên Việt Nam.",
  path: "/tin-tuc",
});

export default async function TinTucPage() {
  const articles = await getLatestArticles();

  return (
    <PageShell
      breadcrumb={[{ label: "Trang chủ", href: "/" }, { label: "Tin tức" }]}
      eyebrow="Cổng thông tin"
      title="Tin tức"
      description="Toàn bộ tin tức mới nhất của Hội Sinh viên Việt Nam."
    >
      {articles.length === 0 ? (
        <EmptyState title="Chưa có tin tức" description="Chưa có bài viết nào trong dữ liệu hiện có." />
      ) : (
        <ArticleList articles={articles} />
      )}
    </PageShell>
  );
}
