"use client";

import { useActionState, useState } from "react";
import styles from "./login.module.css";
import { personalLoginAction, type PersonalLoginState } from "./actions";
import { loginAction, type LoginFormState } from "@/app/admin/(auth)/login/actions";

function PasswordField({ disabled }: { disabled: boolean }) {
  const [shown, setShown] = useState(false);
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor="password">
        Mật khẩu
      </label>
      <div className={styles.passwordWrap}>
        <input
          id="password"
          name="password"
          type={shown ? "text" : "password"}
          autoComplete="current-password"
          required
          className={styles.input}
          disabled={disabled}
        />
        <button type="button" className={styles.reveal} onClick={() => setShown((v) => !v)} aria-pressed={shown} aria-label={shown ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>
          {shown ? "Ẩn" : "Hiện"}
        </button>
      </div>
    </div>
  );
}

export function PersonalLoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<PersonalLoginState, FormData>(personalLoginAction, {});
  return (
    <form action={action} noValidate className={styles.form}>
      <input type="hidden" name="next" value={next} />
      <div className={styles.field}>
        <label className={styles.label} htmlFor="identifier">
          Email hoặc số điện thoại
        </label>
        <input id="identifier" name="identifier" type="text" inputMode="email" autoComplete="username" required className={styles.input} disabled={pending} />
      </div>
      <PasswordField disabled={pending} />
      {state?.error && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? "Đang đăng nhập…" : "Đăng nhập"}
      </button>
    </form>
  );
}

export function EditorialLoginForm() {
  const [state, action, pending] = useActionState<LoginFormState, FormData>(loginAction, {});
  return (
    <form action={action} noValidate className={styles.form}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="identifier">
          Email hoặc tên đăng nhập
        </label>
        <input id="identifier" name="identifier" type="text" autoComplete="username" required className={styles.input} disabled={pending} />
      </div>
      <PasswordField disabled={pending} />
      {state?.error && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" className={`${styles.submit} ${styles.submitEditorial}`} disabled={pending}>
        {pending ? "Đang đăng nhập…" : "Vào khu vực Ban biên tập"}
      </button>
    </form>
  );
}
