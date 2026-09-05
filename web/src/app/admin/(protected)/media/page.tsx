import type { Metadata } from "next";
import { requireSession } from "@/server/auth/session";
import { hasPermission } from "@/server/auth/permissions";
import { mediaService } from "@/server/services/mediaService";

export const metadata: Metadata = { title: "Media" };

/**
 * Contributor only holds `media.manage.own` (brief section 2: "Upload/chọn
 * media trong phạm vi được cho phép"), so their list is scoped to assets
 * they created; Manager/Admin hold `media.manage.any` and see everything.
 * Read-only for now — a real upload pipeline is out of this task's scope
 * (see `mediaService.ts`'s header comment).
 */
export default async function AdminMediaPage() {
  const session = await requireSession();
  const canViewAny = hasPermission(session.role, "media.manage.any");
  const createdById = canViewAny ? undefined : session.id;

  const assets = await mediaService.list({ createdById, take: 100 });

  return (
    <>
      <div className="adminPageHead">
        <div>
          <h1 className="adminPageTitle">Media</h1>
          <p className="adminPageSubtitle">
            {canViewAny ? "Toàn bộ tệp media trong hệ thống." : "Media do bạn tải lên."}
          </p>
        </div>
      </div>

      <div className="adminCard">
        {assets.length === 0 ? (
          <div className="adminEmptyState">Chưa có media nào.</div>
        ) : (
          <table className="adminTable">
            <thead>
              <tr>
                <th>Tên tệp</th>
                <th>Loại</th>
                <th>Nguồn</th>
                <th>Trạng thái</th>
                <th>Ngày tạo</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((m) => (
                <tr key={m.id}>
                  <td>{m.filename ?? m.caption ?? m.id}</td>
                  <td className="adminHint">{m.type}</td>
                  <td className="adminHint">{m.provider}</td>
                  <td>
                    <span className={m.status === "READY" ? "adminBadge adminBadgeSuccess" : "adminBadge adminBadgeNeutral"}>{m.status}</span>
                  </td>
                  <td className="adminHint">{m.createdAt.toLocaleDateString("vi-VN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
