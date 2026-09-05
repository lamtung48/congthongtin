"use client";

import { useActionState } from "react";
import { resetPasswordAction, type ResetPasswordFormState } from "./actions";

const initialState: ResetPasswordFormState = {};

/**
 * The one place a plaintext value is ever shown in the admin UI — a
 * freshly generated temporary password, exactly once, so an Admin can
 * relay it to the account owner out-of-band. See `UserService.resetPassword`
 * for why nothing stores or logs it.
 */
export function ResetPasswordButton({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, initialState);

  if (state.temporaryPassword) {
    return (
      <span className="adminHint" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        Mật khẩu mới: <code>{state.temporaryPassword}</code>
      </span>
    );
  }

  return (
    <form action={action} style={{ display: "inline" }}>
      <input type="hidden" name="userId" value={userId} />
      <button type="submit" className="adminButton adminButtonSmall" disabled={pending}>
        {pending ? "Đang đặt lại…" : "Reset mật khẩu"}
      </button>
      {state.error && <span className="adminErrorText" style={{ marginLeft: 8 }}>{state.error}</span>}
    </form>
  );
}
