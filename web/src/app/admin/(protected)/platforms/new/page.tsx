import type { Metadata } from "next";
import { requirePermission } from "@/server/auth/guard";
import { PLATFORM_CATEGORY_LABELS, PLATFORM_STATUS_LABELS, PLATFORM_INTEGRATION_TYPE_LABELS } from "@/lib/platformLabels";
import { createPlatformAction } from "../actions";

export const metadata: Metadata = { title: "Nền tảng mới" };

/**
 * Brief section 1: "ADMIN: toàn quyền" — creating a new registry row is
 * ADMIN-only (`platform.manage`), unlike editing an existing one's display
 * fields, which MANAGER can also do. The remaining display fields
 * (icon/CTA label/current activity/order) can be filled in afterwards on
 * the edit page — this form only asks for what a new `Platform` row
 * actually requires (brief section 2's non-optional fields).
 */
export default async function NewPlatformPage() {
  await requirePermission("platform.manage");

  return (
    <>
      <div className="adminPageHead">
        <div>
          <h1 className="adminPageTitle">Nền tảng mới</h1>
          <p className="adminPageSubtitle">Đăng ký một nền tảng mới vào hệ sinh thái số.</p>
        </div>
      </div>

      <form action={createPlatformAction} className="adminCard adminCardPad" style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="name">Tên nền tảng</label>
          <input id="name" name="name" type="text" required className="adminInput" />
        </div>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="slug">Slug</label>
          <input id="slug" name="slug" type="text" required pattern="[a-z0-9\-]+" placeholder="vd: hoi-nghi" className="adminInput" />
        </div>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="description">Mô tả</label>
          <textarea id="description" name="description" required rows={2} className="adminInput" />
        </div>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="url">Đường dẫn (URL)</label>
          <input id="url" name="url" type="text" required placeholder="https://…" className="adminInput" />
        </div>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="accessLevel">Yêu cầu truy cập</label>
          <input id="accessLevel" name="accessLevel" type="text" required placeholder="vd: Cần đăng nhập sinh viên" className="adminInput" />
        </div>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="category">Danh mục</label>
          <select id="category" name="category" required className="adminSelect">
            {Object.entries(PLATFORM_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="status">Trạng thái</label>
          <select id="status" name="status" required className="adminSelect">
            {Object.entries(PLATFORM_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="integrationType">Loại tích hợp</label>
          <select id="integrationType" name="integrationType" defaultValue="EXTERNAL_LINK" className="adminSelect">
            {Object.entries(PLATFORM_INTEGRATION_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <p className="adminHint">Icon, CTA, hoạt động hiện tại và thứ tự hiển thị có thể chỉnh sau khi tạo.</p>
        <button type="submit" className="adminButton adminButtonPrimary">Tạo nền tảng</button>
      </form>
    </>
  );
}
