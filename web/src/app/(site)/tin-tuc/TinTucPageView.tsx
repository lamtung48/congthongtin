import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "./page.module.css";
import { PageShell } from "@/components/ui/PageShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { FeaturedNewsCard } from "@/components/content/FeaturedNewsCard";
import { NewsCard } from "@/components/content/NewsCard";
import { Pagination } from "@/components/content/Pagination";
import { TrendingTopics } from "@/components/home/TrendingTopics";
import { getAllArticles, getCategories, getTopics } from "@/services/contentService";
import { getFeaturedArticles } from "@/services/homepageService";
import { categoryHref } from "@/lib/routes";
import { paginate } from "@/lib/pagination";

export const TIN_TUC_PAGE_SIZE = 9;

/** The featured article (item 3) never repeats in the grid below it, so the
 *  page pool is every article minus that one — shared by the page view and
 *  `generateStaticParams()` so they can't compute a different pool. */
async function getPool() {
  const [featured, all] = await Promise.all([getFeaturedArticles(), getAllArticles()]);
  return { featured, pool: all.filter((a) => a.slug !== featured.main.slug) };
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
  const [{ featured, pool }, categories, topics] = await Promise.all([
    getPool(),
    getCategories(),
    getTopics(),
  ]);

  const pageCount = Math.max(1, Math.ceil(pool.length / TIN_TUC_PAGE_SIZE));
  if (!Number.isInteger(page) || page < 1 || page > pageCount) notFound();

  const { items } = paginate(pool, page, TIN_TUC_PAGE_SIZE);

  return (
    <>
      <PageShell
        breadcrumb={[{ label: "Trang chủ", href: "/" }, { label: "Tin tức" }]}
        eyebrow="Cổng thông tin"
        title="Tin tức"
        description="Toàn bộ tin tức, phong trào và hoạt động của Hội Sinh viên Việt Nam."
      >
        <div className={styles.stack}>
          {page === 1 && <FeaturedNewsCard article={featured.main} eyebrow="Tin nổi bật" />}

          <nav aria-label="Chuyên mục" className={`hsvRail ${styles.categoryNav}`}>
            {categories.map((c) => (
              <Link key={c.slug} href={categoryHref(c.slug)} className={styles.categoryPill}>{c.name}</Link>
            ))}
          </nav>

          {items.length === 0 ? (
            <EmptyState title="Chưa có tin tức" description="Chưa có bài viết nào trong dữ liệu hiện có." />
          ) : (
            <>
              <div data-l="news-grid" className={styles.grid}>
                {items.map((a, i) => (
                  <NewsCard key={a.slug} article={a} wide={i % 5 === 0} />
                ))}
              </div>
              <Pagination basePath="/tin-tuc" page={page} pageCount={pageCount} />
            </>
          )}
        </div>
      </PageShell>

      {/* Sibling of `PageShell`, not nested inside it — `TrendingTopics` is
          a full-bleed homepage section (edge-to-edge background), which
          `PageShell`'s constrained `.wrap` would otherwise box in. */}
      {topics.length > 0 && <TrendingTopics topics={topics} />}
    </>
  );
}
