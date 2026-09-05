import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/server/auth/guard";
import { platformService } from "@/server/services/platformService";
import { mediaService } from "@/server/services/mediaService";
import { hasPermission } from "@/server/auth/permissions";
import { PLATFORM_CATEGORY_LABELS, PLATFORM_STATUS_LABELS, PLATFORM_INTEGRATION_TYPE_LABELS } from "@/lib/platformLabels";
import { updateDisplayAction, updateIntegrationAction } from "../../actions";
import { RefreshActivityButton } from "../../RefreshActivityButton";

export const metadata: Metadata = { title: "Chỉnh sửa nền tảng" };

/**
 * Two independent forms, matching `platformService.update`'s two field
 * groups exactly: "Nội dung/hiển thị" (ADMIN + MANAGER) always renders;
 * "Tích hợp kỹ thuật" (ADMIN only, brief section 1 "toàn quyền") renders
 * read-only for a MANAGER instead of just being hidden — so a Manager can
 * still see (not just guess) what `apiBaseUrl`/`integrationType` a
 * platform is wired to, without being able to change it. Server-side
 * enforcement is `platformService.update` itself; this page's role checks
 * only decide which form controls to render.
 */
export default async function EditPlatformPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAnyPermission(["platform.manage", "platform.manage.display"]);
  const { id } = await params;
  const platform = await platformService.getById(id);
  if (!platform) notFound();

  const canManageIntegration = hasPermission(session.role, "platform.manage");
  const canManageDisplay = hasPermission(session.role, "platform.manage.display");

  const mediaRows = await mediaService.listForAdmin(session, { type: "IMAGE", take: 200 });

  return (
    <>
      <div className="adminPageHead">
        <div>
          <h1 className="adminPageTitle">{platform.name}</h1>
          <p className="adminPageSubtitle">{platform.slug}</p>
        </div>
      </div>

      <div className="adminCard adminCardPad" style={{ maxWidth: 640, marginBottom: 16 }}>
        <h2 className="adminLabel" style={{ marginBottom: 12, fontSize: 13 }}>Nội dung / hiển thị</h2>
        <form action={updateDisplayAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <input type="hidden" name="platformId" value={platform.id} />
          <fieldset disabled={!canManageDisplay} style={{ border: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="adminField" style={{ marginBottom: 0 }}>
              <label className="adminLabel" htmlFor="name">Tên nền tảng</label>
              <input id="name" name="name" type="text" required defaultValue={platform.name} className="adminInput" />
            </div>
            <div className="adminField" style={{ marginBottom: 0 }}>
              <label className="adminLabel" htmlFor="description">Mô tả</label>
              <textarea id="description" name="description" required rows={2} defaultValue={platform.description} className="adminInput" />
            </div>
            <div className="adminField" style={{ marginBottom: 0 }}>
              <label className="adminLabel" htmlFor="url">Đường dẫn (URL)</label>
              <input id="url" name="url" type="text" required defaultValue={platform.url} className="adminInput" />
            </div>
            <div className="adminField" style={{ marginBottom: 0 }}>
              <label className="adminLabel" htmlFor="accessLevel">Yêu cầu truy cập</label>
              <input id="accessLevel" name="accessLevel" type="text" required defaultValue={platform.accessLevel} className="adminInput" />
            </div>
            <div className="adminField" style={{ marginBottom: 0 }}>
              <label className="adminLabel" htmlFor="metric">Chỉ số hiển thị (tuỳ chọn)</label>
              <input id="metric" name="metric" type="text" defaultValue={platform.metric ?? ""} placeholder="vd: 14 khoá đang mở" className="adminInput" />
            </div>
            <div className="adminField" style={{ marginBottom: 0 }}>
              <label className="adminLabel" htmlFor="currentActivity">Hoạt động hiện tại (tuỳ chọn)</label>
              <input id="currentActivity" name="currentActivity" type="text" defaultValue={platform.currentActivity ?? ""} className="adminInput" />
              {platform.currentActivityUpdatedAt && (
                <p className="adminHint">Lần làm mới gần nhất: {platform.currentActivityUpdatedAt.toLocaleString("vi-VN")}</p>
              )}
            </div>
            <div className="adminField" style={{ marginBottom: 0 }}>
              <label className="adminLabel" htmlFor="ctaLabel">Nhãn nút CTA (tuỳ chọn, để trống dùng mặc định)</label>
              <input id="ctaLabel" name="ctaLabel" type="text" defaultValue={platform.ctaLabel ?? ""} className="adminInput" />
            </div>
            <div className="adminField" style={{ marginBottom: 0 }}>
              <label className="adminLabel" htmlFor="iconMediaId">Icon (tuỳ chọn)</label>
              <select id="iconMediaId" name="iconMediaId" defaultValue={platform.iconMediaId ?? ""} className="adminSelect">
                <option value="">— Dùng icon mặc định theo danh mục —</option>
                {mediaRows.map((m) => (
                  <option key={m.id} value={m.id}>{m.alt || m.caption || m.filename || m.id}</option>
                ))}
              </select>
            </div>
            <div className="adminField" style={{ marginBottom: 0 }}>
              <label className="adminLabel" htmlFor="status">Trạng thái</label>
              <select id="status" name="status" defaultValue={platform.status} className="adminSelect">
                {Object.entries(PLATFORM_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="adminField" style={{ marginBottom: 0 }}>
              <label className="adminLabel" htmlFor="order">Thứ tự hiển thị</label>
              <input id="order" name="order" type="number" defaultValue={platform.order} className="adminInput" style={{ maxWidth: 120 }} />
            </div>
            {canManageDisplay && <button type="submit" className="adminButton adminButtonPrimary" style={{ alignSelf: "flex-start" }}>Lưu nội dung/hiển thị</button>}
          </fieldset>
        </form>
        {platform.integrationType === "API" && canManageDisplay && (
          <div style={{ marginTop: 12 }}>
            <RefreshActivityButton platformId={platform.id} />
          </div>
        )}
      </div>

      <div className="adminCard adminCardPad" style={{ maxWidth: 640 }}>
        <h2 className="adminLabel" style={{ marginBottom: 4, fontSize: 13 }}>Tích hợp kỹ thuật</h2>
        <p className="adminHint" style={{ marginTop: 0, marginBottom: 12 }}>
          {canManageIntegration ? "Chỉ Admin chỉnh được mục này." : "Chỉ Admin mới có quyền chỉnh sửa — bạn chỉ có thể xem."}
        </p>
        <form action={updateIntegrationAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <input type="hidden" name="platformId" value={platform.id} />
          <fieldset disabled={!canManageIntegration} style={{ border: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="adminField" style={{ marginBottom: 0 }}>
              <label className="adminLabel" htmlFor="category">Danh mục</label>
              <select id="category" name="category" defaultValue={platform.category} className="adminSelect">
                {Object.entries(PLATFORM_CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="adminField" style={{ marginBottom: 0 }}>
              <label className="adminLabel" htmlFor="integrationType">Loại tích hợp</label>
              <select id="integrationType" name="integrationType" defaultValue={platform.integrationType} className="adminSelect">
                {Object.entries(PLATFORM_INTEGRATION_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <p className="adminHint">Chỉ nền tảng &ldquo;Tích hợp API&rdquo; mới gọi được &ldquo;Làm mới trạng thái&rdquo;. Không có nền tảng nào được nhúng iframe.</p>
            </div>
            <div className="adminField" style={{ marginBottom: 0 }}>
              <label className="adminLabel" htmlFor="apiBaseUrl">API base URL (chỉ dùng khi Loại tích hợp = API)</label>
              <input id="apiBaseUrl" name="apiBaseUrl" type="text" defaultValue={platform.apiBaseUrl ?? ""} placeholder="https://api.vidu.vn/hoi-nghi" className="adminInput" />
            </div>
            {canManageIntegration && <button type="submit" className="adminButton" style={{ alignSelf: "flex-start" }}>Lưu tích hợp</button>}
          </fieldset>
        </form>
      </div>
    </>
  );
}
