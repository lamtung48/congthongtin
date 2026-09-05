import type { Metadata } from "next";
import { requireSession } from "@/server/auth/session";
import { ROLE_LABELS } from "@/server/auth/permissions";

export const metadata: Metadata = { title: "Hồ sơ cá nhân" };

export default async function AdminProfilePage() {
  const session = await requireSession();

  return (
    <>
      <div className="adminPageHead">
        <div>
          <h1 className="adminPageTitle">Hồ sơ cá nhân</h1>
          <p className="adminPageSubtitle">Thông tin tài khoản đang đăng nhập.</p>
        </div>
      </div>

      <div className="adminCard adminCardPad" style={{ maxWidth: 480 }}>
        <div className="adminField">
          <span className="adminLabel">Họ tên</span>
          <div>{session.displayName}</div>
        </div>
        <div className="adminField">
          <span className="adminLabel">Email</span>
          <div>{session.email}</div>
        </div>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <span className="adminLabel">Vai trò</span>
          <div>
            <span className="adminRoleBadge">{ROLE_LABELS[session.role]}</span>
          </div>
        </div>
      </div>
      <p className="adminHint" style={{ marginTop: 12 }}>
        Đổi mật khẩu và chỉnh sửa thông tin cá nhân nằm ngoài phạm vi tác vụ này — liên hệ Admin để đặt lại mật khẩu.
      </p>
    </>
  );
}
