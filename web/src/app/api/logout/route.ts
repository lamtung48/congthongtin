import { NextResponse } from "next/server";
import { authService } from "@/server/services/authService";

/**
 * Sign-out for the public site's header menu. `authService.logout()` deletes
 * the `Session` row and clears the `admin_session` cookie (and writes the
 * LOGOUT audit entry). The `/admin` area has its own `logoutAction` Server
 * Action that redirects to `/admin/login`; this one just clears state and
 * lets the client stay on the public page it's on.
 */
export const dynamic = "force-dynamic";

export async function POST() {
  await authService.logout();
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
