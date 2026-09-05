import type { Metadata } from "next";
import { requirePermission } from "@/server/auth/guard";
import { organizationRepository } from "@/server/repositories/organizationRepository";

export const metadata: Metadata = { title: "Đơn vị" };

export default async function AdminOrganizationsPage() {
  await requirePermission("organization.manage");
  const organizations = await organizationRepository.list();

  return (
    <>
      <div className="adminPageHead">
        <div>
          <h1 className="adminPageTitle">Đơn vị</h1>
          <p className="adminPageSubtitle">Hội Sinh viên cấp tỉnh/thành, trường và chi hội hải ngoại.</p>
        </div>
      </div>

      <div className="adminCard">
        {organizations.length === 0 ? (
          <div className="adminEmptyState">Chưa có đơn vị nào.</div>
        ) : (
          <table className="adminTable">
            <thead>
              <tr>
                <th>Tên</th>
                <th>Loại</th>
                <th>Địa phương</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {organizations.map((o) => (
                <tr key={o.id}>
                  <td>{o.name}</td>
                  <td className="adminHint">{o.type}</td>
                  <td className="adminHint">{o.province?.name ?? "—"}</td>
                  <td>
                    <span className={o.status === "ACTIVE" ? "adminBadge adminBadgeSuccess" : "adminBadge adminBadgeNeutral"}>{o.status}</span>
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
