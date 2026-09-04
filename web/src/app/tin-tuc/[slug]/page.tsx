import type { Metadata } from "next";
import { notFound } from "next/navigation";
import styles from "./page.module.css";
import { PageShell } from "@/components/ui/PageShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { MediaImage } from "@/components/ui/MediaImage";
import { getArticleBySlug, getArticleSlugs } from "@/services/contentService";
import { pageMetadata } from "@/lib/seo";
import { categoryHref, articleHref } from "@/lib/routes";
import { formatDateVi } from "@/lib/formatDate";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await getArticleSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) {
    return pageMetadata({ title: "Không tìm thấy bài viết", description: "Bài viết không tồn tại hoặc đã bị gỡ.", path: articleHref(slug), noIndex: true });
  }
  return pageMetadata({ title: article.title, description: article.lead ?? article.title, path: article.url });
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) notFound();

  return (
    <PageShell
      breadcrumb={[
        { label: "Trang chủ", href: "/" },
        { label: "Tin tức", href: "/tin-tuc" },
        { label: article.category.name, href: categoryHref(article.category.slug) },
        { label: article.title },
      ]}
      eyebrow={article.category.name}
      title={article.title}
      description={article.lead}
    >
      <div className={styles.body}>
        <div className={styles.meta}>
          <span>{formatDateVi(article.publishedAt)}</span>
          {article.place && <span>· {article.place}</span>}
        </div>
        {article.coverImage && (
          <div className={styles.cover}>
            <MediaImage media={article.coverImage} />
          </div>
        )}
        <EmptyState
          title="Nội dung bài viết đang được biên tập"
          description="Bản đầy đủ của bài viết chưa có trong dữ liệu mẫu — trang này sẽ hiển thị nội dung thật khi kết nối với hệ thống quản trị nội dung."
          action={{ label: "Xem tất cả tin tức", href: "/tin-tuc" }}
        />
      </div>
    </PageShell>
  );
}
