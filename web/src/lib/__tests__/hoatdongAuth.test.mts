import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildHoatdongAuthUrl, cameFromHoatdong, hoatdongBaseUrl, safeSitePath, shouldRedirectToHoatdong } from "@/lib/hoatdongAuth";

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
    // Mặc định: địa chỉ CÔNG KHAI thắng địa chỉ nội bộ (prod đặt HOATDONG_URL=http://hoatdong-hsv-app:3000).
    const saved = { pub: process.env.HOATDONG_PUBLIC_URL, internal: process.env.HOATDONG_URL };
    try {
      process.env.HOATDONG_URL = "http://hoatdong-hsv-app:3000";
      process.env.HOATDONG_PUBLIC_URL = "https://hoatdong.hoisinhvien.com.vn";
      assert.equal(hoatdongBaseUrl(), "https://hoatdong.hoisinhvien.com.vn");
    } finally {
      if (saved.pub === undefined) delete process.env.HOATDONG_PUBLIC_URL; else process.env.HOATDONG_PUBLIC_URL = saved.pub;
      if (saved.internal === undefined) delete process.env.HOATDONG_URL; else process.env.HOATDONG_URL = saved.internal;
    }
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

describe("shouldRedirectToHoatdong: LUÔN mở Hoạt động, trừ local=1 và vừa từ Hoạt động quay về", () => {
  test("mặc định chuyển (không còn ngoại lệ theo cookie SSO)", () => {
    assert.equal(shouldRedirectToHoatdong({}), true);
  });
  test("?local=1 hoặc vừa từ Hoạt động quay về -> không chuyển (cửa thoát / tránh vòng lặp)", () => {
    assert.equal(shouldRedirectToHoatdong({ local: true }), false);
    assert.equal(shouldRedirectToHoatdong({ cameFromHoatdong: true }), false);
  });
});

describe("cameFromHoatdong", () => {
  test("Referer cùng tên miền Hoạt động -> true; thiếu/khác/rác/giả mạo hậu tố -> false", () => {
    assert.equal(cameFromHoatdong("https://hoatdong.hoisinhvien.com.vn/", BASE), true);
    assert.equal(cameFromHoatdong("https://hoatdong.hoisinhvien.com.vn/tiep-tuc?next=x", BASE), true);
    assert.equal(cameFromHoatdong(null, BASE), false);
    assert.equal(cameFromHoatdong("https://hoisinhvien.com.vn/tai-khoan", BASE), false);
    assert.equal(cameFromHoatdong("https://hoatdong.hoisinhvien.com.vn.evil.example/", BASE), false);
    assert.equal(cameFromHoatdong("khong-phai-url", BASE), false);
  });
});

describe("quên mật khẩu liên thông", () => {
  test("buildHoatdongAuthUrl('forgot'): /quen-mat-khau của Hoạt động + next tuyệt đối; next xấu bị chặn", () => {
    assert.equal(buildHoatdongAuthUrl("forgot", { siteUrl: `${SITE}/` }), `${BASE}/quen-mat-khau?next=${enc(`${SITE}/`)}`);
    assert.equal(buildHoatdongAuthUrl("forgot", { siteUrl: SITE, nextPath: "/tai-khoan" }), `${BASE}/quen-mat-khau?next=${enc(`${SITE}/tai-khoan`)}`);
    assert.equal(buildHoatdongAuthUrl("forgot", { siteUrl: SITE, nextPath: "//evil.com" }), `${BASE}/quen-mat-khau?next=${enc(`${SITE}/`)}`);
  });
});
