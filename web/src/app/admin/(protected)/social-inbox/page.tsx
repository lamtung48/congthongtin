import type { Metadata } from "next";
import Link from "next/link";
import { requireAnyPermission } from "@/server/auth/guard";
import { socialInboxService } from "@/server/services/socialInboxService";
import { taxonomyService } from "@/server/services/taxonomyService";
import { userRepository } from "@/server/repositories/userRepository";
import { hasPermission } from "@/server/auth/permissions";
import { SOURCE_TYPE_LABELS, EXTERNAL_ITEM_STATUS_LABELS } from "@/lib/sourceLabels";
import { ignoreExternalItemAction, assignExternalItemAction, convertExternalItemAction, createManualItemAction } from "./actions";
import type { ExternalItemStatus } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Social Inbox" };

const STATUS_BADGE: Record<ExternalItemStatus, string> = {
  PENDING_REVIEW: "adminBadgeWarning",
  ASSIGNED: "adminBadgeWarning",
  CONVERTED: "adminBadgeSuccess",
  IGNORED: "adminBadgeNeutral",
};

interface TabDef {
  key: string;
  label: string;
  statusIn: ExternalItemStatus[];
}

const TABS: TabDef[] = [
  { key: "active", label: "Đang chờ xử lý", statusIn: ["PENDING_REVIEW", "ASSIGNED"] },
  { key: "converted", label: "Đã chuyển bài", statusIn: ["CONVERTED"] },
  { key: "ignored", label: "Đã bỏ qua", statusIn: ["IGNORED"] },
];

/**
 * Social/External Content Collector task, brief section 5:
 * `/admin/social-inbox`. `socialInboxService.listForActor` already scopes
 * a CONTRIBUTOR to only items assigned to them — this page renders
 * whatever it returns without re-checking, and shows a different action
 * set per role: ADMIN/MANAGER get Ignore/Assign/Convert on every row +
 * the manual-add form; CONTRIBUTOR only gets Convert, and only ever sees
 * rows already assigned to them (so a "Convert" button here never needs
 * its own extra ownership check in the JSX — `listForActor`'s scoping
 * already guarantees it).
 */
