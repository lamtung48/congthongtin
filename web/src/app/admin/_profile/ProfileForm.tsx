"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { HsvPositionLevel, HsvProfile, HsvProfileOptions } from "@/server/integrations/hsvId";
import { saveProfileAction } from "./profileActions";

const OTHER_VALUE = "__OTHER__";

const POSITION_LEVELS: { level: HsvPositionLevel; label: string }[] = [
  { level: "TRUNG_UONG", label: "Chức vụ cấp Trung ương" },
  { level: "TINH", label: "Chức vụ cấp Tỉnh" },
  { level: "TRUONG", label: "Chức vụ cấp Trường" },
];

/** Class names the form renders with — the admin look by default; the public
 *  "Tài khoản cá nhân" page passes its own CSS-module classes. */
export interface ProfileFormUi {
  field: string;
  label: string;
  input: string;
  select: string;
  hint: string;
  error: string;
  badge: string;
  badgeSuccess: string;
  badgeNeutral: string;
  submit: string;
}

const ADMIN_UI: ProfileFormUi = {
  field: "adminField",
  label: "adminLabel",
  input: "adminInput",
  select: "adminSelect",
  hint: "adminHint",
  error: "adminErrorText",
  badge: "adminBadge",
  badgeSuccess: "adminBadgeSuccess",
  badgeNeutral: "adminBadgeNeutral",
  submit: "adminButton adminButtonPrimary",
};

/**
 * Shared-profile edit form (data + catalogs come from `hsv-id`, see
 * profileActions.ts). Used by the admin profile page and the public personal
 * account page (`/tai-khoan/sua`) — same logic, each with its own look (`ui`).
 * Positions are three independent choices per level — picking one sends a
 * proposal for approval at the right unit, clearing one withdraws it.
 * Membership is display-only (set by approvals/admins).
 */
