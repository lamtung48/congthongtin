import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/server/auth/session";
import { notificationService } from "@/server/services/notificationService";
import { markNotificationReadAction, markAllNotificationsReadAction } from "./actions";
import type { NotificationType } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Thông báo" };

const TYPE_LABELS: Record<NotificationType, string> = {
  ARTICLE_SUBMITTED: "Gửi duyệt",
  ARTICLE_RETURNED: "Trả lại",
  ARTICLE_APPROVED: "Đã duyệt",
  ARTICLE_PUBLISHED: "Xuất bản",
};

/** Every current `NotificationType` points at an `Article` — this maps
 *  `entityType` to the one admin route that can render it, the same
 *  `canView`-gated edit page every recipient (Manager/Admin about someone
 *  else's article, or the Contributor about their own) is already allowed
 *  to open. A future non-Article notification type just adds a case here. */
function entityHref(entityType: string, entityId: string): string | null {
  if (entityType === "Article") return `/admin/articles/${entityId}/edit`;
  return null;
}

/**
 * Notification Center — brief section 10: unread/read, entity link, time.
 * Brief section 12 applies here too: every notification row is scoped to
 * `session.id` by `notificationService.listForUser` itself, not filtered
 * client-side — there is no "view anyone's notifications" capability for
 * any role.
 */
export default async function NotificationsPage() {
  const session = await requireSession();
  const notifications = await notificationService.listForUser(session, { take: 100 });
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <>
      <div className="adminPageHead">
        <div>
          <h1 className="adminPageTitle">Thông báo</h1>
          <p className="adminPageSubtitle">
            {unreadCount > 0 ? `${unreadCount} thông báo chưa đọc.` : "Không có thông báo mới."}
          </p>
        </div>
        {unreadCount > 0 && (
          <form action={markAllNotificationsReadAction}>
            <button type="submit" className="adminButton">Đánh dấu tất cả đã đọc</button>
          </form>
        )}
      </div>

      <div className="adminCard">
        {notifications.length === 0 ? (
          <div className="adminEmptyState">Bạn chưa có thông báo nào.</div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {notifications.map((n) => {
              const href = entityHref(n.entityType, n.entityId);
              return (
                <li
                  key={n.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "12px 16px",
                    borderBottom: "1px solid var(--admin-border)",
                    background: n.isRead ? "transparent" : "var(--admin-accent-soft, rgba(37,99,235,0.06))",
                  }}
                >
                  <div>
                    <span className="adminHint" style={{ textTransform: "uppercase", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>
                      {TYPE_LABELS[n.type]}
                    </span>
                    <p style={{ margin: "4px 0", fontSize: 13.5 }}>
                      {href ? <Link href={href}>{n.message}</Link> : n.message}
                    </p>
                    <span className="adminHint">{n.createdAt.toLocaleString("vi-VN")}</span>
                  </div>
                  {!n.isRead && (
                    <form action={markNotificationReadAction}>
                      <input type="hidden" name="notificationId" value={n.id} />
                      <button type="submit" className="adminButton adminButtonSmall">Đã đọc</button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
