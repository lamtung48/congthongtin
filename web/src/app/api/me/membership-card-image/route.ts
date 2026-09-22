import { NextResponse } from "next/server";
import { getSsoIdentity } from "@/server/auth/session";
import { hoatdongFetchCardImage, hoatdongGetMemberCardView } from "@/server/integrations/hoatdong";

/**
 * PNG of the signed-in person's OWN Thẻ Hội viên ("Tải ảnh thẻ"). The verify
 * token is looked up server-side from their own hsv-id — never taken from
 * the request — so nobody can fetch another member's card through here.
 * The image itself is rendered by Hoạt động.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const identity = await getSsoIdentity();
  if (!identity.ok) return NextResponse.json({ error: "Phiên đăng nhập đã hết hạn." }, { status: 401 });

  const card = await hoatdongGetMemberCardView(identity.user.id);
  if (!card) return NextResponse.json({ error: "Không kết nối được nền tảng Hoạt động, vui lòng thử lại sau." }, { status: 503 });
  if (!card.view) return NextResponse.json({ error: "Bạn chưa được cấp Thẻ Hội viên." }, { status: 404 });

  const image = await hoatdongFetchCardImage(card.view.card.verifyToken);
  if (!image) return NextResponse.json({ error: "Không tạo được ảnh thẻ, vui lòng thử lại sau." }, { status: 502 });

  const fileName = `the-hoi-vien-${card.view.card.hsvNumber ?? "hsv"}.png`;
  return new Response(image.body, {
    status: 200,
    headers: {
      "Content-Type": image.headers.get("content-type") ?? "image/png",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
