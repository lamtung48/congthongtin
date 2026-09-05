import type { Metadata } from "next";
import { notFound, forbidden } from "next/navigation";
import { requireSession } from "@/server/auth/session";
import { articleService } from "@/server/services/articleService";
import { resolveArticleContent } from "@/server/content/articleContentResolver";
import { ArticleDetailView } from "@/components/article/ArticleDetailView";
import { categoryHref } from "@/lib/routes";

export const metadata: Metadata = { title: "Xem trước bài viết", robots: { index: false, follow: false } };

/**
 * Brief section 9: "Preview phải render bằng chính Article renderer
 * production. Không tạo một renderer riêng trong CMS gây khác giao diện
 * public." This route lives outside `/admin` (see `(preview)/layout.tsx`
 * for why) but is protected exactly the same way every `/admin` page is:
 * `requireSession()` first, then an article-specific permission check,
 * both re-checked here rather than inherited from a route-group layout —
 * there is no `/admin` layout above this route to inherit from, so the
 * check has to be explicit, same as it would be defense-in-depth anyway.
 * `articleService.canView` is the same ownership/permission check the edit
 * page uses, so a Contributor can preview their own drafts but not another
 * Contributor's.
 */
export default async function ArticlePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const article = await articleService.getById(id);
  if (!article) notFound();
  if (!articleService.canView(session, article)) forbidden();

  const resolved = await resolveArticleContent(article);

  return (
    <div style={{ maxWidth: "var(--container-wide)", margin: "0 auto", padding: "var(--sp-6) var(--gutter)" }}>
      <div
        style={{
          background: "var(--status-warning-soft)",
          color: "var(--amber-600)",
          border: "1px solid var(--amber-500)",
          borderRadius: "var(--radius-md, 8px)",
          padding: "10px 16px",
          marginBottom: "var(--sp-6)",
          fontFamily: "var(--font-ui)",
          fontSize: 13,
        }}
      >
        <strong>Đang xem trước</strong> — đây không phải trang public thật; nội dung dùng đúng giao diện renderer sản xuất.
      </div>
      <ArticleDetailView
        categoryName={article.category.name}
        categoryHref={categoryHref(article.category.slug)}
        title={article.title}
        lead={article.subtitle ?? undefined}
        author={resolved.author}
        publishedAt={(article.publishedAt ?? article.updatedAt).toISOString()}
        updatedAt={article.updatedAt.toISOString()}
        coverImage={resolved.coverImage}
        body={resolved.body}
        tags={resolved.tags}
        emptyBodyDescription="Bài viết chưa có nội dung — thêm khối nội dung ở trang chỉnh sửa để xem trước đầy đủ."
      />
    </div>
  );
}
