import { requireSession } from "@/server/auth/session";
import { hasPermission } from "@/server/auth/permissions";
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

  const nav = [
    { href: "/admin/dashboard", label: "Dashboard", show: true },
    { href: "/admin/articles", label: session.role === "CONTRIBUTOR" ? "Bài viết của tôi" : "Bài viết", show: true },
    { href: "/admin/articles?status=IN_REVIEW", label: "Duyệt bài", show: hasPermission(session.role, "article.approve") },
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
    { href: "/admin/categories", label: "Chuyên mục", show: hasPermission(session.role, "taxonomy.manage") },
    { href: "/admin/topics", label: "Chủ đề", show: hasPermission(session.role, "taxonomy.manage") },
    { href: "/admin/tags", label: "Tag", show: hasPermission(session.role, "taxonomy.manage") },
    { href: "/admin/organizations", label: "Đơn vị", show: hasPermission(session.role, "organization.manage") },
    { href: "/admin/events", label: "Sự kiện", show: hasPermission(session.role, "event.manage") },
    { href: "/admin/homepage", label: "Homepage", show: hasPermission(session.role, "homepage.manage") },
    { href: "/admin/users", label: "Users", show: hasPermission(session.role, "user.manage") },
    { href: "/admin/profile", label: "Hồ sơ cá nhân", show: true },
  ].filter((item) => item.show);

  return (
    <AdminShell session={session} nav={nav}>
      {children}
    </AdminShell>
  );
}
