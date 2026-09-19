import { redirect } from "next/navigation";
import { getProfileCompleteness, requireSession } from "@/server/auth/session";
import { hasPermission } from "@/server/auth/permissions";
import { notificationService } from "@/server/services/notificationService";
import { AdminShell } from "./AdminShell";

/**
 * Every route under `/admin` except `/admin/login` sits inside this route
 * group. Brief section 6: "Toàn bộ /admin/* ... phải được bảo vệ server-
 * side ... Không render dữ liệu admin rồi mới redirect client-side" —
 * `requireSession()` runs before any child page's own data fetching even
 * starts, so an unauthenticated request never reaches a page component,
 * let alone renders one.
 *
 * This is the *first* check, not the *only* one: pages/Server Actions that
 * need a specific permission (not just "logged in") call
 * `requirePermission()`/`requireRole()` themselves too — see
 * docs/AUTHORIZATION.md, "Route guard" for why defense-in-depth here is
 * deliberate, not redundant.
 */
export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  // Ecosystem standard: an incomplete shared profile is filled in first (UX gate, not a security boundary — the role checks below are).
  const completeness = await getProfileCompleteness();
  if (completeness && !completeness.complete) redirect("/admin/hoan-thanh-ho-so");
  const unreadCount = await notificationService.countUnread(session);

  const nav = [
    { href: "/admin/dashboard", label: "Dashboard", show: true },
    { href: "/admin/articles", label: session.role === "CONTRIBUTOR" ? "Bài viết của tôi" : "Bài viết", show: true },
    { href: "/admin/review", label: "Duyệt bài", show: hasPermission(session.role, "article.approve") },
    {
      href: "/admin/media",
      label: "Media",
      show: hasPermission(session.role, "media.manage.own") || hasPermission(session.role, "media.manage.any"),
    },
    {
      href: "/admin/media/videos",
      label: "Video",
      show: hasPermission(session.role, "media.manage.own") || hasPermission(session.role, "media.manage.any"),
    },
    { href: "/admin/media/galleries", label: "Thư viện ảnh", show: hasPermission(session.role, "gallery.manage") },
    { href: "/admin/documents", label: "Tài liệu", show: hasPermission(session.role, "document.manage") },
    { href: "/admin/categories", label: "Chuyên mục", show: hasPermission(session.role, "taxonomy.manage") },
    { href: "/admin/topics", label: "Chủ đề", show: hasPermission(session.role, "taxonomy.manage") },
    { href: "/admin/tags", label: "Tag", show: hasPermission(session.role, "taxonomy.manage") },
    { href: "/admin/organizations", label: "Đơn vị", show: hasPermission(session.role, "organization.manage") },
    { href: "/admin/events", label: "Sự kiện", show: hasPermission(session.role, "event.manage") },
    { href: "/admin/homepage", label: "Homepage", show: hasPermission(session.role, "homepage.manage") },
    { href: "/admin/appearance", label: "Giao diện", show: hasPermission(session.role, "system.configure") },
    {
      href: "/admin/platforms",
      label: "Nền tảng",
      show: hasPermission(session.role, "platform.manage") || hasPermission(session.role, "platform.manage.display"),
    },
    { href: "/admin/sources", label: "Nguồn", show: hasPermission(session.role, "source.manage") || hasPermission(session.role, "source.view") },
    {
      href: "/admin/social-inbox",
      label: "Social Inbox",
      show: hasPermission(session.role, "social_inbox.manage") || hasPermission(session.role, "social_inbox.convert_own"),
    },
    { href: "/admin/users", label: "Users", show: hasPermission(session.role, "user.manage") },
    { href: "/admin/notifications", label: unreadCount > 0 ? `Thông báo (${unreadCount})` : "Thông báo", show: true },
    { href: "/admin/profile", label: "Hồ sơ cá nhân", show: true },
  ].filter((item) => item.show);

  return (
    <AdminShell session={session} nav={nav}>
      {children}
    </AdminShell>
  );
}
