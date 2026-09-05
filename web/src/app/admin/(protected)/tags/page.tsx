import type { Metadata } from "next";
import { requirePermission } from "@/server/auth/guard";
import { taxonomyService } from "@/server/services/taxonomyService";
import { CreateTagForm } from "./CreateTagForm";

export const metadata: Metadata = { title: "Tag" };

export default async function AdminTagsPage() {
  await requirePermission("taxonomy.manage");
  const tags = await taxonomyService.listTags();

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
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 4 }}>
            {tags.map((t) => (
              <span key={t.id} className="adminBadge adminBadgeNeutral">{t.name}</span>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
