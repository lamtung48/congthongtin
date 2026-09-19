import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionToken, requireSession } from "@/server/auth/session";
import { hsvIdProfileOptions, hsvIdSsoProfile } from "@/server/integrations/hsvId";
import { ProfileForm } from "../../_profile/ProfileForm";
import { logoutAction } from "../../(protected)/actions";

export const metadata: Metadata = { title: "Hoàn thiện hồ sơ" };
export const dynamic = "force-dynamic";

/**
 * First-sign-in gate of the ecosystem standard: an account whose shared
 * profile is incomplete (name, birth date, gender, phone, locality, unit,
 * subject type) fills it in here before entering the admin area. Sits
 * outside `(protected)` on purpose — the protected layout is what redirects
 * here, so it cannot also be behind it.
 */
export default async function CompleteProfilePage() {
  await requireSession();
  const token = await getSessionToken();
  const [profile, options] = await Promise.all([token ? hsvIdSsoProfile(token) : null, hsvIdProfileOptions()]);

  if (profile?.ok && profile.profile.completeness.complete) redirect("/admin/dashboard");

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="adminCard adminCardPad" style={{ width: "100%", maxWidth: 480 }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Hoàn thiện hồ sơ</div>
          <div style={{ color: "var(--admin-text-muted)", fontSize: 13, marginTop: 2 }}>
            Hồ sơ dùng chung của hệ sinh thái Hội Sinh viên — khai một lần, dùng ở mọi nền tảng.
          </div>
        </div>
        {profile?.ok && options ? (
          <ProfileForm profile={profile.profile} options={options} isEdit={false} next="/admin/dashboard" />
        ) : (
          <p className="adminErrorText" role="alert">
            {profile && !profile.ok ? profile.message : "Không tải được danh mục hồ sơ, vui lòng thử lại sau ít phút."}
          </p>
        )}
        <form action={logoutAction} style={{ marginTop: 16, textAlign: "center" }}>
          <button type="submit" className="adminButton adminButtonSmall">
            Đăng xuất
          </button>
        </form>
      </div>
    </div>
  );
}
