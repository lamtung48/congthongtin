import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { ROLE_LABELS } from "@/server/auth/permissions";

/**
 * Personalises the otherwise-static public header. The public `(site)` tree
 * is ISR (`revalidate = 60`) and must stay that way (docs/PRODUCTION_DATA.md),
 * so the header can't read the session on the server without forcing the
 * whole site dynamic. Instead `Header.tsx` calls this per-visitor endpoint
 * on mount and swaps the "Đăng nhập" pill for the signed-in user's name.
 *
 * Returns only what the header renders — never the email/id. Never cached.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  const body = session
    ? { user: { displayName: session.displayName, roleLabel: ROLE_LABELS[session.role] } }
    : { user: null };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
