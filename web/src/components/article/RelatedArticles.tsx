import { ArticleList } from "@/components/content/ArticleList";
import { EmptyState } from "@/components/ui/EmptyState";
import type { ArticleSummary } from "@/domain/article";

/** Item 12 of the article detail layout. `articles` is already scoped and
 *  empty-checked by the caller — this only decides what to render for that
 *  result, including the empty-state error case explicitly called out in
 *  the task brief. */
export function RelatedArticles({ articles }: { articles: ArticleSummary[] }) {
  return (
    <section aria-label="Bài viết liên quan" style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
      <h2 style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", margin: 0 }}>
        Bài viết liên quan
      </h2>
      {articles.length === 0 ? (
        <EmptyState
          title="Chưa có bài viết liên quan"
          description="Hiện chưa có bài viết khác cùng chuyên mục trong dữ liệu mẫu."
          action={{ label: "Xem tất cả tin tức", href: "/tin-tuc" }}
        />
      ) : (
        <ArticleList articles={articles} />
      )}
    </section>
  );
}
