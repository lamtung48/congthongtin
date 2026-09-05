import type { Metadata } from "next";
import Link from "next/link";
import { requireAnyPermission } from "@/server/auth/guard";
import { platformService } from "@/server/services/platformService";
import { hasPermission } from "@/server/auth/permissions";
import { PLATFORM_CATEGORY_LABELS, PLATFORM_STATUS_LABELS, PLATFORM_INTEGRATION_TYPE_LABELS } from "@/lib/platformLabels";
import { setPlatformEnabledAction, deletePlatformAction } from "./actions";
import { RefreshActivityButton } from "./RefreshActivityButton";

export const metadata: Metadata = { title: "Nền tảng" };

/**
 * Ecosystem integration task, brief section 1: `/admin/platforms`. ADMIN
 * and MANAGER both reach this page (`requireAnyPermission` — a Contributor
 * gets a real 403, not a hidden nav link); which action buttons actually
 * render is further split by the exact permission each one needs
 * (`platform.manage` vs `platform.manage.display`), same "hide in UI, but
 * the real guard is server-side" discipline as every other admin page.
 */
export default async function AdminPlatformsPage() {
  const session = await requireAnyPermission(["platform.manage", "platform.manage.display"]);
  const platforms = await platformService.list();

  const canManageIntegration = hasPermission(session.role, "platform.manage");
  const canManageDisplay = hasPermission(session.role, "platform.manage.display");

  return (
    <>
      <div className="adminPageHead">
        <div>
          <h1 className="adminPageTitle">Nền tảng</h1>
          <p className="adminPageSubtitle">Đăng ký các nền tảng hệ sinh thái số: Hội nghị, Đào tạo, Sinh viên 5 tốt, Tình nguyện và các nền tảng khác.</p>
        </div>
        {canManageIntegration && (
          <Link href="/admin/platforms/new" className="adminButton adminButtonPrimary">
            + Nền tảng mới
          </Link>
        )}
      </div>

      <div className="adminCard">
        {platforms.length === 0 ? (
          <div className="adminEmptyState">Chưa có nền tảng nào.</div>
        ) : (
          <div className="adminTableWrap">
            <table className="adminTable">
              <thead>
                <tr>
                  <th>Tên</th>
                  <th>Danh mục</th>
                  <th>Trạng thái</th>
                  <th>Tích hợp</th>
                  <th>Hoạt động hiện tại</th>
                  <th>Hiển thị</th>
                  <th style={{ minWidth: 260 }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {platforms.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/admin/platforms/${p.id}/edit`} style={{ fontWeight: 600 }}>{p.name}</Link>
                      <div className="adminHint">{p.slug}</div>
                    </td>
                    <td className="adminHint">{PLATFORM_CATEGORY_LABELS[p.category]}</td>
                    <td><span className="adminBadge adminBadgeNeutral">{PLATFORM_STATUS_LABELS[p.status]}</span></td>
                    <td className="adminHint">{PLATFORM_INTEGRATION_TYPE_LABELS[p.integrationType]}</td>
                    <td className="adminHint">
                      {p.currentActivity || "—"}
                      {p.currentActivityUpdatedAt && (
                        <div className="adminHint">Làm mới lúc {p.currentActivityUpdatedAt.toLocaleString("vi-VN")}</div>
                      )}
                    </td>
                    <td>
                      <span className={p.isEnabled ? "adminBadge adminBadgeSuccess" : "adminBadge adminBadgeDanger"}>
                        {p.isEnabled ? "Đang hiển thị" : "Đã ẩn"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                        {canManageDisplay && (
                          <form action={setPlatformEnabledAction}>
                            <input type="hidden" name="platformId" value={p.id} />
                            <input type="hidden" name="isEnabled" value={(!p.isEnabled).toString()} />
                            <button type="submit" className={p.isEnabled ? "adminButton adminButtonSmall adminButtonDanger" : "adminButton adminButtonSmall"}>
                              {p.isEnabled ? "Ẩn" : "Hiện"}
                            </button>
                          </form>
                        )}
                        {canManageDisplay && p.integrationType === "API" && <RefreshActivityButton platformId={p.id} />}
                        {canManageIntegration && (
                          <form action={deletePlatformAction}>
                            <input type="hidden" name="platformId" value={p.id} />
                            <button type="submit" className="adminButton adminButtonSmall adminButtonDanger">Xoá</button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
