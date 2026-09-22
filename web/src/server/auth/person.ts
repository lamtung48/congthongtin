import "server-only";
import { redirect } from "next/navigation";
import { getSession, getSsoIdentity, type SessionUser } from "@/server/auth/session";

/**
 * The PERSONAL side of sign-in (docs/AUTHENTICATION.md, "Hai luồng đăng
 * nhập"). A personal session is nothing more than a valid shared SSO session
 * at `hsv-id` — the same `hsv_sso` cookie Hoạt động and Đào tạo use, so
 * signing in on any of them signs you in here and vice versa. It needs NO
 * local `User` row and never creates one: ordinary accounts are not CMS
 * accounts. The editorial side (`getSession`/`requireSession`) is the SSO
 * session PLUS a linked, active local `User` with a CMS role.
 */

export interface Person {
  hsvId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  /** Set when this person also has an active CMS (Ban biên tập) account. */
  editor: SessionUser | null;
}

export async function getPerson(): Promise<Person | null> {
  const identity = await getSsoIdentity();
  if (!identity.ok) return null;
  const editor = await getSession();
  return {
    hsvId: identity.user.id,
    fullName: identity.user.fullName || identity.user.email || identity.user.phone || "Tài khoản HSV",
    email: identity.user.email,
    phone: identity.user.phone,
    editor,
  };
}

/** Only same-site paths are followed after sign-in (never `//host` or an absolute URL — no open redirect). */
export function safeNextPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}

/** Personal pages (`/tai-khoan/*`): signed-out visitors go to the personal sign-in and come back afterwards. */
export async function requirePerson(returnTo: string): Promise<Person> {
  const person = await getPerson();
  if (person) return person;
  redirect(`/dang-nhap?next=${encodeURIComponent(safeNextPath(returnTo))}`);
}
