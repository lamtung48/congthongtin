"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/server/auth/guard";
import { GrantRoleError, userService, type IdentityPreview } from "@/server/services/userService";
import { ASSIGNABLE_ROLES } from "@/server/auth/permissions";
import { sensitiveAdminActionRateLimiter } from "@/server/security/rateLimit";
import type { AdminRole } from "@/generated/prisma/client";

/**
 * Every action here calls `requirePermission("user.manage")` (or
 * `"user.changeRole"`) itself, on top of whatever `/admin/users/page.tsx`
 * already checked — brief section 3: "Mọi action nhạy cảm phải xác thực
 * quyền tại server/service layer." A Server Action is reachable directly
 * (it's a POST endpoint under the hood), not only through the page that
 * happens to render a form calling it, so it re-checks independently.
 *
 * Brief section 9: "sensitive admin API" rate limit — every action here
 * changes an account's role/status/password, so each one also checks
 * `sensitiveAdminActionRateLimiter` keyed by the *actor* (not the target
 * user), right after the permission check.
 */

function assertNotRateLimited(actorId: string): void {
  if (!sensitiveAdminActionRateLimiter.check(actorId).allowed) {
    throw new Error("Bạn đang thao tác quá nhanh — vui lòng thử lại sau ít phút.");
  }
  sensitiveAdminActionRateLimiter.record(actorId);
}

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
  if (!sensitiveAdminActionRateLimiter.check(actor.id).allowed) {
    return { error: "Bạn đang thao tác quá nhanh — vui lòng thử lại sau ít phút." };
  }
  sensitiveAdminActionRateLimiter.record(actor.id);
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
  } catch (err) {
    return { error: err instanceof GrantRoleError ? err.message : "Không thể tạo tài khoản — email hoặc tên đăng nhập có thể đã tồn tại." };
  }
  revalidatePath("/admin/users");
  return { success: true };
}

export async function changeRoleAction(formData: FormData): Promise<void> {
  const actor = await requirePermission("user.changeRole");
  assertNotRateLimited(actor.id);
  const userId = String(formData.get("userId"));
  const role = String(formData.get("role")) as AdminRole;
  await userService.changeRole(actor, userId, role);
  revalidatePath("/admin/users");
}

export async function setStatusAction(formData: FormData): Promise<void> {
  const actor = await requirePermission("user.manage");
  assertNotRateLimited(actor.id);
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
  if (!sensitiveAdminActionRateLimiter.check(actor.id).allowed) {
    return { error: "Bạn đang thao tác quá nhanh — vui lòng thử lại sau ít phút." };
  }
  sensitiveAdminActionRateLimiter.record(actor.id);
  const userId = String(formData.get("userId"));
  try {
    const { temporaryPassword } = await userService.resetPassword(actor, userId);
    return { temporaryPassword };
  } catch {
    return { error: "Không thể đặt lại mật khẩu." };
  }
}

// ---- Cấp quyền Ban biên tập cho một tài khoản HSV-ID (the only way a CMS role is granted — see userService.grantRole) ----

export interface LookupIdentityState {
  query?: string;
  preview?: IdentityPreview;
  notFound?: boolean;
  error?: string;
}

export async function lookupIdentityAction(_prev: LookupIdentityState | undefined, formData: FormData): Promise<LookupIdentityState> {
  const actor = await requirePermission("user.manage");
  const query = String(formData.get("identifier") ?? "").trim();
  if (query.length < 6) return { query, error: "Nhập đúng email hoặc số điện thoại của tài khoản HSV-ID." };
  try {
    const preview = await userService.lookupIdentity(actor, query);
    return preview ? { query, preview } : { query, notFound: true };
  } catch (err) {
    return { query, error: err instanceof GrantRoleError ? err.message : "Không tra cứu được, vui lòng thử lại." };
  }
}

const GrantRoleSchema = z.object({
  hsvId: z.string().min(1),
  role: z.enum(ASSIGNABLE_ROLES as [AdminRole, ...AdminRole[]]),
});

/** Tagged with the account it is about, so a result never shows under a different person looked up afterwards. */
export interface GrantRoleState {
  hsvId?: string;
  error?: string;
  granted?: { displayName: string; role: AdminRole };
}

export async function grantRoleAction(_prev: GrantRoleState | undefined, formData: FormData): Promise<GrantRoleState> {
  const actor = await requirePermission("user.manage");
  if (!sensitiveAdminActionRateLimiter.check(actor.id).allowed) {
    return { error: "Bạn đang thao tác quá nhanh — vui lòng thử lại sau ít phút." };
  }
  sensitiveAdminActionRateLimiter.record(actor.id);
  const parsed = GrantRoleSchema.safeParse({ hsvId: formData.get("hsvId"), role: formData.get("role") });
  if (!parsed.success) return { error: "Dữ liệu không hợp lệ." };
  const { hsvId } = parsed.data;
  try {
    const user = await userService.grantRole(actor, hsvId, parsed.data.role);
    revalidatePath("/admin/users");
    return { hsvId, granted: { displayName: user.displayName, role: user.role } };
  } catch (err) {
    return { hsvId, error: err instanceof GrantRoleError ? err.message : "Không cấp được quyền, vui lòng thử lại." };
  }
}
