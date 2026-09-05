"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROLE_LABELS } from "@/server/auth/permissions";
import type { SessionUser } from "@/server/auth/session";
import { logoutAction } from "./actions";

/**
 * Brief section 14: "Phải hiển thị role hiện tại ở user menu/profile" —
 * the topbar's role badge — with the exact three display labels
 * (`ROLE_LABELS`, section 1). The sidebar nav was already filtered by
 * permission one level up (`(protected)/layout.tsx`); this component only
 * decides which of *those* items is visually "active", a presentation
 * concern that doesn't belong in the server-side guard logic.
 */
export function AdminShell({
  session,
  nav,
  children,
}: {
  session: SessionUser;
  nav: { href: string; label: string }[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="adminShell">
      <aside className="adminSidebar">
        <div className="adminSidebarBrand">Quản trị CMS</div>
        <nav className="adminNav">
          {nav.map((item) => {
            const basePath = item.href.split("?")[0];
            const active = pathname === basePath;
            return (
              <Link key={item.href} href={item.href} className={active ? "adminNavLink adminNavLinkActive" : "adminNavLink"}>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="adminMain">
        <header className="adminTopbar">
          <div className="adminUserMenu">
            <span>{session.displayName}</span>
            <span className="adminRoleBadge">{ROLE_LABELS[session.role]}</span>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="adminLogoutButton">
              Đăng xuất
            </button>
          </form>
        </header>
        <main className="adminContent">{children}</main>
      </div>
    </div>
  );
}
