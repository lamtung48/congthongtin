"use client";

import { useActionState } from "react";
import { loginAction, type LoginFormState } from "./actions";

const initialState: LoginFormState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <form action={action} noValidate>
      <div className="adminField">
        <label className="adminLabel" htmlFor="identifier">
          Email hoặc tên đăng nhập
        </label>
        <input id="identifier" name="identifier" type="text" autoComplete="username" required className="adminInput" disabled={pending} />
      </div>
      <div className="adminField">
        <label className="adminLabel" htmlFor="password">
          Mật khẩu
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="adminInput" disabled={pending} />
      </div>

      {state?.error && (
        <p className="adminErrorText" role="alert" style={{ marginBottom: 14 }}>
          {state.error}
        </p>
      )}

      <button type="submit" className="adminButton adminButtonPrimary" disabled={pending} style={{ width: "100%", justifyContent: "center" }}>
        {pending ? "Đang đăng nhập…" : "Đăng nhập"}
      </button>
    </form>
  );
}
