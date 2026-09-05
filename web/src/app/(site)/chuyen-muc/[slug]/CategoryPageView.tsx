import { notFound } from "next/navigation";
import { PageShell } from "@/components/ui/PageShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { FeaturedNewsCard } from "@/components/content/FeaturedNewsCard";
import { ArticleList } from "@/components/content/ArticleList";
import { Pagination } from "@/components/content/Pagination";
import { getArticlesByCategory, getCategoryBySlug } from "@/services/contentService";
import { categoryHref } from "@/lib/routes";
import { paginate } from "@/lib/pagination";

export const CATEGORY_PAGE_SIZE = 8;

/** The category's most recent article is pulled out as the featured card
 *  (page 1 only); everything else is paginated. Shared by both the page
 *  itself and `generateStaticParams()`. */
async function getPool(slug: string) {
  const category = await getCategoryBySlug(slug);
  if (!category) return null;
  const articles = await getArticlesByCategory(slug);
  const [featured, ...rest] = articles;
  return { category, featured: featured ?? null, rest };
}

export async function getCategoryPageCount(slug: string): Promise<number> {
  const data = await getPool(slug);
  if (!data) return 1;
  return Math.max(1, Math.ceil(data.rest.length / CATEGORY_PAGE_SIZE));
}

/** Backs both `/chuyen-muc/[slug]` (page 1) and
 *  `/chuyen-muc/[slug]/trang/[page]` (page 2+). */
export async function CategoryPageView({ slug, page }: { slug: string; page: number }) {
  const data = await getPool(slug);
  if (!data) notFound();
  const { category, featured, rest } = data;

  const pageCount = Math.max(1, Math.ceil(rest.length / CATEGORY_PAGE_SIZE));
  if (!Number.isInteger(page) || page < 1 || page > pageCount) notFound();

  const { items } = paginate(rest, page, CATEGORY_PAGE_SIZE);

  return (
    <PageShell
      breadcrumb={[{ label: "Trang chủ", href: "/" }, { label: "Tin tức", href: "/tin-tuc" }, { label: category.name }]}
      eyebrow="Chuyên mục"
      title={category.name}
      description={`Tin tức thuộc chuyên mục ${category.name}.`}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-10)" }}>
        {page === 1 && featured && <FeaturedNewsCard article={featured} eyebrow="Mới nhất trong chuyên mục" />}

        {!featured ? (
          <EmptyState
            title="Chưa có bài viết trong chuyên mục này"
            description="Dữ liệu mẫu hiện chưa có bài viết nào gắn với chuyên mục này."
            action={{ label: "Xem tất cả tin tức", href: "/tin-tuc" }}
          />
        ) : (
          items.length > 0 && (
            <>
              <ArticleList articles={items} />
              <Pagination basePath={categoryHref(category.slug)} page={page} pageCount={pageCount} />
            </>
          )
        )}
      </div>
    </PageShell>
  );
}
