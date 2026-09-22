import { NextResponse } from "next/server";
import { getSessionToken, getSsoIdentity } from "@/server/auth/session";
import { loadPersonalAccount } from "@/server/services/accountService";

/**
 * The signed-in person's own Thẻ Hội viên + the few profile facts the
 * account panel shows (header → click your name). Personal session only
 * (shared SSO) — no CMS account needed. Card data comes from Hoạt động (the
 * only place it exists), identity/profile from `hsv-id`. Never email/phone
 * on the card itself; `login` is shown to the owner only, in the panel.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const identity = await getSsoIdentity();
  const token = await getSessionToken();
  if (!identity.ok || !token) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const { card } = await loadPersonalAccount(identity.user, token);
  return NextResponse.json(card, { headers: { "Cache-Control": "private, no-store" } });
}
