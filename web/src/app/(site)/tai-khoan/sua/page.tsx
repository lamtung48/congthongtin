import Link from "next/link";
import type { Metadata } from "next";
import styles from "./edit.module.css";
import { ProfileForm, type ProfileFormUi } from "@/app/admin/_profile/ProfileForm";
import { requirePerson } from "@/server/auth/person";
import { getSessionToken } from "@/server/auth/session";
import { hsvIdProfileOptions, hsvIdSsoProfile } from "@/server/integrations/hsvId";
import { IconArrowLeft } from "@/components/icons";

export const metadata: Metadata = { title: "Sửa thông tin tài khoản", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const UI: ProfileFormUi = {
  field: styles.field,
  label: styles.label,
  input: styles.input,
  select: styles.input,
  hint: styles.hint,
  error: styles.error,
  badge: styles.badge,
  badgeSuccess: styles.badgeSuccess,
  badgeNeutral: styles.badgeNeutral,
  submit: styles.submit,
};

/** Edit the shared HSV-ID profile from the public site — same form + rules as the admin profile page (see ProfileForm). */
export default async function AccountEditPage() {
  await requirePerson("/tai-khoan/sua");
  const token = await getSessionToken();
  const [profile, options] = await Promise.all([token ? hsvIdSsoProfile(token) : null, hsvIdProfileOptions()]);

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <Link href="/tai-khoan" className={styles.back}>
          <IconArrowLeft size={16} />
          Tài khoản cá nhân
        </Link>
        <div className={styles.head}>
          <h1 className={styles.title}>Sửa thông tin tài khoản</h1>
          <p className={styles.sub}>Hồ sơ dùng chung HSV-ID — lưu ở đây là cập nhật cho Hoạt động, Đào tạo và mọi nền tảng của Hội.</p>
        </div>
        <div className={styles.card}>
          {profile?.ok && options ? (
            <ProfileForm profile={profile.profile} options={options} next="/tai-khoan" ui={UI} />
          ) : (
            <p className={styles.error} role="alert">
              {profile && !profile.ok ? profile.message : "Không tải được hồ sơ, vui lòng thử lại sau ít phút."}
            </p>
          )}
        </div>
        <p className={styles.foot}>Tài khoản đăng nhập (email/số điện thoại) cố định, không tự đổi được. Cần đổi mật khẩu: liên hệ Ban quản trị.</p>
      </div>
    </div>
  );
}
