import type { Metadata } from "next";
import { requirePermission } from "@/server/auth/guard";
import { taxonomyService } from "@/server/services/taxonomyService";
import { CreateTopicForm } from "./CreateTopicForm";
import { DeleteTaxonomyButton } from "../DeleteTaxonomyButton";
import { deleteTopicAction } from "./actions";

export const metadata: Metadata = { title: "Chủ đề" };

export default async function AdminTopicsPage() {
  await requirePermission("taxonomy.manage");
  const topics = await taxonomyService.listTopicsWithUsage();

  return (
    <>
      <div className="adminPageHead">
        <div>
          <h1 className="adminPageTitle">Chủ đề</h1>
          <p className="adminPageSubtitle">Chủ đề biên tập có trang riêng, gom nhiều bài viết liên quan.</p>
        </div>
      </div>

      <CreateTopicForm />

      <div className="adminCard">
        {topics.length === 0 ? (
          <div className="adminEmptyState">Chưa có chủ đề nào.</div>
        ) : (
          <table className="adminTable">
            <thead>
              <tr>
                <th>Tên</th>
                <th>Slug</th>
                <th>Mô tả</th>
                <th>Bài viết</th>
                <th style={{ width: 120 }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {topics.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td className="adminHint">{t.slug}</td>
                  <td className="adminHint">{t.description ?? "—"}</td>
                  <td className="adminHint">{t._count.articles}</td>
                  <td>
                    <DeleteTaxonomyButton
                      id={t.id}
                      action={deleteTopicAction}
                      confirmMessage={
                        t._count.articles > 0
                          ? `Xoá chủ đề "${t.name}"? ${t._count.articles} bài viết sẽ bị gỡ khỏi chủ đề này (bài viết vẫn còn nguyên).`
                          : `Xoá chủ đề "${t.name}"?`
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
