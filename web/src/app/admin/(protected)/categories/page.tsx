import type { Metadata } from "next";
import { requirePermission } from "@/server/auth/guard";
import { taxonomyService } from "@/server/services/taxonomyService";
import { CreateCategoryForm } from "./CreateCategoryForm";
import { DeleteTaxonomyButton } from "../DeleteTaxonomyButton";
import { deleteCategoryAction } from "./actions";

export const metadata: Metadata = { title: "Chuyên mục" };

/**
 * Gated on `taxonomy.manage` — Manager and Admin only (Contributor's nav
 * link is already hidden by `(protected)/layout.tsx`, this is the real
 * guard). Create, list and delete; editing and reordering are still not
 * here. The usage column is not decoration: `Article.categoryId` and
 * `Video.categoryId` are required columns, so a category in use cannot be
 * deleted at all, and the count is what tells an editor how much work
 * clearing it would be.
 */
export default async function AdminCategoriesPage() {
  await requirePermission("taxonomy.manage");
  const categories = await taxonomyService.listCategoriesWithUsage();

  return (
    <>
      <div className="adminPageHead">
        <div>
          <h1 className="adminPageTitle">Chuyên mục</h1>
          <p className="adminPageSubtitle">Danh mục nội dung dùng để phân loại bài viết.</p>
        </div>
      </div>

      <CreateCategoryForm />

      <div className="adminCard">
        {categories.length === 0 ? (
          <div className="adminEmptyState">Chưa có chuyên mục nào.</div>
        ) : (
          <table className="adminTable">
            <thead>
              <tr>
                <th>Tên</th>
                <th>Slug</th>
                <th>Mô tả</th>
                <th>Đang dùng</th>
                <th style={{ width: 120 }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => {
                const used = c._count.articles + c._count.videos + c._count.sources + c._count.activityStatistics;
                return (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td className="adminHint">{c.slug}</td>
                    <td className="adminHint">{c.description ?? "—"}</td>
                    <td className="adminHint">
                      {used === 0
                        ? "Chưa dùng"
                        : [
                            c._count.articles > 0 ? `${c._count.articles} bài` : null,
                            c._count.videos > 0 ? `${c._count.videos} video` : null,
                            c._count.sources > 0 ? `${c._count.sources} nguồn` : null,
                            c._count.activityStatistics > 0 ? `${c._count.activityStatistics} số liệu` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                    </td>
                    <td>
                      <DeleteTaxonomyButton
                        id={c.id}
                        action={deleteCategoryAction}
                        confirmMessage={`Xoá chuyên mục "${c.name}"?`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
