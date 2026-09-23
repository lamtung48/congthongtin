import { notFound } from "next/navigation";
import styles from "@/components/content/Listing.module.css";
import { PageHero } from "@/components/ui/PageHero";
import { EmptyState } from "@/components/ui/EmptyState";
import { LeadStoryCard } from "@/components/content/LeadStoryCard";
import { NewsCard } from "@/components/content/NewsCard";
import { Pagination } from "@/components/content/Pagination";
import { CategoryChips, ListingAside, countByCategory, wideFlags } from "@/components/content/ListingParts";
import { IconNews, IconTrophy } from "@/components/icons";
import { Sv5tIntro } from "./Sv5tIntro";
import { getAllArticles, getArticlesByCategory, getCategories, getCategoryBySlug, getTopics } from "@/services/contentService";
import { categoryHref } from "@/lib/routes";
import { paginate } from "@/lib/pagination";
import { formatDateVi } from "@/lib/formatDate";
import { PHONG_TRAO_SV5T_SLUG } from "@/lib/siteChrome";

/** 9 = with `wideFlags()` a full page is exactly four 3-column rows. */
export const CATEGORY_PAGE_SIZE = 9;

/** The category's most recent article is pulled out as the lead story
 *  (page 1 only); everything else is paginated. Shared by both the page
 *  itself and `generateStaticParams()`. */
async function getPool(slug: string) {
  const category = await getCategoryBySlug(slug);
  if (!category) return null;
  const articles = await getArticlesByCategory(slug);
  const [featured, ...rest] = articles;
  return { category, articles, featured: featured ?? null, rest };
}

export async function getCategoryPageCount(slug: string): Promise<number> {
  const data = await getPool(slug);
  if (!data) return 1;
  return Math.max(1, Math.ceil(data.rest.length / CATEGORY_PAGE_SIZE));
}

/** Backs both `/chuyen-muc/[slug]` (page 1) and
 *  `/chuyen-muc/[slug]/trang/[page]` (page 2+). The "Phong trào Sinh viên
 *  5 tốt" category is the campaign page of the site, so it gets the navy
 *  hero and the criteria intro (`Sv5tIntro`) on page 1. */
export async function CategoryPageView({ slug, page }: { slug: string; page: number }) {
  const [data, all, categories, topics] = await Promise.all([getPool(slug), getAllArticles(), getCategories(), getTopics()]);
  if (!data) notFound();
  const { category, articles, featured, rest } = data;

  const pageCount = Math.max(1, Math.ceil(rest.length / CATEGORY_PAGE_SIZE));
  if (!Number.isInteger(page) || page < 1 || page > pageCount) notFound();

  const { items } = paginate(rest, page, CATEGORY_PAGE_SIZE);
  const wide = wideFlags(items.length);
  const isSv5t = category.slug === PHONG_TRAO_SV5T_SLUG;
  const breadcrumb = [{ label: "Trang chủ", href: "/" }, { label: "Tin tức", href: "/tin-tuc" }, { label: category.name }];
  const stats = [
    { label: "Bài viết", value: articles.length.toLocaleString("vi-VN") },
    ...(featured ? [{ label: "Mới nhất", value: formatDateVi(featured.publishedAt) }] : []),
  ];

  return (
    <>
      {isSv5t ? (
        <PageHero
          tone="brand"
          breadcrumb={breadcrumb}
          eyebrow="Phong trào"
          icon={<IconTrophy size={13} />}
          title="Phong trào"
          mark="Sinh viên 5 tốt"
          description="Đạo đức tốt · Học tập tốt · Thể lực tốt · Tình nguyện tốt · Hội nhập tốt — danh hiệu dành cho những sinh viên muốn trở thành phiên bản tốt nhất của chính mình."
          stats={[{ label: "Tiêu chí", value: 5 }, { label: "Cấp xét chọn", value: 3 }, ...stats]}
        />
      ) : (
        <PageHero
          breadcrumb={breadcrumb}
          eyebrow="Chuyên mục"
          icon={<IconNews size={13} />}
          mark={category.name}
          description={`Tin tức, câu chuyện và hoạt động thuộc chuyên mục ${category.name}.`}
          stats={stats}
        />
      )}

      <div className={styles.wrap}>
        {isSv5t && page === 1 && <Sv5tIntro />}

        <CategoryChips categories={categories} counts={countByCategory(all)} total={all.length} activeSlug={category.slug} />

        {!featured ? (
          <EmptyState
            title="Chưa có bài viết trong chuyên mục này"
            description="Chưa có bài viết nào gắn với chuyên mục này."
            action={{ label: "Xem tất cả tin tức", href: "/tin-tuc" }}
          />
        ) : (
          <>
            {page === 1 && (
              <div className={styles.spotlight}>
                <LeadStoryCard article={featured} eyebrow={isSv5t ? "Tin mới nhất" : "Mới nhất trong chuyên mục"} />
                <ListingAside topics={topics} hideSv5t={isSv5t} />
              </div>
            )}

            {items.length > 0 && (
              <section className={styles.section} aria-labelledby="category-grid">
                <div className={styles.sectionHead}>
                  <h2 id="category-grid" className={styles.sectionTitle}>{isSv5t ? "Câu chuyện 5 tốt" : "Bài viết khác"}</h2>
                  {pageCount > 1 && <span className={styles.sectionMeta}>Trang {page} / {pageCount}</span>}
                </div>
                <div data-l="news-grid" className={styles.grid}>
                  {items.map((a, i) => (
                    <NewsCard key={a.slug} article={a} wide={wide[i]} />
                  ))}
                </div>
                <Pagination basePath={categoryHref(category.slug)} page={page} pageCount={pageCount} />
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}