export default async function SocialInboxPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await requireAnyPermission(["social_inbox.manage", "social_inbox.convert_own"]);
  const params = await searchParams;
  const canManage = hasPermission(session.role, "social_inbox.manage");

  const activeTab = TABS.find((t) => t.key === params.tab) ?? TABS[0];
  const items = await socialInboxService.listForActor(session, { statusIn: activeTab.statusIn });

  const [categories, contributors] = await Promise.all([
    taxonomyService.listCategories(),
    canManage ? userRepository.listActiveByRoles(["CONTRIBUTOR"]) : Promise.resolve([]),
  ]);

  return (
    <>
      <div className="adminPageHead">
        <div>
          <h1 className="adminPageTitle">Social Inbox</h1>
          <p className="adminPageSubtitle">
            {canManage
              ? "Nội dung thu thập từ các nguồn — bỏ qua, giao cho Cộng tác viên, hoặc chuyển thành bài viết."
              : "Nội dung được giao cho bạn — biên tập lại rồi gửi duyệt như một bài viết bình thường."}
          </p>
        </div>
      </div>

      <nav className="adminTabs">
        {TABS.map((tab) => (
          <Link key={tab.key} href={`/admin/social-inbox${tab.key === TABS[0].key ? "" : `?tab=${tab.key}`}`} className={tab.key === activeTab.key ? "adminTab adminTabActive" : "adminTab"}>
            {tab.label}
          </Link>
        ))}
      </nav>

      {canManage && (
        <details className="adminCard adminCardPad" style={{ marginBottom: 16 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 13.5 }}>+ Thêm thủ công</summary>
          <form action={createManualItemAction} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12, maxWidth: 520 }}>
            <div className="adminField" style={{ marginBottom: 0 }}>
              <label className="adminLabel" htmlFor="manual-url">Đường dẫn</label>
              <input id="manual-url" name="url" type="text" required placeholder="https://…" className="adminInput" />
            </div>
            <div className="adminField" style={{ marginBottom: 0 }}>
              <label className="adminLabel" htmlFor="manual-title">Tiêu đề (tuỳ chọn)</label>
              <input id="manual-title" name="title" type="text" className="adminInput" />
            </div>
            <div className="adminField" style={{ marginBottom: 0 }}>
              <label className="adminLabel" htmlFor="manual-content">Nội dung</label>
              <textarea id="manual-content" name="contentText" required rows={3} className="adminInput" />
            </div>
            <button type="submit" className="adminButton adminButtonPrimary" style={{ alignSelf: "flex-start" }}>Thêm vào Inbox</button>
          </form>
        </details>
      )}

      <div className="adminCard">
        {items.length === 0 ? (
          <div className="adminEmptyState">Không có nội dung nào.</div>
        ) : (
          <div className="adminTableWrap">
            <table className="adminTable">
              <thead>
                <tr>
                  <th>Nội dung</th>
                  <th>Nguồn</th>
                  <th>Hashtag</th>
                  <th>Ngày đăng</th>
                  <th>Trạng thái</th>
                  <th>Giao cho</th>
                  {(canManage || hasPermission(session.role, "social_inbox.convert_own")) && <th style={{ minWidth: 300 }}>Hành động</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const canConvertThis =
                    canManage || (hasPermission(session.role, "social_inbox.convert_own") && item.status === "ASSIGNED" && item.assignedToId === session.id);
                  return (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.title ?? item.contentText.slice(0, 60)}</div>
                        <div className="adminHint" style={{ maxWidth: 360 }}>{item.excerpt ?? item.contentText.slice(0, 160)}</div>
                        <a href={item.url} target="_blank" rel="noreferrer" className="adminHint">Xem nguồn ↗</a>
                      </td>
                      <td className="adminHint">{item.source.name} <br /> {SOURCE_TYPE_LABELS[item.source.type]}</td>
                      <td className="adminHint">{item.hashtags.length > 0 ? item.hashtags.map((h) => `#${h}`).join(" ") : "—"}</td>
                      <td className="adminHint">{item.publishedAt ? item.publishedAt.toLocaleDateString("vi-VN") : "—"}</td>
                      <td><span className={`adminBadge ${STATUS_BADGE[item.status]}`}>{EXTERNAL_ITEM_STATUS_LABELS[item.status]}</span></td>
                      <td className="adminHint">{item.assignedTo?.displayName ?? "—"}</td>
                      <td>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "flex-start" }}>
                          {canManage && (item.status === "PENDING_REVIEW" || item.status === "ASSIGNED") && (
                            <form action={ignoreExternalItemAction}>
                              <input type="hidden" name="itemId" value={item.id} />
                              <button type="submit" className="adminButton adminButtonSmall">Bỏ qua</button>
                            </form>
                          )}
                          {canManage && (item.status === "PENDING_REVIEW" || item.status === "ASSIGNED") && (
                            <form action={assignExternalItemAction} style={{ display: "flex", gap: 4 }}>
                              <input type="hidden" name="itemId" value={item.id} />
                              <select name="contributorId" required defaultValue="" className="adminSelect" style={{ padding: "4px 8px", fontSize: 12 }}>
                                <option value="" disabled>Giao cho…</option>
                                {contributors.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}
                              </select>
                              <button type="submit" className="adminButton adminButtonSmall">Giao</button>
                            </form>
                          )}
                          {canConvertThis && (
                            <form action={convertExternalItemAction} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <input type="hidden" name="itemId" value={item.id} />
                              <select name="categoryId" required defaultValue={item.source.categoryId ?? ""} className="adminSelect" style={{ padding: "4px 8px", fontSize: 12 }}>
                                <option value="" disabled>Chọn chuyên mục…</option>
                                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                              <button type="submit" className="adminButton adminButtonSmall adminButtonPrimary">Chuyển thành bài</button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
