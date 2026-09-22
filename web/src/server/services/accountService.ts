import "server-only";
import type { MembershipCardPayload } from "@/domain/account";
import { hsvIdSsoProfile, type HsvProfile, type HsvSsoUser, type SsoProfileResult } from "@/server/integrations/hsvId";
import { hoatdongGetMemberCardView, hoatdongPublicUrl } from "@/server/integrations/hoatdong";

/**
 * The personal account's data in one place: the shared profile (`hsv-id`)
 * and the Thẻ Hội viên (Hoạt động), fetched in parallel. Used by
 * `GET /api/me/membership-card` (header account panel) and the `/tai-khoan`
 * page so both say the same thing. When `hsv-id` can't return the profile
 * the SSO identity still supplies the name.
 */
export async function loadPersonalAccount(identity: HsvSsoUser, token: string): Promise<{ profileResult: SsoProfileResult; profile: HsvProfile | null; card: MembershipCardPayload }> {
  const [profileResult, cardResult] = await Promise.all([hsvIdSsoProfile(token), hoatdongGetMemberCardView(identity.id)]);
  const profile = profileResult.ok ? profileResult.profile : null;
  const view = cardResult?.view ?? null;
  const publicUrl = hoatdongPublicUrl();
  return {
    profileResult,
    profile,
    card: {
      fullName: profile?.fullName || identity.fullName,
      login: profile?.email ?? identity.email ?? identity.phone,
      organizationName: profile?.organization?.name ?? profile?.organizationOther ?? null,
      isMember: profile?.membership.isMember ?? false,
      card: view,
      cardState: view ? "ok" : cardResult ? "not_issued" : "unavailable",
      qrSrc: view && publicUrl ? `${publicUrl}/the-thanh-vien/${view.card.verifyToken}/qr` : null,
      shareUrl: view && publicUrl ? `${publicUrl}/the-thanh-vien/${view.card.verifyToken}` : null,
      fileName: view ? `the-hoi-vien-${view.card.hsvNumber ?? "hsv"}.png` : null,
    },
  };
}
