"use server";

import { z } from "zod";
import { getSessionToken, invalidateSsoCache, requireSession } from "@/server/auth/session";
import { hsvIdSsoUpdateProfile } from "@/server/integrations/hsvId";

/**
 * Saves the shared profile (complete-profile page + "Hồ sơ cá nhân" edit).
 * The CMS only forwards the person's own SSO token; the core (`hsv-id`)
 * validates against the catalogs, turns positions into approval proposals at
 * the right level, and never lets a platform edit anyone else's profile.
 */
const positionSchema = z.string().max(200).nullable().optional();
const inputSchema = z
  .object({
    fullName: z.string().trim().min(1, "Vui lòng nhập họ và tên."),
    dateOfBirth: z.string().min(1, "Vui lòng nhập ngày sinh."),
    phone: z.string().trim().min(8, "Số điện thoại chưa hợp lệ."),
    gender: z.enum(["MALE", "FEMALE", "OTHER"], { message: "Vui lòng chọn giới tính." }),
    localityId: z.string().min(1, "Vui lòng chọn địa phương."),
    organizationId: z.string().optional(),
    organizationOther: z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().min(1).optional()),
    subjectType: z.enum(["STUDENT", "STAFF"], { message: "Vui lòng chọn đối tượng." }),
    positions: z.object({ TRUNG_UONG: positionSchema, TINH: positionSchema, TRUONG: positionSchema }).optional(),
  })
  .refine((data) => !!data.organizationId || !!data.organizationOther, { message: "Vui lòng chọn đơn vị hoặc nhập tên đơn vị.", path: ["organizationId"] });

export type SaveProfileResult = { ok: true; notices: string[]; proposed: number; withdrawn: number } | { ok: false; message: string };

export async function saveProfileAction(input: unknown): Promise<SaveProfileResult> {
  await requireSession();
  const token = await getSessionToken();
  if (!token) return { ok: false, message: "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại." };

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  const body = parsed.data;

  const result = await hsvIdSsoUpdateProfile(token, {
    fullName: body.fullName,
    dateOfBirth: body.dateOfBirth,
    phone: body.phone,
    gender: body.gender,
    subjectType: body.subjectType,
    localityId: body.localityId,
    organizationId: body.organizationId ?? null,
    organizationOther: body.organizationId ? null : (body.organizationOther ?? null),
    positions: body.positions,
  });
  invalidateSsoCache(token); // the next read (layout gate, profile page) must see the fresh profile + completeness
  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, notices: result.changes.notices, proposed: result.changes.positionsProposed.length, withdrawn: result.changes.positionsWithdrawn.length };
}
