import Link from "next/link";
import type { Metadata } from "next";
import styles from "./account.module.css";
import { LogoutButton } from "./LogoutButton";
import { MemberCardBlock } from "@/components/account/MemberCardBlock";
import { initialsOf } from "@/lib/initials";
import { requirePerson } from "@/server/auth/person";
import { getSessionToken, getSsoIdentity } from "@/server/auth/session";
import { ROLE_LABELS } from "@/server/auth/permissions";
import { loadPersonalAccount } from "@/server/services/accountService";
import type { HsvPositionLevel, HsvProfilePositionSlot } from "@/server/integrations/hsvId";
import { ECOSYSTEM_LINKS } from "@/lib/siteChrome";
import { IconActivity, IconArrowLeft, IconArrowRight, IconConference, IconEdit, IconExternal, IconPen, IconTraining } from "@/components/icons";

export const metadata: Metadata = { title: "Tài khoản cá nhân", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const GENDER_LABELS = { MALE: "Nam", FEMALE: "Nữ", OTHER: "Khác" } as const;
const SUBJECT_LABELS = { STUDENT: "Sinh viên", STAFF: "Cán bộ, giảng viên" } as const;
const LEVELS: { level: HsvPositionLevel; label: string }[] = [
  { level: "TRUNG_UONG", label: "Cấp Trung ương" },
  { level: "TINH", label: "Cấp Tỉnh" },
  { level: "TRUONG", label: "Cấp Trường" },
];
const PLATFORM_ICON = { activity: IconActivity, training: IconTraining, conference: IconConference } as const;

function real(value: string | null | undefined, placeholder?: (v: string) => boolean): string | null {
  if (!value) return null;
  return placeholder?.(value) ? null : value;
}

function Position({ slot }: { slot: HsvProfilePositionSlot }) {
  if (!slot.current && !slot.pending && !slot.rejected) return <span className={styles.muted}>Không giữ chức vụ</span>;
  return (
    <span className={styles.positionList}>
      {slot.current && (
        <span>
          {slot.current.position} — {slot.current.organization.name} <span className={`${styles.pill} ${styles.pillOk}`}>Đã duyệt</span>
        </span>
      )}
      {slot.pending && (
        <span>
          {slot.pending.position} — {slot.pending.organization.name} <span className={`${styles.pill} ${styles.pillWait}`}>Chờ duyệt</span>
        </span>
      )}
      {slot.rejected && (
        <span>
          {slot.rejected.position} <span className={`${styles.pill} ${styles.pillNo}`}>Chưa được duyệt</span>
          {slot.rejected.message && <small className={styles.muted}> — {slot.rejected.message}</small>}
        </span>
      )}
    </span>
  );
}

/**
 * "Tài khoản cá nhân" — the personal side of sign-in (docs/AUTHENTICATION.md,
 * "Hai luồng đăng nhập"): the Thẻ Hội viên, the shared HSV-ID profile, and
 * the platforms this one account opens. Any HSV-ID account; no CMS role.
 */
export default async function AccountPage() {
  const person = await requirePerson("/tai-khoan");
  const identity = await getSsoIdentity();
  const token = await getSessionToken();
  if (!identity.ok || !token) return null; // requirePerson already redirected

  const { profileResult, profile, card } = await loadPersonalAccount(identity.user, token);
  const memberSince = profile?.membership.confirmedAt ? new Date(profile.membership.confirmedAt).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : null;
  const phone = real(profile?.phone, (v) => v.startsWith("auto-"));
  const dob = real(profile?.dateOfBirth, (v) => v === "1950-01-09");

  return (
    <div className={styles.page}>
      {/* On mobile the header's account button is a plain link straight to this page (no dropdown there —
          see Header.tsx), so this page needs its own way back to the homepage. */}
      <Link href="/" className={styles.backBar}>
        <IconArrowLeft size={16} />
        Quay lại Cổng thông tin
      </Link>
      <section className={styles.hero}>
        <span aria-hidden className={styles.heroGlow} />
        <div className={styles.heroInner}>
          <span className={styles.avatar} aria-hidden>
            {initialsOf(card.fullName)}
          </span>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>Tài khoản cá nhân · HSV-ID</span>
            <h1 className={styles.name}>{card.fullName}</h1>
            <div className={styles.chips}>
              {card.login && <span className={styles.chip}>{card.login}</span>}
              <span className={`${styles.chip} ${card.isMember ? styles.chipMember : ""}`}>
                {card.isMember ? `Hội viên${memberSince ? ` từ ${memberSince}` : ""}` : "Chưa xác nhận Hội viên"}
              </span>
              {person.editor && <span className={`${styles.chip} ${styles.chipEditor}`}>Ban biên tập · {ROLE_LABELS[person.editor.role]}</span>}
            </div>
          </div>
          <div className={styles.heroActions}>
            <Link href="/tai-khoan/sua" className={styles.primaryBtn}>
              <IconEdit size={16} />
              Sửa thông tin tài khoản
            </Link>
            <LogoutButton className={styles.ghostBtn} />
          </div>
        </div>
      </section>

      <div className={styles.body}>
        <aside className={styles.cardCol} aria-labelledby="card-title">
          <h2 id="card-title" className={styles.colTitle}>
            Thẻ Hội viên
          </h2>
          <MemberCardBlock data={card} />
          <p className={styles.cardNote}>Hạng, điểm và huy hiệu do nền tảng Hoạt động ghi nhận khi bạn tham gia hoạt động của Hội.</p>
        </aside>

        <div className={styles.mainCol}>
          <section className={styles.panel} aria-labelledby="profile-title">
            <div className={styles.panelHead}>
              <div>
                <h2 id="profile-title" className={styles.panelTitle}>
                  Hồ sơ dùng chung
                </h2>
                <p className={styles.panelSub}>Sửa ở đây là cập nhật cho mọi nền tảng của Hội.</p>
              </div>
              <Link href="/tai-khoan/sua" className={styles.linkBtn}>
                Sửa <IconArrowRight size={14} />
              </Link>
            </div>
            {profile ? (
              <dl className={styles.facts}>
                <div>
                  <dt>Họ và tên</dt>
                  <dd>{profile.fullName}</dd>
                </div>
                <div>
                  <dt>Ngày sinh</dt>
                  <dd>{dob ? dob.split("-").reverse().join("/") : <span className={styles.missing}>Chưa khai</span>}</dd>
                </div>
                <div>
                  <dt>Giới tính</dt>
                  <dd>{profile.gender ? GENDER_LABELS[profile.gender] : <span className={styles.missing}>Chưa khai</span>}</dd>
                </div>
                <div>
                  <dt>Số điện thoại</dt>
                  <dd>{phone ?? <span className={styles.missing}>Chưa khai</span>}</dd>
                </div>
                <div>
                  <dt>Địa phương</dt>
                  <dd>{profile.locality?.name ?? <span className={styles.missing}>Chưa khai</span>}</dd>
                </div>
                <div>
                  <dt>Đơn vị</dt>
                  <dd>
                    {profile.organization?.name ?? profile.organizationOther ?? <span className={styles.missing}>Chưa khai</span>}
                    {profile.provinceOrganization && <small className={styles.muted}>Thuộc {profile.provinceOrganization.name}</small>}
                  </dd>
                </div>
                <div>
                  <dt>Đối tượng</dt>
                  <dd>{profile.subjectType ? SUBJECT_LABELS[profile.subjectType] : <span className={styles.missing}>Chưa khai</span>}</dd>
                </div>
              </dl>
            ) : (
              <p className={styles.error} role="alert">
                {profileResult.ok ? "" : profileResult.message}
              </p>
            )}
            {profile && !profile.completeness.complete && (
              <p className={styles.hint}>
                Hồ sơ còn thiếu thông tin — một số nền tảng (Hoạt động, Đào tạo) sẽ yêu cầu bổ sung. <Link href="/tai-khoan/sua">Hoàn thiện ngay</Link>
              </p>
            )}
          </section>

          {profile && (
            <section className={styles.panel} aria-labelledby="positions-title">
              <div className={styles.panelHead}>
                <div>
                  <h2 id="positions-title" className={styles.panelTitle}>
                    Chức vụ trong Hội
                  </h2>
                  <p className={styles.panelSub}>Chức vụ khai mới được gửi đề xuất chờ duyệt tại đơn vị đúng cấp.</p>
                </div>
              </div>
              <dl className={styles.facts}>
                {LEVELS.map(({ level, label }) => (
                  <div key={level}>
                    <dt>{label}</dt>
                    <dd>
                      <Position slot={profile.positions[level]} />
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <section className={styles.panel} aria-labelledby="platforms-title">
            <div className={styles.panelHead}>
              <div>
                <h2 id="platforms-title" className={styles.panelTitle}>
                  Nền tảng dùng chung tài khoản
                </h2>
                <p className={styles.panelSub}>Đã đăng nhập ở đây là vào thẳng, không cần đăng nhập lại.</p>
              </div>
            </div>
            <div className={styles.platforms}>
              {ECOSYSTEM_LINKS.map((l) => {
                const Icon = PLATFORM_ICON[l.key];
                return (
                  <a key={l.key} href={l.href} target="_blank" rel="noopener noreferrer" className={styles.platform} data-tone={l.key}>
                    <span className={styles.platformIcon}>
                      <Icon size={20} />
                    </span>
                    <span className={styles.platformText}>
                      <strong>{l.label}</strong>
                      <small>{l.hint}</small>
                    </span>
                    <span className={l.sso ? styles.ssoOn : styles.ssoOff}>{l.sso ? "Đăng nhập chung" : "Tài khoản riêng"}</span>
                    <IconExternal size={14} />
                  </a>
                );
              })}
            </div>
          </section>

          {person.editor && (
            <section className={`${styles.panel} ${styles.editorPanel}`} aria-labelledby="editor-title">
              <span className={styles.editorIcon}>
                <IconPen size={18} />
              </span>
              <div className={styles.editorCopy}>
                <h2 id="editor-title" className={styles.panelTitle}>
                  Ban biên tập
                </h2>
                <p className={styles.panelSub}>Bạn có quyền {ROLE_LABELS[person.editor.role]} tại Cổng thông tin.</p>
              </div>
              <Link href="/admin/dashboard" className={styles.darkBtn}>
                Vào trang quản trị <IconArrowRight size={14} />
              </Link>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
