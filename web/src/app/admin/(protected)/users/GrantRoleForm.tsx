"use client";

import { useActionState } from "react";
import { grantRoleAction, lookupIdentityAction, type GrantRoleState, type LookupIdentityState } from "./actions";
import { ASSIGNABLE_ROLES, ROLE_LABELS } from "@/server/auth/permissions";

/**
 * "Cấp quyền Ban biên tập": the Admin types the EXACT e-mail or phone of a
 * person's HSV-ID account, checks it is the right person (name, unit,
 * locality), picks a role and grants it. Nobody gets a CMS role any other
 * way (docs/AUTHENTICATION.md, "Hai luồng đăng nhập").
 */
export function GrantRoleForm() {
  const [lookup, lookupAction, looking] = useActionState<LookupIdentityState, FormData>(lookupIdentityAction, {});
  const [grant, grantAction, granting] = useActionState<GrantRoleState, FormData>(grantRoleAction, {});
  const preview = lookup.preview;
  const forThis = Boolean(preview && grant.hsvId === preview.hsvId);
  const justGranted = forThis && grant.granted && !preview?.existing;

  return (
    <section className="adminCard adminCardPad" style={{ marginBottom: 20 }} aria-labelledby="grant-title">
      <h2 id="grant-title" style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>
        Cấp quyền Ban biên tập cho tài khoản HSV-ID
      </h2>
      <p className="adminHint" style={{ margin: "0 0 12px" }}>
        Người cần cấp quyền phải có tài khoản HSV-ID (đăng ký ở nền tảng Hoạt động hoặc Đào tạo). Nhập đúng email hoặc số điện thoại của họ, kiểm tra đúng người rồi chọn vai trò. Sau đó họ đăng nhập tab “Ban biên tập” bằng mật khẩu HSV-ID của mình.
      </p>

      <form action={lookupAction} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          name="identifier"
          type="text"
          inputMode="email"
          required
          placeholder="Email hoặc số điện thoại"
          defaultValue={lookup.query ?? ""}
          className="adminInput"
          style={{ flex: "1 1 260px", maxWidth: 380 }}
          disabled={looking}
        />
        <button type="submit" className="adminButton" disabled={looking}>
          {looking ? "Đang tìm…" : "Tìm tài khoản"}
        </button>
      </form>

      {lookup.error && (
        <p className="adminErrorText" role="alert" style={{ margin: "10px 0 0" }}>
          {lookup.error}
        </p>
      )}
      {lookup.notFound && (
        <p className="adminHint" role="status" style={{ margin: "10px 0 0" }}>
          Không có tài khoản HSV-ID nào dùng “{lookup.query}”. Người đó cần đăng ký tại nền tảng Hoạt động trước (hoặc dùng mục “Tạo tài khoản mới” bên dưới).
        </p>
      )}

      {preview && (
        <div style={{ marginTop: 14, padding: 14, border: "1px solid var(--admin-border, #e5e7eb)", borderRadius: 10, display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
            <strong style={{ fontSize: 15 }}>{preview.fullName}</strong>
            {preview.isMember && <span className="adminBadge adminBadgeSuccess">Hội viên</span>}
          </div>
          <div className="adminHint" style={{ display: "grid", gap: 2 }}>
            <span>Email: {preview.email ?? "—"}</span>
            <span>Điện thoại: {preview.phoneMasked ?? "—"}</span>
            <span>
              Đơn vị: {preview.organizationName ?? "—"}
              {preview.localityName ? ` · ${preview.localityName}` : ""}
            </span>
          </div>

          {preview.existing ? (
            <p style={{ margin: 0, fontSize: 13 }}>
              Đã có quyền trong Cổng: <span className="adminRoleBadge">{ROLE_LABELS[preview.existing.role]}</span>
              {preview.existing.status === "DISABLED" ? " (đang bị khoá)" : ""} — đổi vai trò hoặc mở khoá ở bảng bên dưới.
            </p>
          ) : preview.blocker ? (
            <p className="adminErrorText" style={{ margin: 0 }}>
              {preview.blocker}
            </p>
          ) : justGranted ? (
            <p role="status" style={{ margin: 0, color: "var(--admin-success)", fontSize: 13 }}>
              Đã cấp quyền {ROLE_LABELS[grant.granted!.role]} cho {grant.granted!.displayName}. Họ đăng nhập tab “Ban biên tập” bằng mật khẩu HSV-ID.
            </p>
          ) : (
            <form action={grantAction} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input type="hidden" name="hsvId" value={preview.hsvId} />
              <label className="adminLabel" htmlFor="grant-role" style={{ margin: 0 }}>
                Vai trò
              </label>
              <select id="grant-role" name="role" defaultValue="CONTRIBUTOR" className="adminSelect" disabled={granting}>
                {ASSIGNABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
              <button type="submit" className="adminButton adminButtonPrimary" disabled={granting}>
                {granting ? "Đang cấp quyền…" : "Cấp quyền"}
              </button>
            </form>
          )}
          {forThis && grant.error && (
            <p className="adminErrorText" role="alert" style={{ margin: 0 }}>
              {grant.error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
