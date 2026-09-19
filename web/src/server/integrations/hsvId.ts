import "server-only";

/**
 * Client for the shared Identity service `hsv-id` (/opt/hsv-id on the VPS).
 *
 * Since 2026-09-19 `hsv-id` is the SSO core for the CMS (docs/AUTHENTICATION.md,
 * "SSO (hsv-id)"): login, session validation, logout and the shared profile
 * (view/edit) all go through `/internal/sso/*` and `/internal/profile/*`; this
 * CMS keeps only its own UI, the local `User` row (role/status/authorship) and
 * the link `User.identityUserId`. Passwords live ONLY in `hsv-id`.
 *
 * Unlike the older password-sync helpers below (create/link/change-password,
 * still fault-tolerant: `null`/`false` on failure), the SSO functions return an
 * explicit result so the caller can tell "wrong password" from "hsv-id down".
 *
 * The API is internal-only (docker network, never public) and authenticated
 * with the shared `X-Internal-Key` header.
 */

const HSV_ID_URL = process.env.HSV_ID_URL;
const HSV_ID_INTERNAL_KEY = process.env.HSV_ID_INTERNAL_KEY;

/** PlatformLink.platform value that identifies this CMS inside `hsv-id`. */
const PLATFORM = "congthongtin";

export function hsvIdConfigured(): boolean {
  return Boolean(HSV_ID_URL && HSV_ID_INTERNAL_KEY);
}

