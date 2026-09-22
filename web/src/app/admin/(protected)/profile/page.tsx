import Link from "next/link";
import type { Metadata } from "next";
import { getSessionToken, requireSession } from "@/server/auth/session";
import { ROLE_LABELS } from "@/server/auth/permissions";
import { hsvIdSsoProfile, type HsvPositionLevel, type HsvProfilePositionSlot } from "@/server/integrations/hsvId";

export const metadata: Metadata = { title: "Hồ sơ cá nhân" };
export const dynamic = "force-dynamic";

const GENDER_LABELS = { MALE: "Nam", FEMALE: "Nữ", OTHER: "Khác" } as const;
const SUBJECT_LABELS = { STUDENT: "Sinh viên", STAFF: "Cán bộ, giảng viên" } as const;
const LEVELS: { level: HsvPositionLevel; label: string }[] = [
  { level: "TRUNG_UONG", label: "Chức vụ cấp Trung ương" },
  { level: "TINH", label: "Chức vụ cấp Tỉnh" },
  { level: "TRUONG", label: "Chức vụ cấp Trường" },
];

function PositionValue({ slot }: { slot: HsvProfilePositionSlot }) {
  if (!slot.current && !slot.pending && !slot.rejected) return <span style={{ color: "var(--admin-text-muted)" }}>Không giữ chức vụ</span>;
  return (
    <div style={{ display: "grid", gap: 4 }}>
      {slot.current && (
        <div>
          {slot.current.position} — {slot.current.organization.name} <span className="adminBadge adminBadgeSuccess">Đã duyệt</span>
        </div>
      )}
      {slot.pending && (
        <div>
          {slot.pending.position} — {slot.pending.organization.name} <span className="adminBadge adminBadgeWarning">Chờ duyệt</span>
        </div>
      )}
      {slot.rejected && (
        <div>
          {slot.rejected.position} <span className="adminBadge adminBadgeDanger">Chưa được duyệt</span>
          {slot.rejected.message && <div className="adminHint">{slot.rejected.message}</div>}
        </div>
      )}
    </div>
  );
}

export default async function AdminProfilePage() {
  const session = await requireSession();
  const token = await getSessionToken();
  const result = token ? await hsvIdSsoProfile(token) : null;
  const profile = result?.ok ? result.profile : null;
  const memberSince = profile?.membership.confirmedAt ? new Date(profile.membership.confirmedAt).toLocaleDateString("vi-VN") : null;

  return (
    <>
      <div className="adminPageHead">
        <div>
          <h1 className="adminPageTitle">Hồ sơ cá nhân</h1>
          <p className="adminPageSubtitle">Hồ sơ dùng chung của hệ sinh thái Hội Sinh viên.</p>
        </div>
        {profile && (
          <Link href="/admin/profile/edit" className="adminButton adminButtonPrimary">
            Sửa hồ sơ
          </Link>
        )}
      </div>

      <div className="adminCard adminCardPad" style={{ maxWidth: 520 }}>
        <div className="adminField">
          <span className="adminLabel">Vai trò tại Cổng thông tin</span>
          <div>
            <span className="adminRoleBadge">{ROLE_LABELS[session.role]}</span>
          </div>
        </div>
        {profile ? (
          <>
            <div className="adminField">
              <span className="adminLabel">Tư cách Hội viên</span>
              <div>
                <span className={`adminBadge ${profile.membership.isMember ? "adminBadgeSuccess" : "adminBadgeNeutral"}`}>
                  {profile.membership.isMember ? `Là Hội viên${memberSince ? ` (từ ${memberSince})` : ""}` : "Chưa xác nhận"}
                </span>
              </div>
            </div>
            <div className="adminField">
              <span className="adminLabel">Họ tên</span>
              <div>{profile.fullName}</div>
            </div>
            <div className="adminField">
              <span className="adminLabel">Tài khoản đăng nhập</span>
              <div>{profile.email ?? profile.phone}</div>
            </div>
            <div className="adminField">
              <span className="adminLabel">Ngày sinh · Giới tính · Điện thoại</span>
              <div>
                {profile.dateOfBirth ?? "—"} · {profile.gender ? GENDER_LABELS[profile.gender] : "—"} · {profile.phone && !profile.phone.startsWith("auto-") ? profile.phone : "—"}
              </div>
            </div>
            <div className="adminField">
              <span className="adminLabel">Địa phương</span>
              <div>{profile.locality?.name ?? "—"}</div>
            </div>
            <div className="adminField">
              <span className="adminLabel">Đơn vị</span>
              <div>{profile.organization?.name ?? profile.organizationOther ?? "—"}</div>
              {profile.provinceOrganization && <div className="adminHint">Thuộc: {profile.provinceOrganization.name}</div>}
            </div>
            <div className="adminField">
              <span className="adminLabel">Đối tượng</span>
              <div>{profile.subjectType ? SUBJECT_LABELS[profile.subjectType] : "—"}</div>
            </div>
            {LEVELS.map(({ level, label }, i) => (
              <div className="adminField" key={level} style={i === LEVELS.length - 1 ? { marginBottom: 0 } : undefined}>
                <span className="adminLabel">{label}</span>
                <PositionValue slot={profile.positions[level]} />
              </div>
            ))}
          </>
        ) : (
          <>
            <div className="adminField">
              <span className="adminLabel">Họ tên</span>
              <div>{session.displayName}</div>
            </div>
            <div className="adminField" style={{ marginBottom: 0 }}>
              <span className="adminLabel">Email</span>
              <div>{session.email}</div>
            </div>
            <p className="adminErrorText" role="alert" style={{ marginTop: 12 }}>
              {result && !result.ok ? result.message : "Không tải được hồ sơ dùng chung, vui lòng thử lại sau ít phút."}
            </p>
          </>
        )}
      </div>
      <p className="adminHint" style={{ marginTop: 12 }}>
        Chức vụ chọn ở đây được gửi đề xuất chờ duyệt tại đơn vị đúng cấp. Đặt lại mật khẩu: liên hệ Admin.
      </p>
    </>
  );
}
