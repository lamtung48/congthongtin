/**
 * "Cổng đăng nhập/đăng ký chung" (yêu cầu 2026-10-07): đăng nhập / đăng ký TÀI KHOẢN CÁ NHÂN của Cổng thông tin chuyển sang nền tảng Hoạt động kèm
 * `next` = trang của Cổng cần quay lại. Hoạt động làm hết việc (đăng nhập, hoàn thiện hồ sơ, câu hỏi Hội viên...) rồi trả người dùng về đây; cookie SSO
 * `hsv_sso` dùng chung tên miền cha nên Cổng nhận ra phiên ngay. Luồng "Ban biên tập" (tài khoản CMS) KHÔNG đổi. File thuần (không server-only, không DB).
 */
import { HOAT_DONG_URL } from "@/lib/siteChrome";

export type HoatdongAuthKind = "login" | "register" | "forgot";

/** Chỉ đường dẫn TRONG Cổng ("/..." — không "//", không "\\", không ký tự điều khiển); còn lại về `fallback`. */
export function safeSitePath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  const v = value.trim();
  if (!v.startsWith("/") || v.startsWith("//") || v.length > 1000) return fallback;
  for (let i = 0; i < v.length; i++) {
    const c = v.charCodeAt(i);
    if (c <= 0x1f || c === 0x7f || c === 0x5c) return fallback;
  }
  return v;
}

/** Địa chỉ gốc Hoạt động DÙNG CHO TRÌNH DUYỆT. Ưu tiên HOATDONG_PUBLIC_URL: HOATDONG_URL trên prod là địa chỉ NỘI BỘ (http://hoatdong-hsv-app:3000) —
 * chuyển hướng người dùng tới đó sẽ không vào được. */
export function hoatdongBaseUrl(env: string | undefined = process.env.HOATDONG_PUBLIC_URL || process.env.HOATDONG_URL): string {
  const value = env?.trim();
  return (value && /^https?:\/\//.test(value) ? value : HOAT_DONG_URL).replace(/\/+$/, "");
}

/** URL đăng nhập/đăng ký của Hoạt động; `next` = URL TUYỆT ĐỐI của trang Cổng cần quay lại (Hoạt động chỉ nhận tên miền *.hoisinhvien.com.vn). */
export function buildHoatdongAuthUrl(kind: HoatdongAuthKind, opts: { siteUrl: string; nextPath?: unknown; hoatdongUrl?: string }): string {
  const base = opts.hoatdongUrl ?? hoatdongBaseUrl();
  const next = `${opts.siteUrl.replace(/\/+$/, "")}${safeSitePath(opts.nextPath)}`;
  const q = `next=${encodeURIComponent(next)}`;
  if (kind === "login") return `${base}/login-ca-nhan?type=person&${q}`;
  if (kind === "forgot") return `${base}/quen-mat-khau?${q}`; // Hoạt động gửi link đặt lại -> đổi xong đăng nhập -> /tiep-tuc trả về `next`
  return `${base}/dang-ky?${q}`;
}

/** Chỉ chuyển khi CHƯA có cookie SSO (chưa đăng nhập ở đâu cả). Đã có cookie mà vẫn vào trang này -> giữ form cũ, tránh vòng chuyển hướng qua lại.
 *  `?local=1` = cửa thoát khi Hoạt động gián đoạn. */
export function shouldRedirectToHoatdong(input: { hasSsoCookie: boolean; local?: boolean }): boolean {
  return !input.hasSsoCookie && !input.local;
}