async function call(path: string, init: RequestInit): Promise<{ status: number; body: any } | null> {
  if (!hsvIdConfigured()) return null;
  try {
    const res = await fetch(`${HSV_ID_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", "X-Internal-Key": HSV_ID_INTERNAL_KEY!, ...init.headers },
      // Never let a slow/hung identity service stall a login request.
      signal: AbortSignal.timeout(5000),
    });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  } catch (err) {
    console.error("[hsv-id] gọi thất bại, dùng dữ liệu cục bộ:", err);
    return null;
  }
}

export interface HsvIdUser {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string;
  status: string;
}

/**
 * Verify a password against `hsv-id` and return the full account on
 * success (HTTP 200), else `null`. Used by the legacy-account migration at login to:
 *  - link a pre-existing `hsv-id` account (created from another platform)
 *    to a local row, and
 *  - auto-provision a local CONTRIBUTOR for someone who has an `hsv-id`
 *    account (i.e. a hoinghi/daotaohsv user) but no CMS account yet.
 */
export async function hsvIdVerifyAndGetUser(identifier: string, password: string): Promise<HsvIdUser | null> {
  const res = await call("/internal/verify-credentials", {
    method: "POST",
    body: JSON.stringify({ identifier, password }),
  });
  if (res?.status !== 200) return null;
  const u = res.body?.user;
  if (!u?.id) return null;
  return { id: u.id, email: u.email ?? null, phone: u.phone ?? null, fullName: u.fullName ?? "", status: u.status ?? "ACTIVE" };
}

/** Attach this CMS to an existing `hsv-id` account. Returns whether the
 *  link now exists (201, or 409 = already linked — both are "linked"). */
export async function hsvIdLink(identityUserId: string, platformUserId: string): Promise<boolean> {
  const res = await call(`/internal/users/${identityUserId}/link`, {
    method: "POST",
    body: JSON.stringify({ platform: PLATFORM, platformUserId }),
  });
  return res?.status === 201 || res?.status === 409;
}

/**
 * Create an `hsv-id` account and link it to this CMS's local `User.id`.
 * Returns the new `hsv-id` user id, or `null` on any failure — callers must
 * NOT block login/user-creation on this.
 *
 * A 409 (the email already belongs to a different `hsv-id` account, usually
 * one created from another platform) deliberately does NOT auto-`/link`
 * here — same call as `hoinghi` makes: auto-linking would swap this
 * person's working local password for a different platform's, with no way
 * back. An Admin resolves those by hand via the `hsv-id` API.
 */
export async function hsvIdCreateUser(input: {
  email?: string | null;
  password: string;
  fullName: string;
  platformUserId: string;
}): Promise<string | null> {
  const res = await call("/internal/users", {
    method: "POST",
    body: JSON.stringify({
      email: input.email ?? undefined,
      password: input.password,
      fullName: input.fullName,
      platform: PLATFORM,
      platformUserId: input.platformUserId,
    }),
  });
  if (res?.status === 201) return (res.body?.user?.id as string | undefined) ?? null;
  if (res && res.status !== 409) {
    console.error("[hsv-id] tạo tài khoản thất bại:", res.status, res.body);
  }
  return null;
}

/** Push a new password to `hsv-id`. Returns whether it took effect there. */
export async function hsvIdChangePassword(identityUserId: string, newPassword: string): Promise<boolean> {
  const res = await call(`/internal/users/${identityUserId}/change-password`, {
    method: "POST",
    body: JSON.stringify({ newPassword }),
  });
  return res?.status === 200;
}

// ============================================================
// SSO + HO SO DUNG CHUNG (2026-09-19): dang nhap/kiem tra phien/dang xuat/xem-sua ho so do LOI hsv-id lam
// (/internal/sso/*, /internal/profile/*); CMS chi co giao dien rieng. Xem /opt/hsv-id/docs/sso.md.
// ============================================================

const SSO_CLIENT_ID = "congthongtin";

function pick<T>(body: unknown, key: string): T | null {
  const value = (body as Record<string, unknown> | null)?.[key];
  return (value ?? null) as T | null;
}

export interface HsvCompleteness {
  complete: boolean;
  missing: string[]; // fullName | dateOfBirth | gender | phone | locality | organization | subjectType
}

/** Tai khoan hsv-id tra ve boi /internal/sso/* (phan CMS can). */
export interface HsvSsoUser {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string;
  status: string;
}

const UNAVAILABLE_MESSAGE = "Hệ thống định danh đang gián đoạn, vui lòng thử lại sau.";

export type SsoLoginResult =
  | { ok: true; token: string; expiresAt: string; user: HsvSsoUser; completeness: HsvCompleteness }
  | { ok: false; error: "INVALID_CREDENTIALS" | "BLOCKED" | "RATE_LIMITED" | "UNAVAILABLE"; message: string };

export async function hsvIdSsoLogin(input: { identifier: string; password: string; ip?: string | null; userAgent?: string | null }): Promise<SsoLoginResult> {
  const res = await call("/internal/sso/login", {
    method: "POST",
    body: JSON.stringify({ identifier: input.identifier, password: input.password, clientId: SSO_CLIENT_ID, ip: input.ip ?? undefined, userAgent: input.userAgent ?? undefined }),
  });
  if (!res) return { ok: false, error: "UNAVAILABLE", message: UNAVAILABLE_MESSAGE };
  if (res.status === 200) {
    const session = pick<{ token: string; expiresAt: string }>(res.body, "session");
    const user = pick<HsvSsoUser>(res.body, "user");
    const completeness = pick<HsvCompleteness>(res.body, "profile");
    if (session && user && completeness) return { ok: true, token: session.token, expiresAt: session.expiresAt, user, completeness };
  }
  if (res.status === 401) return { ok: false, error: "INVALID_CREDENTIALS", message: "" };
  if (res.status === 423) return { ok: false, error: "BLOCKED", message: "" };
  if (res.status === 429) return { ok: false, error: "RATE_LIMITED", message: "" };
  return { ok: false, error: "UNAVAILABLE", message: UNAVAILABLE_MESSAGE };
}

export type SsoValidateResult =
  | { ok: true; user: HsvSsoUser; completeness: HsvCompleteness; expiresAt: string }
  | { ok: false; reason: "INVALID" | "BLOCKED" | "UNAVAILABLE" };

/** Kiem tra phien SSO (moi request, co cache ngan o auth/session.ts). 401 = het han/da dang xuat/khong hop le, 423 = tai khoan bi khoa/xoa mem. */
export async function hsvIdSsoValidate(token: string): Promise<SsoValidateResult> {
  const res = await call("/internal/sso/session/validate", { method: "POST", body: JSON.stringify({ token }) });
  if (!res) return { ok: false, reason: "UNAVAILABLE" };
  if (res.status === 200) {
    const session = pick<{ expiresAt: string }>(res.body, "session");
    const user = pick<HsvSsoUser>(res.body, "user");
    const completeness = pick<HsvCompleteness>(res.body, "profile");
    if (session && user && completeness) return { ok: true, user, completeness, expiresAt: session.expiresAt };
  }
  if (res.status === 401) return { ok: false, reason: "INVALID" };
  if (res.status === 423) return { ok: false, reason: "BLOCKED" };
  return { ok: false, reason: "UNAVAILABLE" };
}

/** Huy DUNG 1 phien (vd. phien vua cap nhung CMS tu choi tai khoan cuc bo) - khong dang xuat cac thiet bi/nen tang khac. */
export async function hsvIdSsoLogout(token: string): Promise<boolean> {
  const res = await call("/internal/sso/logout", { method: "POST", body: JSON.stringify({ token }) });
  return res?.status === 200;
}

/** "Dang xuat tat ca nen tang": huy MOI phien SSO cua nguoi dung (tu token hoac userId). */
export async function hsvIdSsoLogoutAll(target: { token: string } | { userId: string }): Promise<boolean> {
  const res = await call("/internal/sso/logout-all", { method: "POST", body: JSON.stringify(target) });
  return res?.status === 200;
}

export type HsvPositionLevel = "TRUNG_UONG" | "TINH" | "TRUONG";
export interface HsvProfilePositionRecord {
  id: string;
  position: string;
  organization: { id: string; name: string };
  at: string | null;
}
export interface HsvProfilePositionSlot {
  current: HsvProfilePositionRecord | null;
  others: HsvProfilePositionRecord[];
  pending: HsvProfilePositionRecord | null;
  rejected: (HsvProfilePositionRecord & { message: string | null }) | null;
}
/** Ho so DAY DU tu loi hsv-id: thong tin ca nhan + dia phuong + don vi + chuc vu 3 cap (kem trang thai duyet) + tu cach Hoi vien. */
export interface HsvProfile {
  hsvId: string;
  email: string | null;
  phone: string | null;
  fullName: string;
  avatarUrl: string | null;
  dateOfBirth: string | null; // yyyy-mm-dd
  gender: "MALE" | "FEMALE" | "OTHER" | null;
  subjectType: "STUDENT" | "STAFF" | null;
  locality: { id: string; name: string } | null;
  organization: { id: string; name: string; type: string | null; localityId: string | null } | null;
  organizationOther: string | null;
  provinceOrganization: { id: string; name: string } | null;
  positions: Record<HsvPositionLevel, HsvProfilePositionSlot>;
  membership: { isMember: boolean; confirmedAt: string | null };
  completeness: HsvCompleteness;
}

export interface HsvProfileOptions {
  localities: { id: string; name: string }[];
  organizations: { id: string; name: string; localityId: string | null; type: string | null }[];
  positions: Record<HsvPositionLevel, string[]>;
  genders: { value: "MALE" | "FEMALE" | "OTHER"; label: string }[];
  subjectTypes: { value: "STUDENT" | "STAFF"; label: string }[];
}

export type SsoProfileResult = { ok: true; profile: HsvProfile } | { ok: false; error: "UNAUTHENTICATED" | "UNAVAILABLE"; message: string };

/** Xem ho so cua CHINH nguoi giu token (hsv-id tu lay nguoi dung tu token). */
export async function hsvIdSsoProfile(token: string): Promise<SsoProfileResult> {
  const res = await call("/internal/sso/profile", { method: "POST", body: JSON.stringify({ token }) });
  if (!res) return { ok: false, error: "UNAVAILABLE", message: UNAVAILABLE_MESSAGE };
  if (res.status === 200) {
    const profile = pick<HsvProfile>(res.body, "profile");
    if (profile) return { ok: true, profile };
  }
  if (res.status === 401 || res.status === 423) return { ok: false, error: "UNAUTHENTICATED", message: "Phiên đăng nhập đã hết hạn." };
  return { ok: false, error: "UNAVAILABLE", message: "Không tải được hồ sơ, vui lòng thử lại sau." };
}

export interface HsvProfileChanges {
  fullName?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  subjectType?: "STUDENT" | "STAFF";
  localityId?: string | null;
  organizationId?: string | null;
  organizationOther?: string | null;
  positions?: Partial<Record<HsvPositionLevel, string | null>>;
}

export type SsoUpdateProfileResult =
  | { ok: true; profile: HsvProfile; changes: { positionsProposed: { level: HsvPositionLevel; position: string }[]; positionsWithdrawn: { level: HsvPositionLevel; position: string }[]; notices: string[] } }
  | { ok: false; error: string; message: string };

/** Sua ho so CUA CHINH NGUOI DUNG qua loi hsv-id (kiem tra theo danh muc; chuc vu = de xuat cho duyet o don vi dung cap). */
export async function hsvIdSsoUpdateProfile(token: string, changes: HsvProfileChanges): Promise<SsoUpdateProfileResult> {
  const res = await call("/internal/sso/profile/update", { method: "POST", body: JSON.stringify({ token, changes }) });
  if (!res) return { ok: false, error: "UNAVAILABLE", message: UNAVAILABLE_MESSAGE };
  if (res.status === 200) {
    const profile = pick<HsvProfile>(res.body, "profile");
    const changesOut = pick<{ positionsProposed: { level: HsvPositionLevel; position: string }[]; positionsWithdrawn: { level: HsvPositionLevel; position: string }[]; notices: string[] }>(res.body, "changes");
    if (profile && changesOut) return { ok: true, profile, changes: changesOut };
  }
  if (res.status === 401 || res.status === 423) return { ok: false, error: "UNAUTHENTICATED", message: "Phiên đăng nhập đã hết hạn." };
  return {
    ok: false,
    error: pick<string>(res.body, "error") ?? "VALIDATION_ERROR",
    message: res.status >= 500 ? UNAVAILABLE_MESSAGE : (pick<string>(res.body, "message") ?? "Không lưu được thông tin hồ sơ."),
  };
}

/** Danh muc cho form ho so (dia phuong, don vi, chuc vu theo 3 cap) - nguon DUY NHAT, CMS khong tu loc/ghep. */
export async function hsvIdProfileOptions(): Promise<HsvProfileOptions | null> {
  const res = await call("/internal/profile/options", { method: "GET" });
  if (res?.status !== 200) return null;
  return res.body as HsvProfileOptions;
}
