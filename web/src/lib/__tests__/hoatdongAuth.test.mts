import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildHoatdongAuthUrl, hoatdongBaseUrl, safeSitePath, shouldRedirectToHoatdong } from "@/lib/hoatdongAuth";

// Cổng đăng nhập/đăng ký chung (2026-10-07): Cổng thông tin chuyển đăng nhập/đăng ký cá nhân về Hoạt động kèm URL quay lại. Thuần, không DB/mạng.

const SITE = "https://hoisinhvien.com.vn";
const BASE = "https://hoatdong.hoisinhvien.com.vn";
const enc = encodeURIComponent;

describe("buildHoatdongAuthUrl", () => {
  test("đăng nhập: login-ca-nhan (cá nhân) + next = URL tuyệt đối của Cổng", () => {
    assert.equal(buildHoatdongAuthUrl("login", { siteUrl: SITE, nextPath: "/tai-khoan/the-hoi-vien?x=1" }), `${BASE}/login-ca-nhan?type=person&next=${enc(`${SITE}/tai-khoan/the-hoi-vien?x=1`)}`);
  });

  test("đăng ký: /dang-ky của Hoạt động; không có next -> trang chủ; gốc có dấu '/' thừa được cắt", () => {
    assert.equal(buildHoatdongAuthUrl("register", { siteUrl: `${SITE}/` }), `${BASE}/dang-ky?next=${enc(`${SITE}/`)}`);
  });

  test("HOATDONG_URL tuỳ chỉnh được dùng; giá trị hỏng -> mặc định", () => {
    assert.equal(hoatdongBaseUrl("https://hoatdong.staging.example.vn/"), "https://hoatdong.staging.example.vn");
    assert.equal(hoatdongBaseUrl("khong-phai-url"), BASE);
    assert.equal(hoatdongBaseUrl(undefined), BASE);
  });

  test("next xấu (open redirect) không bao giờ lọt vào URL trả về", () => {
    assert.equal(buildHoatdongAuthUrl("login", { siteUrl: SITE, nextPath: "//evil.com/x" }), `${BASE}/login-ca-nhan?type=person&next=${enc(`${SITE}/`)}`);
  });
});

describe("safeSitePath", () => {
  test("nhận đường dẫn trong Cổng; chặn //, \\, URL tuyệt đối, ký tự điều khiển, quá dài, không phải chuỗi", () => {
    assert.equal(safeSitePath("/tai-khoan"), "/tai-khoan");
    for (const bad of ["//evil.com", "https://evil.com", "javascript:alert(1)", "evil", "/\\evil.com", "/a\r\nb", `/${"a".repeat(1100)}`, "", undefined, null, 42]) {
      assert.equal(safeSitePath(bad), "/", String(bad));
    }
    assert.equal(safeSitePath("//x", "/tai-khoan"), "/tai-khoan");
  });
});

describe("shouldRedirectToHoatdong", () => {
  test("chỉ chuyển khi chưa có cookie SSO và không phải ?local=1", () => {
    assert.equal(shouldRedirectToHoatdong({ hasSsoCookie: false }), true);
    assert.equal(shouldRedirectToHoatdong({ hasSsoCookie: true }), false);
    assert.equal(shouldRedirectToHoatdong({ hasSsoCookie: false, local: true }), false);
  });
});
