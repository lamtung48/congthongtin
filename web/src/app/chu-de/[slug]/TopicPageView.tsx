import { notFound } from "next/navigation";
import styles from "./page.module.css";
import { PageShell } from "@/components/ui/PageShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewsCard } from "@/components/content/NewsCard";
import { Pagination } from "@/components/content/Pagination";
import { TagList } from "@/components/content/TagList";
import { getArticleBySlug, getArticlesByTopic, getTopicBySlug } from "@/services/contentService";
import { searchHref, topicHref } from "@/lib/routes";
import { paginate } from "@/lib/pagination";
import type { Tag } from "@/domain/taxonomy";

export const TOPIC_PAGE_SIZE = 8;

async function getPool(slug: string) {
  const topic = await getTopicBySlug(slug);
  if (!topic) return null;
  const articles = await getArticlesByTopic(slug);
  return { topic, articles };
}

export async function getTopicPageCount(slug: string): Promise<number> {
  const data = await getPool(slug);
  if (!data) return 1;
  return Math.max(1, Math.ceil(data.articles.length / TOPIC_PAGE_SIZE));
}

/** Backs both `/chu-de/[slug]` (page 1) and `/chu-de/[slug]/trang/[page]`
 *  (page 2+). Unlike `/chuyen-muc/[slug]`'s list-style `ArticleList`, this
 *  renders a `NewsCard` grid — deliberately different so the site doesn't
 *  read as the same grid repeated on every listing route. */
export async function TopicPageView({ slug, page }: { slug: string; page: number }) {
  const data = await getPool(slug);
  if (!data) notFound();
  const { topic, articles } = data;

  const pageCount = Math.max(1, Math.ceil(articles.length / TOPIC_PAGE_SIZE));
  if (!Number.isInteger(page) || page < 1 || page > pageCount) notFound();

  const { items } = paginate(articles, page, TOPIC_PAGE_SIZE);

  // "Related tags" — aggregated from the current page's articles. Most
  // topics have none yet (only a couple of fixture articles carry `tags`
  // at all) — see docs/LISTING_PAGES.md.
  const fullItems = await Promise.all(items.map((a) => getArticleBySlug(a.slug)));
  const tagMap = new Map<string, Tag>();
  for (const article of fullItems) {
    for (const tag of article?.tags ?? []) tagMap.set(tag.slug, tag);
  }
  const relatedTags = [...tagMap.values()];

  return (
    <PageShell
      breadcrumb={[{ label: "Trang chủ", href: "/" }, { label: "Chủ đề" }, { label: topic.name }]}
      eyebrow={`Chủ đề · ${topic.articleCount} bài viết`}
      title={topic.name}
      description={`Toàn bộ tin, bài liên quan tới chủ đề ${topic.name}.`}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-10)" }}>
        {items.length === 0 ? (
          <EmptyState
            title="Chưa có danh sách bài viết cho chủ đề này"
            description="Dữ liệu mẫu hiện chưa gắn bài viết cụ thể vào chủ đề này — trang này sẽ hiển thị danh sách thật khi chủ đề được liên kết với nội dung trong hệ thống quản trị."
            action={{ label: "Xem tất cả tin tức", href: "/tin-tuc" }}
          />
        ) : (
          <>
            <div data-l="news-grid" className={styles.grid}>
              {items.map((a, i) => (
                <NewsCard key={a.slug} article={a} wide={i % 4 === 0} />
              ))}
            </div>
            <Pagination basePath={topicHref(topic.slug)} page={page} pageCount={pageCount} />
          </>
        )}

        {relatedTags.length > 0 && (
          <section aria-label="Từ khoá liên quan" style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
            <h2 style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", margin: 0 }}>
              Từ khoá liên quan
            </h2>
            <TagList
              ariaLabel="Từ khoá liên quan"
              items={relatedTags.map((t) => ({ key: t.slug, href: searchHref(t.name), label: `#${t.name}` }))}
            />
          </section>
        )}
      </div>
    </PageShell>
  );
}
