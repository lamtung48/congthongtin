import type { Metadata } from "next";
import "./admin.css";

/**
 * A second root layout (`<html>`/`<body>` of its own), sibling to
 * `(site)/layout.tsx` — the standard Next.js "multiple root layouts"
 * pattern (`node_modules/next/dist/docs/.../route-groups.md`, "Use cases").
 * This is the only way to keep `/admin/*` from inheriting the public site's
 * `Header`/`Footer`/fonts/motion CSS: a nested layout can't opt out of an
 * ancestor root layout's shell, only a sibling top-level layout can. See
 * docs/AUTHENTICATION.md, "Why /admin needed a second root layout".
 *
 * No auth check here — this layout also wraps `/admin/login`, which must
 * render for a signed-out visitor. The actual guard lives one level down,
 * in `(protected)/layout.tsx`, which every route except `/admin/login`
 * sits under.
 */
export const metadata: Metadata = {
  title: { default: "Quản trị", template: "%s · Quản trị · Hội Sinh viên Việt Nam" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="admin-body">{children}</body>
    </html>
  );
}
