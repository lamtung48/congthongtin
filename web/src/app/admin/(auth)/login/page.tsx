import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/server/auth/session";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Đăng nhập" };

/**
 * The one `/admin/*` route not behind `(protected)/layout.tsx`'s guard —
 * it has to render for a signed-out visitor. Still does its own check: an
 * already-logged-in visitor who navigates back here is sent straight to
 * the dashboard instead of seeing a login form again.
 */
export default async function AdminLoginPage() {
  const session = await getSession();
  if (session) {
    redirect("/admin/dashboard");
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="adminCard adminCardPad" style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Cổng thông tin số Hội Sinh viên Việt Nam</div>
          <div style={{ color: "var(--admin-text-muted)", fontSize: 13, marginTop: 2 }}>Đăng nhập khu vực quản trị</div>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
