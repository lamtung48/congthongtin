import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/server/auth/session";
import { articleService } from "@/server/services/articleService";
import { userService } from "@/server/services/userService";
import { mediaService } from "@/server/services/mediaService";
import { eventService } from "@/server/services/eventService";
import { auditLogRepository } from "@/server/repositories/auditLogRepository";
import { ROLE_LABELS, hasPermission } from "@/server/auth/permissions";

/** "Media issues" — brief section 5: an asset the CMS knows about but whose
 *  file is gone/never arrived (`MediaStatus.MISSING`) is the one media
 *  state that needs a human to go fix something, unlike READY (fine) or
 *  REMOVED (already dealt with on purpose). */
function countMediaIssues() {
  return mediaService.count({ status: "MISSING" });
}

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Brief section 11: each role sees a different set of numbers, computed
 * from real data (not decorative placeholders) — and, just as important,
 * a role never sees a stat it has no permission to act on (e.g. a
 * Contributor's dashboard has no "tổng số tài khoản" card, because
 * `user.manage` isn't in its permission set).
 */
export default async function AdminDashboardPage() {
  const session = await requireSession();

  if (session.role === "ADMIN") {
    const [totalArticles, pendingReview, scheduled, published, userCount, mediaIssues, recentAudit] = await Promise.all([
      articleService.countByStatus(),
      articleService.countByStatus("IN_REVIEW"),
      articleService.countByStatus("SCHEDULED"),
      articleService.countByStatus("PUBLISHED"),
      userService.count({}),
      countMediaIssues(),
      auditLogRepository.listRecent(8),
    ]);
    return (
      <DashboardShell role={session.role}>
        <StatGrid
          stats={[
            { label: "Tổng số bài", value: totalArticles },
            { label: "Chờ duyệt", value: pendingReview },
            { label: "Đã lên lịch", value: scheduled },
            { label: "Đã xuất bản", value: published },
            { label: "Tài khoản", value: userCount },
            { label: "Media lỗi", value: mediaIssues },
          ]}
        />
        <RecentAudit
          items={recentAudit.map((a) => ({
            id: a.id,
            actor: a.actor?.displayName ?? "Hệ thống",
            action: a.action,
            entityType: a.entityType,
            createdAt: a.createdAt,
          }))}
        />
      </DashboardShell>
    );
  }

  if (session.role === "MANAGER") {
    const [pendingReview, returned, scheduled, publishedToday, mediaIssues, eventsToWatch] = await Promise.all([
      articleService.countByStatus("IN_REVIEW"),
      articleService.countForAdmin(session, { status: "DRAFT", hasReturnNote: true }),
      articleService.countByStatus("SCHEDULED"),
      articleService.countPublishedToday(),
      countMediaIssues(),
      eventService.countByStatus("UPCOMING"),
    ]);
    return (
      <DashboardShell role={session.role}>
        <StatGrid
          stats={[
            { label: "Bài chờ duyệt", value: pendingReview },
            { label: "Bài bị trả", value: returned },
            { label: "Bài đã lên lịch", value: scheduled },
            { label: "Xuất bản hôm nay", value: publishedToday },
          ]}
        />
        <div className="adminCard adminCardPad" style={{ marginTop: 16, display: "flex", gap: 24, flexWrap: "wrap" }}>
          <Link href="/admin/review" className="adminButton adminButtonPrimary">Vào hàng đợi duyệt bài</Link>
          <Link href="/admin/homepage" className="adminButton">Quản lý Homepage</Link>
          <span className="adminHint">Media lỗi cần xử lý: <strong>{mediaIssues}</strong> · Sự kiện sắp diễn ra: <strong>{eventsToWatch}</strong></span>
        </div>
      </DashboardShell>
    );
  }

  // CONTRIBUTOR. "Bị trả lại" is a subset of DRAFT that has a
  // `returnNote` set (`Article.returnNote` in schema.prisma) — there's no
  // dedicated status for it, so it's derived by filtering the DRAFT list
  // rather than a separate count query.
  const [drafts, inReview, published] = await Promise.all([
    articleService.listForAdmin(session, { status: "DRAFT" as const }),
    articleService.countByStatus("IN_REVIEW", session.id),
    articleService.countByStatus("PUBLISHED", session.id),
  ]);
  const returned = drafts.filter((r) => r.returnNote).length;

  return (
    <DashboardShell role={session.role}>
      <StatGrid
        stats={[
          { label: "Bài nháp của tôi", value: drafts.length },
          { label: "Đang chờ duyệt", value: inReview },
          { label: "Bị trả lại", value: returned },
          { label: "Đã xuất bản", value: published },
        ]}
      />
      {!hasPermission(session.role, "article.publish") && (
        <p className="adminHint">Bạn có thể soạn bài và gửi duyệt. Quản trị viên sẽ duyệt và xuất bản.</p>
      )}
    </DashboardShell>
  );
}

function DashboardShell({ role, children }: { role: "ADMIN" | "MANAGER" | "CONTRIBUTOR"; children: React.ReactNode }) {
  return (
    <>
      <div className="adminPageHead">
        <div>
          <h1 className="adminPageTitle">Dashboard</h1>
          <p className="adminPageSubtitle">Xin chào, vai trò hiện tại: {ROLE_LABELS[role]}.</p>
        </div>
      </div>
      {children}
    </>
  );
}

function StatGrid({ stats }: { stats: { label: string; value: number }[] }) {
  return (
    <div className="adminStatGrid">
      {stats.map((s) => (
        <div key={s.label} className="adminStat">
          <div className="adminStatValue">{s.value}</div>
          <div className="adminStatLabel">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

function RecentAudit({ items }: { items: { id: string; actor: string; action: string; entityType: string; createdAt: Date }[] }) {
  return (
    <div className="adminCard">
      <div className="adminCardPad" style={{ borderBottom: "1px solid var(--admin-border)" }}>
        <strong style={{ fontSize: 13.5 }}>Audit gần đây</strong>
      </div>
      {items.length === 0 ? (
        <div className="adminEmptyState">Chưa có hoạt động nào.</div>
      ) : (
        <table className="adminTable">
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Người thực hiện</th>
              <th>Hành động</th>
              <th>Đối tượng</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.createdAt.toLocaleString("vi-VN")}</td>
                <td>{item.actor}</td>
                <td>{item.action}</td>
                <td>{item.entityType}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
