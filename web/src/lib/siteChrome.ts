import type { NavItem, FooterColumn, SocialLink } from "@/domain/homepage";
import { categoryHref } from "@/lib/routes";

/**
 * Site-wide chrome — the nav menu and footer — that both `FixtureProvider`
 * and `DatabaseProvider` (`src/data-access/providers/`) share unchanged.
 * Unlike Article/Video/Event/Platform/Gallery, this has no `HomepageConfiguration`-
 * style table in `prisma/schema.prisma` (see docs/DATABASE_SCHEMA.md,
 * "Homepage configuration & fallback" — that model covers the eight content
 * *sections*, not the surrounding nav/footer chrome) — it's genuinely static
 * site configuration, not content a CMS role edits, so it lives here rather
 * than behind either provider's own data source. Moved out of
 * `data-access/fixtures/homepage.ts` (which now holds only the Hero
 * *fixture* — fake content `FixtureProvider` alone still uses) specifically
 * so `DatabaseProvider` never has to import from `data-access/fixtures/**`,
 * a boundary `FixtureProvider`'s own header comment already asserts only it
 * may cross.
 */

export const HOI_NGHI_URL = "https://hoinghi.hoisinhvien.com.vn";
export const DAO_TAO_URL = "https://daotao.hoisinhvien.com.vn";
export const HOAT_DONG_URL = "https://hoatdong.hoisinhvien.com.vn";

/**
 * The three ecosystem platforms the header keeps as small quick-access
 * buttons (and the account panel lists). Static chrome, like the nav: the
 * homepage launchpad under the Hero reads the live `Platform` registry
 * instead, so an Admin disabling a platform hides its big card there while
 * this shortcut stays. `sso` = shares the `hsv_sso` cookie with this portal
 * (signed in here → already signed in there); Hội nghị is not on SSO yet.
 */
export interface EcosystemLink {
  key: "activity" | "training" | "conference";
  label: string;
  href: string;
  hint: string;
  sso: boolean;
}

export const ECOSYSTEM_LINKS: EcosystemLink[] = [
  { key: "activity", label: "Hoạt động", href: HOAT_DONG_URL, hint: "Đăng ký hoạt động, điểm danh QR, Thẻ Hội viên", sso: true },
  { key: "training", label: "Đào tạo", href: DAO_TAO_URL, hint: "Khoá học, bài kiểm tra, chứng nhận điện tử", sso: true },
  { key: "conference", label: "Hội nghị", href: HOI_NGHI_URL, hint: "Điểm danh đại biểu, tài liệu, biểu quyết", sso: false },
];

/**
 * Trang chủ chung của Hội Sinh viên Việt Nam — trang "mẹ" của cổng này
 * (cổng thông tin số chạy trên tên miền con `congthongtin.`). Hai tên miền
 * là hai lối vào của cùng một trang, nên cả hai đều được nêu ra thay vì
 * ngầm coi một cái là chính: người dùng vẫn gõ cả `.vn` lẫn `.com.vn`.
 */
/**
 * "Phong trào" và "Sinh viên 5 tốt" trước là hai mục riêng — một mục chưa có
 * trang (`soon`) và một mục trỏ sang trang chủ đề. Gộp thành một chuyên mục
 * thật (migration `20260908090000_merge_phong_trao_sv5t`), nên liên kết nay
 * trỏ vào trang chuyên mục có nội dung thay vì trang chủ đề chỉ có một bài.
 */
export const PHONG_TRAO_SV5T_SLUG = "phong-trao-sinh-vien-5-tot";
export const PHONG_TRAO_SV5T_LABEL = "Phong trào Sinh viên 5 tốt";

export const HSV_PORTAL_URL = "https://hoisinhvien.com.vn";
export const HSV_PORTAL_ALT_URL = "https://hoisinhvien.vn";

export const SITE_NAV: NavItem[] = [
  { label: "Trang chủ", href: "/" },
  { label: "Tin tức", href: "/tin-tuc" },
  { label: PHONG_TRAO_SV5T_LABEL, href: categoryHref(PHONG_TRAO_SV5T_SLUG) },
  { label: "Tài liệu", href: "/tai-lieu" },
  // Hoạt động / Đào tạo / Hội nghị are not text links here any more: the
  // header renders them as small platform buttons (ECOSYSTEM_LINKS above).
  { label: "Giới thiệu", href: "#", soon: true },
];

export const SITE_FOOTER_COLUMNS: FooterColumn[] = [
  {
    title: "Về chúng tôi",
    items: [
      { label: "Trang chủ hoisinhvien.com.vn", href: HSV_PORTAL_URL, external: true },
      { label: "Trang chủ hoisinhvien.vn", href: HSV_PORTAL_ALT_URL, external: true },
      { label: "Giới thiệu Hội" },
      { label: "Điều lệ Hội" },
      { label: "Ban Thư ký Trung ương" },
      { label: "Liên hệ" },
    ],
  },
  { title: "Nội dung", items: [{ label: "Tin tức", href: "/tin-tuc" }, { label: PHONG_TRAO_SV5T_LABEL, href: categoryHref(PHONG_TRAO_SV5T_SLUG) }, { label: "Tài liệu", href: "/tai-lieu" }] },
  { title: "Nền tảng số", items: [{ label: "Hoạt động", href: HOAT_DONG_URL, external: true }, { label: "Đào tạo", href: DAO_TAO_URL, external: true }, { label: "Hội nghị", href: HOI_NGHI_URL, external: true }, { label: "Tài khoản cá nhân", href: "/tai-khoan" }] },
  { title: "Hỗ trợ", items: [{ label: "Hướng dẫn sử dụng" }, { label: "Câu hỏi thường gặp" }, { label: "Góp ý nội dung" }, { label: "Báo lỗi" }] },
];

/** Tài khoản chính thức của Trung ương Hội. Zalo bị bỏ khỏi danh sách vì
 *  chưa có địa chỉ thật — một dòng chữ "Zalo" không bấm được thì không phải
 *  là một liên kết, chỉ là chỗ trống. */
/** Kênh YouTube chính thức — cũng là nút "Đăng ký kênh" ở mục Video trang chủ. */
export const YOUTUBE_CHANNEL_URL = "https://youtube.com/@hoisinhvienvietnam7228";

export const SITE_FOOTER_SOCIALS: SocialLink[] = [
  { name: "Facebook", url: "https://facebook.com/hoisinhvien.com.vn" },
  { name: "YouTube", url: YOUTUBE_CHANNEL_URL },
  { name: "TikTok", url: "https://tiktok.com/@hoisinhvienvietnam" },
];

export const SITE_FOOTER_ORG_NAME = "Hội Sinh viên Việt Nam";
export const SITE_FOOTER_ORG_DESCRIPTION = "Cổng thông tin số của Trung ương Hội Sinh viên Việt Nam.";
export const SITE_FOOTER_ADDRESS = "62 Bà Triệu, Hoàn Kiếm, Hà Nội";
export const SITE_FOOTER_CONTACT_EMAIL = "vanphonghsvvn@gmail.com";
export const SITE_FOOTER_COPYRIGHT_LINE = "© 2026 Hội Sinh viên Việt Nam";
export const SITE_FOOTER_GOVERNING_BODY_LINE = "Cơ quan chủ quản: Trung ương Hội Sinh viên Việt Nam";
