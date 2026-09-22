import type { Metadata } from "next";
import { requirePermission } from "@/server/auth/guard";
import { taxonomyService } from "@/server/services/taxonomyService";
import { CreateTagForm } from "./CreateTagForm";
import { DeleteTaxonomyButton } from "../DeleteTaxonomyButton";
import { deleteTagAction } from "./actions";

export const metadata: Metadata = { title: "Tag" };

export default async function AdminTagsPage() {
  await requirePermission("taxonomy.manage");
  const tags = await taxonomyService.listTagsWithUsage();

  return (
    <>
      <div className="adminPageHead">
        <div>
          <h1 className="adminPageTitle">Tag</h1>
          <p className="adminPageSubtitle">Từ khoá tự do gắn cho bài viết, không có trang riêng.</p>
        </div>
      </div>

      <CreateTagForm />

      <div className="adminCard">
        {tags.length === 0 ? (
          <div className="adminEmptyState">Chưa có tag nào.</div>
        ) : (
          <table className="adminTable">
            <thead>
              <tr>
                <th>Tên</th>
                <th>Slug</th>
                <th>Bài viết</th>
                <th style={{ width: 120 }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {tags.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td className="adminHint">{t.slug}</td>
                  <td className="adminHint">{t._count.articles}</td>
                  <td>
                    <DeleteTaxonomyButton
                      id={t.id}
                      action={deleteTagAction}
                      confirmMessage={
                        t._count.articles > 0
                          ? `Xoá tag "${t.name}"? ${t._count.articles} bài viết sẽ bị gỡ tag này (bài viết vẫn còn nguyên).`
                          : `Xoá tag "${t.name}"?`
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
