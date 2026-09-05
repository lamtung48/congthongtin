import type { Metadata } from "next";
import Link from "next/link";
import { requireAnyPermission } from "@/server/auth/guard";
import { sourceService } from "@/server/services/sourceService";
import { hasPermission } from "@/server/auth/permissions";
import { SOURCE_TYPE_LABELS, SOURCE_STATUS_LABELS } from "@/lib/sourceLabels";
import { setSourceEnabledAction, deleteSourceAction } from "./actions";
import { SyncSourceButton } from "./SyncSourceButton";

export const metadata: Metadata = { title: "Nguồn" };

const STATUS_BADGE = {
  ACTIVE: "adminBadgeSuccess",
  DISABLED: "adminBadgeNeutral",
  ERROR: "adminBadgeDanger",
} as const;

/**
 * Social/External Content Collector task, brief section 3: `/admin/sources`.
 * ADMIN (`source.manage`) sees every action button; MANAGER (`source.view`
 * only) sees the same list read-only — no Sync/Enable/Edit/Delete
 * controls at all, matching brief section 1's "MANAGER: xem source"
 * (view, not manage). CONTRIBUTOR never reaches this page —
 * `requireAnyPermission` returns a real 403.
 */
export default async function AdminSourcesPage() {
  const session = await requireAnyPermission(["source.manage", "source.view"]);
  const sources = await sourceService.list(session);
  const canManage = hasPermission(session.role, "source.manage");

  return (
    <>
      <div className="adminPageHead">
        <div>
          <h1 className="adminPageTitle">Nguồn</h1>
          <p className="adminPageSubtitle">Facebook Page, RSS/Atom, Website, kênh YouTube — nội dung thu thập sẽ vào Social Inbox để duyệt.</p>
        </div>
        {canManage && (
          <Link href="/admin/sources/new" className="adminButton adminButtonPrimary">
            + Nguồn mới
          </Link>
        )}
      </div>

      <div className="adminCard">
        {sources.length === 0 ? (
          <div className="adminEmptyState">Chưa có nguồn nào.</div>
        ) : (
          <div className="adminTableWrap">
            <table className="adminTable">
              <thead>
                <tr>
                  <th>Tên</th>
                  <th>Loại</th>
                  <th>Trạng thái</th>
                  <th>Hiển thị</th>
                  <th>Đồng bộ gần nhất</th>
                  <th>Lỗi gần nhất</th>
                  {canManage && <th style={{ minWidth: 260 }}>Hành động</th>}
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.id}>
                    <td>
                      {canManage && s.type !== "MANUAL_EXTERNAL" ? (
                        <Link href={`/admin/sources/${s.id}/edit`} style={{ fontWeight: 600 }}>{s.name}</Link>
                      ) : (
                        <strong>{s.name}</strong>
                      )}
                      {s.externalUrl && <div className="adminHint">{s.externalUrl}</div>}
                    </td>
                    <td className="adminHint">{SOURCE_TYPE_LABELS[s.type]}</td>
                    <td><span className={`adminBadge ${STATUS_BADGE[s.status]}`}>{SOURCE_STATUS_LABELS[s.status]}</span></td>
                    <td>
                      <span className={s.isEnabled ? "adminBadge adminBadgeSuccess" : "adminBadge adminBadgeNeutral"}>
                        {s.isEnabled ? "Đang bật" : "Đã tắt"}
                      </span>
                    </td>
                    <td className="adminHint">
                      {s.lastSyncedAt ? `${s.lastSyncedAt.toLocaleString("vi-VN")} (${s.lastSyncItemCount ?? 0} mục mới)` : "Chưa đồng bộ"}
                    </td>
                    <td className="adminHint" style={{ color: s.lastError ? "var(--admin-danger)" : undefined }}>
                      {s.lastError ?? "—"}
                    </td>
                    {canManage && (
                      <td>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                          {s.type !== "MANUAL_EXTERNAL" && <SyncSourceButton sourceId={s.id} />}
                          {s.type !== "MANUAL_EXTERNAL" && (
                            <form action={setSourceEnabledAction}>
                              <input type="hidden" name="sourceId" value={s.id} />
                              <input type="hidden" name="isEnabled" value={(!s.isEnabled).toString()} />
                              <button type="submit" className={s.isEnabled ? "adminButton adminButtonSmall adminButtonDanger" : "adminButton adminButtonSmall"}>
                                {s.isEnabled ? "Tắt" : "Bật"}
                              </button>
                            </form>
                          )}
                          {s.type !== "MANUAL_EXTERNAL" && (
                            <form action={deleteSourceAction}>
                              <input type="hidden" name="sourceId" value={s.id} />
                              <button type="submit" className="adminButton adminButtonSmall adminButtonDanger">Xoá</button>
                            </form>
                          )}
                        </div>
                      </td>
                    )}
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
