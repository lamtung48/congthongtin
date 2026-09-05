"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/server/auth/guard";
import { userService } from "@/server/services/userService";
import { ASSIGNABLE_ROLES } from "@/server/auth/permissions";
import type { AdminRole } from "@/generated/prisma/client";

/**
 * Every action here calls `requirePermission("user.manage")` (or
 * `"user.changeRole"`) itself, on top of whatever `/admin/users/page.tsx`
 * already checked — brief section 3: "Mọi action nhạy cảm phải xác thực
 * quyền tại server/service layer." A Server Action is reachable directly
 * (it's a POST endpoint under the hood), not only through the page that
 * happens to render a form calling it, so it re-checks independently.
 */

const CreateUserSchema = z.object({
  email: z.email(),
  username: z.string().trim().optional(),
  displayName: z.string().trim().min(1),
  role: z.enum(ASSIGNABLE_ROLES as [AdminRole, ...AdminRole[]]),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự."),
});

export interface CreateUserFormState {
  error?: string;
  success?: boolean;
}

export async function createUserAction(_prev: CreateUserFormState | undefined, formData: FormData): Promise<CreateUserFormState> {
  const actor = await requirePermission("user.manage");
  const parsed = CreateUserSchema.safeParse({
    email: formData.get("email"),
    username: formData.get("username") || undefined,
    displayName: formData.get("displayName"),
    role: formData.get("role"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }
  try {
    await userService.create(actor, parsed.data);
  } catch {
    return { error: "Không thể tạo tài khoản — email hoặc tên đăng nhập có thể đã tồn tại." };
  }
  revalidatePath("/admin/users");
  return { success: true };
}

export async function changeRoleAction(formData: FormData): Promise<void> {
  const actor = await requirePermission("user.changeRole");
  const userId = String(formData.get("userId"));
  const role = String(formData.get("role")) as AdminRole;
  await userService.changeRole(actor, userId, role);
  revalidatePath("/admin/users");
}

export async function setStatusAction(formData: FormData): Promise<void> {
  const actor = await requirePermission("user.manage");
  const userId = String(formData.get("userId"));
  const status = String(formData.get("status")) as "ACTIVE" | "DISABLED";
  await userService.setStatus(actor, userId, status);
  revalidatePath("/admin/users");
}

export interface ResetPasswordFormState {
  error?: string;
  temporaryPassword?: string;
}

export async function resetPasswordAction(_prev: ResetPasswordFormState | undefined, formData: FormData): Promise<ResetPasswordFormState> {
  const actor = await requirePermission("user.manage");
  const userId = String(formData.get("userId"));
  try {
    const { temporaryPassword } = await userService.resetPassword(actor, userId);
    return { temporaryPassword };
  } catch {
    return { error: "Không thể đặt lại mật khẩu." };
  }
}
