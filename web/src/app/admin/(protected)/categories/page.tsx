import type { Metadata } from "next";
import { requirePermission } from "@/server/auth/guard";
import { taxonomyService } from "@/server/services/taxonomyService";
import { CreateCategoryForm } from "./CreateCategoryForm";

export const metadata: Metadata = { title: "Chuyên mục" };

/**
 * Gated on `taxonomy.manage` — Manager and Admin only (Contributor's nav
 * link is already hidden by `(protected)/layout.tsx`, this is the real
 * guard). Minimal on purpose: create + list, no edit/delete/reorder — see
 * `taxonomyRepository.ts`'s header comment for why a fuller taxonomy CRUD
 * UI is out of this task's scope.
 */
export default async function AdminCategoriesPage() {
  await requirePermission("taxonomy.manage");
  const categories = await taxonomyService.listCategories();

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
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td className="adminHint">{c.slug}</td>
                  <td className="adminHint">{c.description ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
