import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/server/auth/guard";
import { articleService } from "@/server/services/articleService";
import { auditLogRepository } from "@/server/repositories/auditLogRepository";
import { hasPermission } from "@/server/auth/permissions";
import { approveAction, returnForRevisionAction, publishAction, scheduleAction } from "../articles/actions";

export const metadata: Metadata = { title: "Duyệt bài" };

/**
 * Review Queue — editorial workflow task, brief section 6: its own route,
 * "Chỉ ADMIN, MANAGER được truy cập" (enforced here via `requirePermission`,
 * the same server-side guard every other admin-only page uses — a
 * Contributor hitting this URL directly gets a real 403, not just a hidden
 * nav link). Distinct from `/admin/articles` (every status, every role,
 * full filter set): this page shows only the two statuses a
 * Manager/Admin actually needs to act on right now — IN_REVIEW (awaiting
 * Approve/Return) and APPROVED (awaiting Publish/Schedule) — oldest first,
 * so nothing sits forgotten at the bottom of a "Tất cả bài" list sorted by
 * last update.
 *
 * Actions reuse the exact same Server Actions as `/admin/articles`
 * (`../articles/actions`) — one workflow implementation, a second entry
 * point, not a parallel copy that could drift.
 */
export default async function ReviewQueuePage() {
  const session = await requirePermission("article.approve");

  const articles = await articleService.listForAdmin(session, {
    statusIn: ["IN_REVIEW", "APPROVED"],
    sortBy: "updatedAt",
    sortDir: "asc",
  });

  const submittedAtByArticle = await auditLogRepository.findLatestActionDates(
    "SUBMIT_REVIEW",
    "Article",
    articles.map((a) => a.id),
  );

  const canSchedule = hasPermission(session.role, "article.schedule");
  const canPublish = hasPermission(session.role, "article.publish");

  return (
    <>
      <div className="adminPageHead">
        <div>
          <h1 className="adminPageTitle">Duyệt bài</h1>
          <p className="adminPageSubtitle">Bài đang chờ duyệt hoặc chờ xuất bản — cũ nhất lên trước.</p>
        </div>
      </div>

      <div className="adminCard">
        {articles.length === 0 ? (
          <div className="adminEmptyState">Không có bài nào cần xử lý. Hàng đợi trống.</div>
        ) : (
          <div className="adminTableWrap">
            <table className="adminTable">
              <thead>
                <tr>
                  <th>Tiêu đề</th>
                  <th>Cộng tác viên</th>
                  <th>Chuyên mục</th>
                  <th>Đơn vị</th>
                  <th>Ngày gửi duyệt</th>
                  <th style={{ minWidth: 320 }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((a) => {
                  const submittedAt = submittedAtByArticle.get(a.id);
                  return (
                    <tr key={a.id}>
                      <td>
                        <Link href={`/admin/articles/${a.id}/edit`} style={{ fontWeight: 600 }}>{a.title}</Link>
                        <div className="adminHint" style={{ marginTop: 2 }}>
                          {a.status === "IN_REVIEW" ? "Chờ duyệt" : "Đã duyệt — chờ xuất bản"}
                        </div>
                      </td>
                      <td className="adminHint">{a.createdBy?.displayName ?? a.author?.displayName ?? "—"}</td>
                      <td className="adminHint">{a.category.name}</td>
                      <td className="adminHint">{a.organization?.name ?? "—"}</td>
                      <td className="adminHint">{submittedAt ? submittedAt.toLocaleString("vi-VN") : "—"}</td>
                      <td>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                          <Link href={`/preview/articles/${a.id}`} target="_blank" className="adminButton adminButtonSmall">Xem trước ↗</Link>
                          {a.status === "IN_REVIEW" && (
                            <form action={approveAction}>
                              <input type="hidden" name="articleId" value={a.id} />
                              <button type="submit" className="adminButton adminButtonSmall adminButtonPrimary">Duyệt</button>
                            </form>
                          )}
                          <form action={returnForRevisionAction} style={{ display: "flex", gap: 4 }}>
                            <input type="hidden" name="articleId" value={a.id} />
                            <input type="text" name="note" required placeholder="Ghi chú trả lại…" className="adminInput" style={{ padding: "4px 8px", fontSize: 12, width: 150 }} />
                            <button type="submit" className="adminButton adminButtonSmall">Trả lại</button>
                          </form>
                          {a.status === "APPROVED" && canPublish && (
                            <form action={publishAction}>
                              <input type="hidden" name="articleId" value={a.id} />
                              <button type="submit" className="adminButton adminButtonSmall adminButtonPrimary">Xuất bản</button>
                            </form>
                          )}
                          {a.status === "APPROVED" && canSchedule && (
                            <form action={scheduleAction} style={{ display: "flex", gap: 4 }}>
                              <input type="hidden" name="articleId" value={a.id} />
                              <input type="datetime-local" name="scheduledAt" required className="adminInput" style={{ padding: "4px 8px", fontSize: 12 }} />
                              <button type="submit" className="adminButton adminButtonSmall">Hẹn giờ</button>
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
