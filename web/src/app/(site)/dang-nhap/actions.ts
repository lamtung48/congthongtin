"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { authService } from "@/server/services/authService";
import { safeNextPath } from "@/server/auth/person";

/**
 * Personal sign-in ("Tài khoản cá nhân" tab of `/dang-nhap`). Opens the
 * shared SSO session only — see `authService.personalLogin`. The editorial
 * tab posts to the existing `loginAction` (`admin/(auth)/login/actions.ts`).
 */
const PersonalLoginSchema = z.object({
  identifier: z.string().trim().min(1, "Vui lòng nhập email hoặc số điện thoại."),
  password: z.string().min(1, "Vui lòng nhập mật khẩu."),
  next: z.string().optional(),
});

export interface PersonalLoginState {
  error?: string;
}

export async function personalLoginAction(_prev: PersonalLoginState | undefined, formData: FormData): Promise<PersonalLoginState> {
  const parsed = PersonalLoginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Thông tin đăng nhập không hợp lệ." };
  }

  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const result = await authService.personalLogin(parsed.data.identifier, parsed.data.password, ip, requestHeaders.get("user-agent"));
  if (!result.ok) return { error: result.error };

  redirect(safeNextPath(parsed.data.next, "/"));
}
