import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/server/auth/guard";
import { taxonomyService } from "@/server/services/taxonomyService";
import { NewArticleForm } from "./NewArticleForm";

export const metadata: Metadata = { title: "Bài viết mới" };

export default async function NewArticlePage() {
  await requirePermission("article.create");
  const categories = await taxonomyService.listCategories();

  return (
    <>
      <div className="adminPageHead">
        <div>
          <h1 className="adminPageTitle">Bài viết mới</h1>
          <p className="adminPageSubtitle">Tạo bản nháp để bắt đầu soạn nội dung.</p>
        </div>
        <Link href="/admin/articles" className="adminButton adminButtonSmall">← Quay lại danh sách</Link>
      </div>

      {categories.length === 0 ? (
        <div className="adminCard adminEmptyState">Chưa có chuyên mục nào — hãy tạo chuyên mục trước tại /admin/categories.</div>
      ) : (
        <NewArticleForm categories={categories.map((c) => ({ id: c.id, name: c.name }))} />
      )}
    </>
  );
}
