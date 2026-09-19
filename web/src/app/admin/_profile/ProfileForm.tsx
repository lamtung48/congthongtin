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

/**
 * Shared-profile form (the CMS's own look; data + catalogs come from `hsv-id`,
 * see profileActions.ts). Positions are three independent choices per level —
 * picking one sends a proposal for approval at the right unit, clearing one
 * withdraws it. Membership is display-only (set by approvals/admins).
 */
export function ProfileForm({ profile, options, isEdit, next }: { profile: HsvProfile; options: HsvProfileOptions; isEdit: boolean; next: string }) {
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
        <p className="adminErrorText" role="alert" style={{ marginBottom: 14 }}>
          {error}
        </p>
      )}

      <div className="adminField">
        <span className="adminLabel">Tư cách Hội viên</span>
        <div>
          <span className={`adminBadge ${profile.membership.isMember ? "adminBadgeSuccess" : "adminBadgeNeutral"}`}>
            {profile.membership.isMember ? `Là Hội viên${memberSince ? ` (từ ${memberSince})` : ""}` : "Chưa xác nhận"}
          </span>
        </div>
        <p className="adminHint">Do Ban quản trị xác nhận hoặc tự có khi chức vụ của bạn được duyệt — không tự sửa được ở đây.</p>
      </div>

      <div className="adminField">
        <label className="adminLabel" htmlFor="fullName">
          Họ và tên
        </label>
        <input id="fullName" type="text" autoComplete="name" className="adminInput" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>

      <div className="adminField">
        <label className="adminLabel" htmlFor="dateOfBirth">
          Ngày tháng năm sinh
        </label>
        <input id="dateOfBirth" type="date" autoComplete="bday" className="adminInput" required value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
      </div>

      <div className="adminField">
        <label className="adminLabel" htmlFor="gender">
          Giới tính
        </label>
        <select id="gender" className="adminSelect" required value={gender} onChange={(e) => setGender(e.target.value)}>
          <option value="">— Chọn giới tính —</option>
          {options.genders.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
      </div>

      <div className="adminField">
        <label className="adminLabel" htmlFor="loginIdentifier">
          Tài khoản đăng nhập
        </label>
        <input id="loginIdentifier" className="adminInput" value={profile.email ?? profile.phone ?? ""} disabled readOnly />
        <p className="adminHint">Cố định, không thể tự thay đổi.</p>
      </div>

      <div className="adminField">
        <label className="adminLabel" htmlFor="phone">
          Số điện thoại
        </label>
        <input id="phone" type="tel" autoComplete="tel" className="adminInput" required value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>

      <div className="adminField">
        <label className="adminLabel" htmlFor="locality">
          Địa phương
        </label>
        <select
          id="locality"
          className="adminSelect"
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
        <div className="adminField">
          <label className="adminLabel" htmlFor="organization">
            Đơn vị
          </label>
          <select id="organization" className="adminSelect" required value={organizationChoice} onChange={(e) => setOrganizationChoice(e.target.value)}>
            <option value="">— Chọn đơn vị —</option>
            {organizationsInLocality.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
            <option value={OTHER_VALUE}>Khác — nhập tên đơn vị</option>
          </select>
          {organizationChoice === OTHER_VALUE && (
            <input className="adminInput" style={{ marginTop: 8 }} placeholder="Nhập tên đơn vị" required value={organizationOther} onChange={(e) => setOrganizationOther(e.target.value)} />
          )}
        </div>
      )}

      <div className="adminField">
        <label className="adminLabel" htmlFor="subjectType">
          Đối tượng
        </label>
        <select id="subjectType" className="adminSelect" value={subjectType} onChange={(e) => setSubjectType(e.target.value)}>
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
          <div className="adminField" key={level}>
            <label className="adminLabel" htmlFor={`position-${level}`}>
              {label} (nếu có)
            </label>
            <select id={`position-${level}`} aria-label={label} className="adminSelect" value={positions[level]} onChange={(e) => setPositions((prev) => ({ ...prev, [level]: e.target.value }))}>
              <option value="">Không giữ chức vụ</option>
              {options.positions[level].map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            {slot.current && positions[level] === slot.current.position && <p className="adminHint">Đang giữ tại: {slot.current.organization.name}.</p>}
            {slot.pending && positions[level] === slot.pending.position && (
              <p className="adminHint">{slot.current ? "Đề xuất đổi chức vụ đang chờ duyệt" : "Đang chờ duyệt"} tại: {slot.pending.organization.name}.</p>
            )}
            {slot.rejected && positions[level] === "" && (
              <p className="adminErrorText">
                Chức vụ “{slot.rejected.position}” chưa được duyệt{slot.rejected.message ? `: ${slot.rejected.message}` : "."} Hãy chọn lại chức vụ phù hợp hoặc để trống.
              </p>
            )}
            {level === "TINH" && profile.provinceOrganization && <p className="adminHint">Sẽ gắn với: {profile.provinceOrganization.name}.</p>}
            <p className="adminHint">Chọn chức vụ mới sẽ gửi đề xuất chờ duyệt; bỏ trống để rút chức vụ.</p>
          </div>
        );
      })}

      <button type="submit" disabled={submitting} className="adminButton adminButtonPrimary" style={{ width: "100%", justifyContent: "center" }}>
        {submitting ? "Đang lưu…" : isEdit ? "Lưu thay đổi" : "Hoàn tất"}
      </button>
    </form>
  );
}