export function ProfileForm({ profile, options, next, ui = ADMIN_UI }: { profile: HsvProfile; options: HsvProfileOptions; next: string; ui?: ProfileFormUi }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(profile.fullName);
  const [dateOfBirth, setDateOfBirth] = useState(profile.dateOfBirth && profile.dateOfBirth !== "1950-01-09" ? profile.dateOfBirth : "");
  const [phone, setPhone] = useState(profile.phone && !profile.phone.startsWith("auto-") ? profile.phone : "");
  const [gender, setGender] = useState<string>(profile.gender ?? "");
  const [localityId, setLocalityId] = useState(profile.locality?.id ?? "");
  const [organizationChoice, setOrganizationChoice] = useState<string>(profile.organization?.id ?? (profile.organizationOther ? OTHER_VALUE : ""));
  const [organizationOther, setOrganizationOther] = useState(profile.organizationOther ?? "");
  const [subjectType, setSubjectType] = useState<string>(profile.subjectType ?? "STUDENT");

  const initialPositions = useMemo(
    () =>
      Object.fromEntries(POSITION_LEVELS.map(({ level }) => [level, profile.positions[level].current?.position ?? profile.positions[level].pending?.position ?? ""])) as Record<HsvPositionLevel, string>,
    [profile.positions],
  );
  const [positions, setPositions] = useState<Record<HsvPositionLevel, string>>(initialPositions);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Units filtered by locality, but ALWAYS including the person's current unit even if it is outside the chosen locality (legacy data /
  // unit without a locality) — otherwise the required field shows blank and blocks saving without saying why.
  const organizationsInLocality = useMemo(() => {
    const list = options.organizations.filter((o) => o.localityId === localityId);
    const current = options.organizations.find((o) => o.id === organizationChoice);
    if (current && !list.some((o) => o.id === current.id)) list.unshift(current);
    return list;
  }, [options.organizations, localityId, organizationChoice]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!gender) return setError("Vui lòng chọn giới tính.");
    if (!localityId) return setError("Vui lòng chọn địa phương.");
    if (!organizationChoice) return setError("Vui lòng chọn đơn vị.");
    if (organizationChoice === OTHER_VALUE && !organizationOther.trim()) return setError("Vui lòng nhập tên đơn vị.");

    // Only the levels that CHANGED since the form opened (blank = withdraw at that level).
    const changedPositions: Partial<Record<HsvPositionLevel, string | null>> = {};
    for (const { level } of POSITION_LEVELS) {
      if (positions[level] !== initialPositions[level]) changedPositions[level] = positions[level] || null;
    }

    setSubmitting(true);
    try {
      const result = await saveProfileAction({
        fullName,
        dateOfBirth,
        phone,
        gender,
        localityId,
        organizationId: organizationChoice !== OTHER_VALUE ? organizationChoice : undefined,
        organizationOther: organizationChoice === OTHER_VALUE ? organizationOther.trim() : undefined,
        subjectType,
        positions: Object.keys(changedPositions).length > 0 ? changedPositions : undefined,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(next);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  const memberSince = profile.membership.confirmedAt ? new Date(profile.membership.confirmedAt).toLocaleDateString("vi-VN") : null;

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && (
        <p className={ui.error} role="alert" style={{ marginBottom: 14 }}>
          {error}
        </p>
      )}

      <div className={ui.field}>
        <span className={ui.label}>Tư cách Hội viên</span>
        <div>
          <span className={`${ui.badge} ${profile.membership.isMember ? ui.badgeSuccess : ui.badgeNeutral}`}>
            {profile.membership.isMember ? `Là Hội viên${memberSince ? ` (từ ${memberSince})` : ""}` : "Chưa xác nhận"}
          </span>
        </div>
        <p className={ui.hint}>Do Ban quản trị xác nhận hoặc tự có khi chức vụ của bạn được duyệt — không tự sửa được ở đây.</p>
      </div>

      <div className={ui.field}>
        <label className={ui.label} htmlFor="fullName">
          Họ và tên
        </label>
        <input id="fullName" type="text" autoComplete="name" className={ui.input} required value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>

      <div className={ui.field}>
        <label className={ui.label} htmlFor="dateOfBirth">
          Ngày tháng năm sinh
        </label>
        <input id="dateOfBirth" type="date" autoComplete="bday" className={ui.input} required value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
      </div>

      <div className={ui.field}>
        <label className={ui.label} htmlFor="gender">
          Giới tính
        </label>
        <select id="gender" className={ui.select} required value={gender} onChange={(e) => setGender(e.target.value)}>
          <option value="">— Chọn giới tính —</option>
          {options.genders.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
      </div>

      <div className={ui.field}>
        <label className={ui.label} htmlFor="loginIdentifier">
          Tài khoản đăng nhập
        </label>
        <input id="loginIdentifier" className={ui.input} value={profile.email ?? profile.phone ?? ""} disabled readOnly />
        <p className={ui.hint}>Cố định, không thể tự thay đổi.</p>
      </div>

      <div className={ui.field}>
        <label className={ui.label} htmlFor="phone">
          Số điện thoại
        </label>
        <input id="phone" type="tel" autoComplete="tel" className={ui.input} required value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>

      <div className={ui.field}>
        <label className={ui.label} htmlFor="locality">
          Địa phương
        </label>
        <select
          id="locality"
          className={ui.select}
          required
          value={localityId}
          onChange={(e) => {
            setLocalityId(e.target.value);
            setOrganizationChoice("");
          }}
        >
          <option value="">— Chọn tỉnh/thành —</option>
          {options.localities.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      {localityId && (
        <div className={ui.field}>
          <label className={ui.label} htmlFor="organization">
            Đơn vị
          </label>
          <select id="organization" className={ui.select} required value={organizationChoice} onChange={(e) => setOrganizationChoice(e.target.value)}>
            <option value="">— Chọn đơn vị —</option>
            {organizationsInLocality.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
            <option value={OTHER_VALUE}>Khác — nhập tên đơn vị</option>
          </select>
          {organizationChoice === OTHER_VALUE && (
            <input className={ui.input} style={{ marginTop: 8 }} placeholder="Nhập tên đơn vị" required value={organizationOther} onChange={(e) => setOrganizationOther(e.target.value)} />
          )}
        </div>
      )}

      <div className={ui.field}>
        <label className={ui.label} htmlFor="subjectType">
          Đối tượng
        </label>
        <select id="subjectType" className={ui.select} value={subjectType} onChange={(e) => setSubjectType(e.target.value)}>
          {options.subjectTypes.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {POSITION_LEVELS.filter(({ level }) => options.positions[level].length > 0).map(({ level, label }) => {
        const slot = profile.positions[level];
        return (
          <div className={ui.field} key={level}>
            <label className={ui.label} htmlFor={`position-${level}`}>
              {label} (nếu có)
            </label>
            <select id={`position-${level}`} aria-label={label} className={ui.select} value={positions[level]} onChange={(e) => setPositions((prev) => ({ ...prev, [level]: e.target.value }))}>
              <option value="">Không giữ chức vụ</option>
              {options.positions[level].map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            {slot.current && positions[level] === slot.current.position && <p className={ui.hint}>Đang giữ tại: {slot.current.organization.name}.</p>}
            {slot.pending && positions[level] === slot.pending.position && (
              <p className={ui.hint}>{slot.current ? "Đề xuất đổi chức vụ đang chờ duyệt" : "Đang chờ duyệt"} tại: {slot.pending.organization.name}.</p>
            )}
            {slot.rejected && positions[level] === "" && (
              <p className={ui.error}>
                Chức vụ “{slot.rejected.position}” chưa được duyệt{slot.rejected.message ? `: ${slot.rejected.message}` : "."} Hãy chọn lại chức vụ phù hợp hoặc để trống.
              </p>
            )}
            {level === "TINH" && profile.provinceOrganization && <p className={ui.hint}>Sẽ gắn với: {profile.provinceOrganization.name}.</p>}
            <p className={ui.hint}>Chọn chức vụ mới sẽ gửi đề xuất chờ duyệt; bỏ trống để rút chức vụ.</p>
          </div>
        );
      })}

      <button type="submit" disabled={submitting} className={ui.submit} style={{ width: "100%", justifyContent: "center" }}>
        {submitting ? "Đang lưu…" : "Lưu thay đổi"}
      </button>
    </form>
  );
}
