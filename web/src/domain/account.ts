import type { MemberCardView } from "@hsv/membership-card";

/** `GET /api/me/membership-card` — the signed-in person's own card + the profile facts the account panel shows. */
export interface MembershipCardPayload {
  fullName: string;
  login: string | null;
  organizationName: string | null;
  isMember: boolean;
  card: MemberCardView | null;
  /** Why there is no card: not issued yet (not eligible) vs Hoạt động unreachable. */
  cardState: "ok" | "not_issued" | "unavailable";
  qrSrc: string | null;
  shareUrl: string | null;
  fileName: string | null;
}
