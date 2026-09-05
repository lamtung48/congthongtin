import type { NavItem, FooterColumn, FooterLink } from "@/domain/homepage";

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

export const SITE_NAV: NavItem[] = [
  { label: "Trang chủ", href: "/" },
  { label: "Tin tức", href: "/tin-tuc" },
  { label: "Phong trào", href: "#", soon: true },
  { label: "Sinh viên 5 tốt", href: "/chu-de/sinh-vien-5-tot" },
  { label: "Hội nghị", href: "#", soon: true },
  { label: "Đào tạo", href: "#", soon: true },
  { label: "Giới thiệu", href: "#", soon: true },
];

export const SITE_FOOTER_COLUMNS: FooterColumn[] = [
  { title: "Về chúng tôi", items: [{ label: "Giới thiệu Hội" }, { label: "Điều lệ Hội" }, { label: "Ban Thư ký Trung ương" }, { label: "Liên hệ" }] },
  { title: "Nội dung", items: [{ label: "Tin tức", href: "/tin-tuc" }, { label: "Phong trào" }, { label: "Sinh viên 5 tốt", href: "/chu-de/sinh-vien-5-tot" }, { label: "Văn bản — hướng dẫn" }] },
  { title: "Nền tảng số", items: [{ label: "Hội nghị" }, { label: "Đào tạo" }, { label: "Tình nguyện" }, { label: "Dữ liệu & báo cáo" }] },
  { title: "Hỗ trợ", items: [{ label: "Hướng dẫn sử dụng" }, { label: "Câu hỏi thường gặp" }, { label: "Góp ý nội dung" }, { label: "Báo lỗi" }] },
];

export const SITE_FOOTER_SOCIALS = ["Facebook", "YouTube", "TikTok", "Zalo"];

export const SITE_FOOTER_POLICIES: FooterLink[] = [
  { label: "Điều khoản sử dụng" },
  { label: "Chính sách dữ liệu cá nhân" },
];

export const SITE_FOOTER_ORG_NAME = "Hội Sinh viên Việt Nam";
export const SITE_FOOTER_ORG_DESCRIPTION = "Cổng thông tin số của Trung ương Hội Sinh viên Việt Nam.";
export const SITE_FOOTER_ADDRESS = "62 Bà Triệu, Hoàn Kiếm, Hà Nội";
export const SITE_FOOTER_CONTACT_NOTE = "Điện thoại và email liên hệ chờ xác nhận từ Văn phòng Trung ương Hội";
export const SITE_FOOTER_COPYRIGHT_LINE = "© 2026 Hội Sinh viên Việt Nam";
export const SITE_FOOTER_GOVERNING_BODY_LINE = "Cơ quan chủ quản: Trung ương Hội Sinh viên Việt Nam";
