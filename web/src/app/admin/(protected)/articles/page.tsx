import type { Metadata } from "next";
import { requireSession } from "@/server/auth/session";
import { articleService } from "@/server/services/articleService";
import { taxonomyService } from "@/server/services/taxonomyService";
import { hasPermission } from "@/server/auth/permissions";
import { CreateArticleForm } from "./CreateArticleForm";
import {
  submitForReviewAction,
  approveAction,
  returnForRevisionAction,
  publishAction,
  scheduleAction,
  unpublishAction,
  deleteArticleAction,
} from "./actions";
import type { ArticleStatus } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Bài viết" };

const STATUS_LABELS: Record<ArticleStatus, string> = {
  DRAFT: "Nháp",
  IN_REVIEW: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  SCHEDULED: "Hẹn giờ",
  PUBLISHED: "Đã xuất bản",
  ARCHIVED: "Đã gỡ",
};

const STATUS_BADGE: Record<ArticleStatus, string> = {
  DRAFT: "adminBadgeNeutral",
  IN_REVIEW: "adminBadgeWarning",
  APPROVED: "adminBadgeWarning",
  SCHEDULED: "adminBadgeWarning",
  PUBLISHED: "adminBadgeSuccess",
  ARCHIVED: "adminBadgeDanger",
};

/**
 * Brief section 9's workflow, rendered as one shared list — which action
 * buttons a row shows depends on the article's current status *and* the
 * viewer's permissions (`hasPermission`), computed here for display only.
 * Every button posts to a Server Action in `./actions.ts` that re-checks
 * the same permission (plus ownership) independently — this file deciding
 * not to render a button is a convenience, not the actual guard.
 */
export default async function AdminArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const statusFilter = (Object.keys(STATUS_LABELS) as ArticleStatus[]).includes(params.status as ArticleStatus)
    ? (params.status as ArticleStatus)
    : undefined;

  const isContributor = session.role === "CONTRIBUTOR";
  const [articles, categories] = await Promise.all([
    articleService.listForAdmin({ status: statusFilter, createdById: isContributor ? session.id : undefined, take: 100 }),
    taxonomyService.listCategories(),
  ]);

  const canCreate = hasPermission(session.role, "article.create");
  const canApprove = hasPermission(session.role, "article.approve");
  const canReturn = hasPermission(session.role, "article.return");
  const canPublish = hasPermission(session.role, "article.publish");
  const canSchedule = hasPermission(session.role, "article.schedule");
  const canUnpublish = hasPermission(session.role, "article.unpublish");
  const canDelete = hasPermission(session.role, "article.delete");

  return (
    <>
      <div className="adminPageHead">
        <div>
          <h1 className="adminPageTitle">{isContributor ? "Bài viết của tôi" : "Bài viết"}</h1>
          <p className="adminPageSubtitle">
            {statusFilter ? `Lọc theo trạng thái: ${STATUS_LABELS[statusFilter]}.` : "Toàn bộ quy trình từ nháp đến xuất bản."}
          </p>
        </div>
      </div>

      {canCreate && <CreateArticleForm categories={categories.map((c) => ({ id: c.id, name: c.name }))} />}

      <div className="adminCard">
        {articles.length === 0 ? (
          <div className="adminEmptyState">Không có bài viết nào.</div>
        ) : (
          <table className="adminTable">
            <thead>
              <tr>
                <th>Tiêu đề</th>
                <th>Chuyên mục</th>
                <th>Trạng thái</th>
                <th>Cập nhật</th>
                <th style={{ minWidth: 260 }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((a) => {
                const isOwner = a.createdById === session.id;
                const canEditThis = hasPermission(session.role, "article.edit.any") || (hasPermission(session.role, "article.edit.own") && isOwner);
                return (
                  <tr key={a.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{a.title}</div>
                      {a.returnNote && (
                        <div className="adminHint" style={{ color: "var(--admin-danger)", marginTop: 2 }}>
                          Bị trả lại: {a.returnNote}
                        </div>
                      )}
                    </td>
                    <td>{a.category.name}</td>
                    <td>
                      <span className={`adminBadge ${STATUS_BADGE[a.status]}`}>{STATUS_LABELS[a.status]}</span>
                    </td>
                    <td className="adminHint">{a.updatedAt.toLocaleDateString("vi-VN")}</td>
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                        {a.status === "DRAFT" && canEditThis && (
                          <form action={submitForReviewAction}>
                            <input type="hidden" name="articleId" value={a.id} />
                            <button type="submit" className="adminButton adminButtonSmall">Gửi duyệt</button>
                          </form>
                        )}
                        {a.status === "IN_REVIEW" && canApprove && (
                          <form action={approveAction}>
                            <input type="hidden" name="articleId" value={a.id} />
                            <button type="submit" className="adminButton adminButtonSmall adminButtonPrimary">Duyệt</button>
                          </form>
                        )}
                        {(a.status === "IN_REVIEW" || a.status === "APPROVED") && canReturn && (
                          <form action={returnForRevisionAction} style={{ display: "flex", gap: 4 }}>
                            <input type="hidden" name="articleId" value={a.id} />
                            <input type="text" name="note" placeholder="Ghi chú trả lại…" className="adminInput" style={{ padding: "4px 8px", fontSize: 12, width: 140 }} />
                            <button type="submit" className="adminButton adminButtonSmall">Trả lại</button>
                          </form>
                        )}
                        {(a.status === "APPROVED" || a.status === "SCHEDULED") && canPublish && (
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
                        {a.status === "PUBLISHED" && canUnpublish && (
                          <form action={unpublishAction}>
                            <input type="hidden" name="articleId" value={a.id} />
                            <button type="submit" className="adminButton adminButtonSmall adminButtonDanger">Gỡ bài</button>
                          </form>
                        )}
                        {canDelete && !(session.role === "MANAGER" && a.status === "PUBLISHED") && (
                          <form action={deleteArticleAction}>
                            <input type="hidden" name="articleId" value={a.id} />
                            <button type="submit" className="adminButton adminButtonSmall adminButtonDanger">Xoá</button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
