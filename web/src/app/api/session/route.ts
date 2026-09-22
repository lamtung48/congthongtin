import { NextResponse } from "next/server";
import { getPerson } from "@/server/auth/person";
import { ROLE_LABELS } from "@/server/auth/permissions";

/**
 * Personalises the otherwise-static public header. The public `(site)` tree
 * is ISR (`revalidate = 60`) and must stay that way (docs/PRODUCTION_DATA.md),
 * so the header can't read the session on the server without forcing the
 * whole site dynamic. Instead `Header.tsx` calls this per-visitor endpoint
 * on mount and swaps the "Đăng nhập" pill for the signed-in person's name.
 *
 * `user` = anyone with a valid shared SSO session (personal account — also
 * signed in by Hoạt động / Đào tạo). `editorRole` is set only when that
 * person also has an active CMS account (Ban biên tập). Returns only what
 * the header renders — never the email/id. Never cached.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const person = await getPerson();
  const body = person
    ? { user: { displayName: person.fullName, editorRole: person.editor ? ROLE_LABELS[person.editor.role] : null } }
    : { user: null };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
