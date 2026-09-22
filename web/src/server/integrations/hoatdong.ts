import "server-only";
import type { MemberCardView } from "@hsv/membership-card";

/**
 * Client for the Hoạt động platform (/opt/hoatdong, hoatdong.hoisinhvien.com.vn)
 * — the only place the Thẻ Hội viên data (rank, points, badges, titles) lives.
 * Same contract Đào tạo uses (daotaohsv `src/lib/hoatdong.ts`): the internal
 * endpoint `GET /api/internal/member-card/:hsvId`, authenticated with
 * `X-Training-Key`, reachable only on the docker network (`edge`).
 *
 * Graceful-degrade like `hsvId.ts`: missing config or a network error returns
 * `null` and logs — the account panel/page then simply hides the card; it
 * never errors the page.
 *
 * Config: HOATDONG_URL (internal, e.g. http://hoatdong-hsv-app:3000),
 * HOATDONG_TRAINING_KEY (shared with Đào tạo), HOATDONG_PUBLIC_URL (public
 * origin, for the card's QR / share link / image).
 */

const HOATDONG_URL = process.env.HOATDONG_URL;
const HOATDONG_TRAINING_KEY = process.env.HOATDONG_TRAINING_KEY;

export function hoatdongPublicUrl(): string | null {
  return process.env.HOATDONG_PUBLIC_URL?.replace(/\/$/, "") || null;
}

export type MemberCardResult = { view: MemberCardView | null; hsvIdAvailable: boolean };

/** `view: null` = this person has not been issued a card yet (not eligible); `null` = Hoạt động unreachable / not configured. */
export async function hoatdongGetMemberCardView(hsvId: string): Promise<MemberCardResult | null> {
  if (!HOATDONG_URL || !HOATDONG_TRAINING_KEY) return null;
  try {
    const res = await fetch(`${HOATDONG_URL}/api/internal/member-card/${encodeURIComponent(hsvId)}`, {
      headers: { "X-Training-Key": HOATDONG_TRAINING_KEY },
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (res.status !== 200) return null;
    return (await res.json()) as MemberCardResult;
  } catch (err) {
    console.error("[hoatdong] đọc Thẻ Hội viên thất bại:", err);
    return null;
  }
}

/**
 * The card as a PNG, rendered by Hoạt động's public route
 * (`/the-thanh-vien/:token/card-image` — the same image its share preview
 * uses). Called on the internal URL while presenting the public host/proto so
 * the QR printed on the image points at the public verification page.
 */
export async function hoatdongFetchCardImage(verifyToken: string): Promise<Response | null> {
  const publicUrl = hoatdongPublicUrl();
  if (!HOATDONG_URL || !publicUrl) return null;
  try {
    const { host, protocol } = new URL(publicUrl);
    const res = await fetch(`${HOATDONG_URL}/the-thanh-vien/${encodeURIComponent(verifyToken)}/card-image`, {
      headers: { "x-forwarded-host": host, "x-forwarded-proto": protocol.replace(":", "") },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    return res.ok && res.body ? res : null;
  } catch (err) {
    console.error("[hoatdong] lấy ảnh thẻ thất bại:", err);
    return null;
  }
}
