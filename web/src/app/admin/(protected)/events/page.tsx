import type { Metadata } from "next";
import { requirePermission } from "@/server/auth/guard";
import { eventService } from "@/server/services/eventService";

export const metadata: Metadata = { title: "Sự kiện" };

/** Read-only for now, same scope line as `/admin/organizations`. */
export default async function AdminEventsPage() {
  await requirePermission("event.manage");
  const events = await eventService.listAll();

  return (
    <>
      <div className="adminPageHead">
        <div>
          <h1 className="adminPageTitle">Sự kiện</h1>
          <p className="adminPageSubtitle">Trạng thái được tính lại theo thời gian thực, không phải giá trị lưu tĩnh.</p>
        </div>
      </div>

      <div className="adminCard">
        {events.length === 0 ? (
          <div className="adminEmptyState">Chưa có sự kiện nào.</div>
        ) : (
          <table className="adminTable">
            <thead>
              <tr>
                <th>Tên sự kiện</th>
                <th>Đơn vị</th>
                <th>Bắt đầu</th>
                <th>Kết thúc</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td>{e.title}</td>
                  <td className="adminHint">{e.organization.name}</td>
                  <td className="adminHint">{e.startAt.toLocaleString("vi-VN")}</td>
                  <td className="adminHint">{e.endAt.toLocaleString("vi-VN")}</td>
                  <td>
                    <span className={e.status === "LIVE" ? "adminBadge adminBadgeSuccess" : e.status === "CANCELLED" ? "adminBadge adminBadgeDanger" : "adminBadge adminBadgeNeutral"}>
                      {e.status}
                    </span>
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
