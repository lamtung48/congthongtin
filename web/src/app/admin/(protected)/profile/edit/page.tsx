import Link from "next/link";
import type { Metadata } from "next";
import { getSessionToken, requireSession } from "@/server/auth/session";
import { hsvIdProfileOptions, hsvIdSsoProfile } from "@/server/integrations/hsvId";
import { ProfileForm } from "../../../_profile/ProfileForm";

export const metadata: Metadata = { title: "Sửa hồ sơ" };
export const dynamic = "force-dynamic";

export default async function AdminProfileEditPage() {
  await requireSession();
  const token = await getSessionToken();
  const [profile, options] = await Promise.all([token ? hsvIdSsoProfile(token) : null, hsvIdProfileOptions()]);

  return (
    <>
      <div className="adminPageHead">
        <div>
          <h1 className="adminPageTitle">Sửa hồ sơ</h1>
          <p className="adminPageSubtitle">Hồ sơ dùng chung — thay đổi có hiệu lực ở mọi nền tảng Hội Sinh viên.</p>
        </div>
        <Link href="/admin/profile" className="adminButton adminButtonSmall">
          Quay lại
        </Link>
      </div>
      <div className="adminCard adminCardPad" style={{ maxWidth: 520 }}>
        {profile?.ok && options ? (
          <ProfileForm profile={profile.profile} options={options} next="/admin/profile" />
        ) : (
          <p className="adminErrorText" role="alert">
            {profile && !profile.ok ? profile.message : "Không tải được hồ sơ, vui lòng thử lại sau ít phút."}
          </p>
        )}
      </div>
    </>
  );
}
