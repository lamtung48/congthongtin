"use client";

import { useActionState, useRef, useEffect } from "react";
import { createUserAction, type CreateUserFormState } from "./actions";
import { ASSIGNABLE_ROLES, ROLE_LABELS } from "@/server/auth/permissions";

const initialState: CreateUserFormState = {};

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createUserAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={action} className="adminCard adminCardPad" style={{ marginBottom: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, alignItems: "end" }}>
      <div className="adminField" style={{ marginBottom: 0 }}>
        <label className="adminLabel" htmlFor="new-email">Email</label>
        <input id="new-email" name="email" type="email" required className="adminInput" disabled={pending} />
      </div>
      <div className="adminField" style={{ marginBottom: 0 }}>
        <label className="adminLabel" htmlFor="new-username">Tên đăng nhập (tuỳ chọn)</label>
        <input id="new-username" name="username" type="text" className="adminInput" disabled={pending} />
      </div>
      <div className="adminField" style={{ marginBottom: 0 }}>
        <label className="adminLabel" htmlFor="new-displayName">Họ tên</label>
        <input id="new-displayName" name="displayName" type="text" required className="adminInput" disabled={pending} />
      </div>
      <div className="adminField" style={{ marginBottom: 0 }}>
        <label className="adminLabel" htmlFor="new-role">Vai trò</label>
        <select id="new-role" name="role" required defaultValue="CONTRIBUTOR" className="adminSelect" disabled={pending}>
          {ASSIGNABLE_ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      </div>
      <div className="adminField" style={{ marginBottom: 0 }}>
        <label className="adminLabel" htmlFor="new-password">Mật khẩu ban đầu</label>
        <input id="new-password" name="password" type="text" required minLength={8} className="adminInput" disabled={pending} />
      </div>
      <button type="submit" className="adminButton adminButtonPrimary" disabled={pending}>
        {pending ? "Đang tạo…" : "Tạo tài khoản"}
      </button>
      {state.error && (
        <p className="adminErrorText" role="alert" style={{ gridColumn: "1 / -1", margin: 0 }}>
          {state.error}
        </p>
      )}
      {state.success && (
        <p style={{ gridColumn: "1 / -1", margin: 0, color: "var(--admin-success)", fontSize: 12.5 }}>Đã tạo tài khoản.</p>
      )}
    </form>
  );
}
