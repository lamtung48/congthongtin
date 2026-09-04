import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/ui/PageShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { ArticleList } from "@/components/content/ArticleList";
import { getCategoryBySlug, getArticlesByCategory, getCategories } from "@/services/contentService";
import { pageMetadata } from "@/lib/seo";
import { categoryHref } from "@/lib/routes";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) {
    return pageMetadata({ title: "Không tìm thấy chuyên mục", description: "Chuyên mục không tồn tại.", path: categoryHref(slug), noIndex: true });
  }
  return pageMetadata({ title: category.name, description: `Tin tức thuộc chuyên mục ${category.name}.`, path: categoryHref(category.slug) });
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const articles = await getArticlesByCategory(category.slug);

  return (
    <PageShell
      breadcrumb={[{ label: "Trang chủ", href: "/" }, { label: "Tin tức", href: "/tin-tuc" }, { label: category.name }]}
      eyebrow="Chuyên mục"
      title={category.name}
      description={`Tin tức thuộc chuyên mục ${category.name}.`}
    >
      {articles.length === 0 ? (
        <EmptyState
          title="Chưa có bài viết trong chuyên mục này"
          description="Dữ liệu mẫu hiện chưa có bài viết nào gắn với chuyên mục này."
          action={{ label: "Xem tất cả tin tức", href: "/tin-tuc" }}
        />
      ) : (
        <ArticleList articles={articles} />
      )}
    </PageShell>
  );
}
