import type { NavItem, FooterColumn, FooterLink, HeroContent, SearchSuggestion } from "@/domain/homepage";
import { articleHref } from "@/lib/routes";

export const NAV: NavItem[] = [
  { label: "Trang chủ", href: "/" },
  { label: "Tin tức", href: "/tin-tuc" },
  { label: "Phong trào", href: "#", soon: true },
  { label: "Sinh viên 5 tốt", href: "/chu-de/sinh-vien-5-tot" },
  { label: "Hội nghị", href: "#", soon: true },
  { label: "Đào tạo", href: "#", soon: true },
  { label: "Giới thiệu", href: "#", soon: true },
];

const HERO_SLUG = "dai-hoi-xii-khai-mac";

/** Prototype fixture. Used to be hardcoded directly in `Hero.tsx` JSX (an
 *  audit-flagged inconsistency with every other section, which reads its
 *  copy from data) — now sourced the same way as the rest of the homepage. */
export const HERO: HeroContent = {
  eyebrow: "Đại hội XII",
  headline: "Đại hội đại biểu toàn quốc Hội Sinh viên Việt Nam lần thứ XII",
  headlineAccent: "khai mạc tại Hà Nội",
  lead: "Hơn 700 đại biểu đại diện cho sinh viên cả nước và du học sinh Việt Nam ở nước ngoài thảo luận phương hướng công tác Hội nhiệm kỳ 2026 – 2031.",
  author: { id: "ban-bien-tap", name: "Ban Biên tập" },
  readingTimeMinutes: 6,
  topicLabel: "Chuyên đề Đại hội",
  publishedAt: "2026-09-02T07:40:00",
  articleUrl: articleHref(HERO_SLUG),
  secondaryCtaLabel: "Chuyên đề Đại hội XII",
  secondaryCtaHref: "/chu-de/dai-hoi-xii",
  media: {
    id: "hero-media",
    provider: "drive",
    type: "image",
    status: "missing",
    placeholder: "Ảnh phiên khai mạc Đại hội XII — ngang, tối thiểu 2400px",
    alt: "Đại hội đại biểu toàn quốc Hội Sinh viên Việt Nam lần thứ XII khai mạc tại Hà Nội",
    metadata: { locationLabel: "Trung tâm Hội nghị Quốc gia, Hà Nội" },
  },
};

export const FOOTER_COLUMNS: FooterColumn[] = [
  { title: "Về chúng tôi", items: [{ label: "Giới thiệu Hội" }, { label: "Điều lệ Hội" }, { label: "Ban Thư ký Trung ương" }, { label: "Liên hệ" }] },
  { title: "Nội dung", items: [{ label: "Tin tức", href: "/tin-tuc" }, { label: "Phong trào" }, { label: "Sinh viên 5 tốt", href: "/chu-de/sinh-vien-5-tot" }, { label: "Văn bản — hướng dẫn" }] },
  { title: "Nền tảng số", items: [{ label: "Hội nghị" }, { label: "Đào tạo" }, { label: "Tình nguyện" }, { label: "Dữ liệu & báo cáo" }] },
  { title: "Hỗ trợ", items: [{ label: "Hướng dẫn sử dụng" }, { label: "Câu hỏi thường gặp" }, { label: "Góp ý nội dung" }, { label: "Báo lỗi" }] },
];

export const FOOTER_SOCIALS = ["Facebook", "YouTube", "TikTok", "Zalo"];

export const FOOTER_POLICIES: FooterLink[] = [
  { label: "Điều khoản sử dụng" },
  { label: "Chính sách dữ liệu cá nhân" },
];

export const FOOTER_ORG_NAME = "Hội Sinh viên Việt Nam";
export const FOOTER_ORG_DESCRIPTION = "Cổng thông tin số của Trung ương Hội Sinh viên Việt Nam.";
export const FOOTER_ADDRESS = "62 Bà Triệu, Hoàn Kiếm, Hà Nội";
export const FOOTER_CONTACT_NOTE = "Điện thoại và email liên hệ chờ xác nhận từ Văn phòng Trung ương Hội";
export const FOOTER_COPYRIGHT_LINE = "© 2026 Hội Sinh viên Việt Nam";
export const FOOTER_GOVERNING_BODY_LINE = "Cơ quan chủ quản: Trung ương Hội Sinh viên Việt Nam";

interface RawSearchCorpusItem {
  title: string;
  category: string;
  date: string;
}

const RAW_SEARCH_CORPUS: RawSearchCorpusItem[] = [
  { title: "Đại hội đại biểu toàn quốc Hội Sinh viên Việt Nam lần thứ XII khai mạc tại Hà Nội", category: "Đại hội XII", date: "2026-09-02" },
  { title: "Tuyên dương 112 “Sinh viên 5 tốt” cấp Trung ương", category: "Sinh viên 5 tốt", date: "2026-08-31" },
  { title: "Hướng dẫn tiêu chuẩn xét chọn “Sinh viên 5 tốt” năm học 2026 – 2027", category: "Văn bản", date: "2026-08-30" },
  { title: "Chiến dịch “Mùa hè xanh” 2026 hoàn thành 148 công trình dân sinh", category: "Tình nguyện", date: "2026-09-02" },
  { title: "Diễn đàn sinh viên Việt Nam tại châu Âu lần thứ 9 mở đăng ký", category: "Hội nhập", date: "2026-08-29" },
  { title: "Trạm quan trắc không khí do sinh viên chế tạo đặt tại 12 trường phổ thông", category: "Nghiên cứu", date: "2026-09-01" },
];

export const SEARCH_CORPUS: SearchSuggestion[] = RAW_SEARCH_CORPUS.map((r) => ({
  title: r.title,
  category: r.category,
  publishedAt: r.date,
}));
