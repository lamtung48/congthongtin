"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { authService } from "@/server/services/authService";

/**
 * Brief section 4's login form, handled as a Server Action (Next's own
 * auth guide's recommended pattern — `<form action={...}>` +
 * `useActionState`, not a client-side `fetch()` to a hand-rolled API
 * route). All validation and the actual credential check happen here, on
 * the server — the client only ever sees the resulting `FormState`.
 */
const LoginSchema = z.object({
  identifier: z.string().min(1, "Vui lòng nhập email hoặc tên đăng nhập."),
  password: z.string().min(1, "Vui lòng nhập mật khẩu."),
});

export interface LoginFormState {
  error?: string;
}

export async function loginAction(_prevState: LoginFormState | undefined, formData: FormData): Promise<LoginFormState> {
  const parsed = LoginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Thông tin đăng nhập không hợp lệ." };
  }

  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const result = await authService.login(parsed.data.identifier, parsed.data.password, ip);
  if (!result.ok) {
    return { error: result.error };
  }

  redirect("/admin/dashboard");
}
