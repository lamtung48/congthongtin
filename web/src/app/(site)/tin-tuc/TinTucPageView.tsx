import { notFound } from "next/navigation";
import styles from "@/components/content/Listing.module.css";
import { PageHero } from "@/components/ui/PageHero";
import { EmptyState } from "@/components/ui/EmptyState";
import { LeadStoryCard } from "@/components/content/LeadStoryCard";
import { NewsCard } from "@/components/content/NewsCard";
import { Pagination } from "@/components/content/Pagination";
import { CategoryChips, ListingAside, countByCategory, wideFlags } from "@/components/content/ListingParts";
import { IconNews } from "@/components/icons";
import { getAllArticles, getCategories, getTopics } from "@/services/contentService";
import { getFeaturedArticles } from "@/services/homepageService";
import { paginate } from "@/lib/pagination";
import { formatDateVi } from "@/lib/formatDate";

export const TIN_TUC_PAGE_SIZE = 9;

/** The featured article (item 3) never repeats in the grid below it, so the
 *  page pool is every article minus that one — shared by the page view and
 *  `generateStaticParams()` so they can't compute a different pool. */
async function getPool() {
  const [featured, all] = await Promise.all([getFeaturedArticles(), getAllArticles()]);
  return { featured, all, pool: all.filter((a) => a.slug !== featured.main.slug) };
}

export async function getTinTucPageCount(): Promise<number> {
  const { pool } = await getPool();
  return Math.max(1, Math.ceil(pool.length / TIN_TUC_PAGE_SIZE));
}

/** Backs both `/tin-tuc` (page 1) and `/tin-tuc/trang/[page]` (page 2+) —
 *  one implementation so the two routes can't drift apart. `notFound()`s on
 *  an out-of-range page instead of silently clamping, since only page 1 is
 *  allowed to be requested "loosely" (it's never out of range). */
export async function TinTucPageView({ page }: { page: number }) {
  const [{ featured, all, pool }, categories, topics] = await Promise.all([
    getPool(),
    getCategories(),
    getTopics(),
  ]);

  const pageCount = Math.max(1, Math.ceil(pool.length / TIN_TUC_PAGE_SIZE));
  if (!Number.isInteger(page) || page < 1 || page > pageCount) notFound();

  const { items } = paginate(pool, page, TIN_TUC_PAGE_SIZE);
  const wide = wideFlags(items.length);
  const latest = all.reduce<string | undefined>((max, a) => (!max || a.publishedAt > max ? a.publishedAt : max), undefined);

  return (
    <>
      <PageHero
        breadcrumb={[{ label: "Trang chủ", href: "/" }, { label: "Tin tức" }]}
        eyebrow="Cổng thông tin"
        icon={<IconNews size={13} />}
        title="Tin tức"
        mark="sinh viên"
        description="Chuyện sinh viên nóng hổi mỗi ngày — tin tức, phong trào và hoạt động của Hội Sinh viên Việt Nam, từ Trung ương tới từng chi hội."
        stats={[
          { label: "Bài viết", value: all.length.toLocaleString("vi-VN") },
          { label: "Chuyên mục", value: categories.length },
          ...(latest ? [{ label: "Cập nhật", value: formatDateVi(latest) }] : []),
        ]}
      />

      <div className={styles.wrap}>
        <CategoryChips categories={categories} counts={countByCategory(all)} total={all.length} />

        {page === 1 && (
          <div className={styles.spotlight}>
            <LeadStoryCard article={featured.main} eyebrow="Nổi bật" />
            <ListingAside topics={topics} />
          </div>
        )}

        <section className={styles.section} aria-labelledby="tin-tuc-grid">
          <div className={styles.sectionHead}>
            <h2 id="tin-tuc-grid" className={styles.sectionTitle}>{page === 1 ? "Mới cập nhật" : "Tin tức"}</h2>
            {pageCount > 1 && <span className={styles.sectionMeta}>Trang {page} / {pageCount}</span>}
          </div>
          {items.length === 0 ? (
            <EmptyState title="Chưa có tin tức" description="Chưa có bài viết nào trong dữ liệu hiện có." />
          ) : (
            <>
              <div data-l="news-grid" className={styles.grid}>
                {items.map((a, i) => (
                  <NewsCard key={a.slug} article={a} wide={wide[i]} />
                ))}
              </div>
              <Pagination basePath="/tin-tuc" page={page} pageCount={pageCount} />
            </>
          )}
        </section>
      </div>
    </>
  );
}
