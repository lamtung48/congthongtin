import Link from "next/link";

/**
 * Renders whenever `forbidden()` (`src/server/auth/guard.ts`) is called
 * anywhere under `/admin` — Next.js returns a real HTTP 403 for it. Brief
 * section 6: "Nếu đăng nhập nhưng không đủ quyền: → trả forbidden/
 * unauthorized page phù hợp."
 */
export default function AdminForbidden() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="adminCard adminCardPad" style={{ maxWidth: 420, textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--admin-danger)", marginBottom: 8 }}>
          403 — Không đủ quyền
        </div>
        <p style={{ color: "var(--admin-text-muted)", margin: "0 0 18px", fontSize: 13.5, lineHeight: 1.6 }}>
          Tài khoản của bạn không có quyền truy cập trang này. Liên hệ Admin nếu bạn cho rằng đây là nhầm lẫn.
        </p>
        <Link href="/admin/dashboard" className="adminButton adminButtonPrimary">
          Về Dashboard
        </Link>
      </div>
    </div>
  );
}
