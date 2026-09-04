import type { Platform } from "@/domain/platform";

/**
 * Prototype fixture. Each platform's `status` used to be a literal argument
 * passed at the `EcosystemBento` call site (`conferencePlatform("live")`,
 * `volunteerPlatform("open")`, `dataPlatform("soon")`) — an audit-flagged
 * inconsistency, since that's content, not UI code. It now lives here; the
 * per-status copy (CTA label, note text, badge) is still built by
 * `buildPlatformView` in `src/lib/view/platformView.ts`, unchanged from the
 * original per-category functions.
 */
export const PLATFORMS: Platform[] = [
  {
    id: "hoi-nghi",
    slug: "hoi-nghi",
    name: "Nền tảng Hội nghị",
    url: "#",
    description: "Điểm danh đại biểu, tài liệu phiên họp, góp ý và biểu quyết trực tuyến.",
    category: "conference",
    status: "live",
    accessLevel: "Cần đăng nhập tài khoản đại biểu",
    liveActivityNote: "Hội nghị Ban Chấp hành Trung ương Hội lần thứ 3 — phiên biểu quyết đang mở",
  },
  {
    id: "dao-tao",
    slug: "dao-tao",
    name: "Nền tảng Đào tạo",
    url: "#",
    description: "Bồi dưỡng cán bộ Hội, học liệu và chứng nhận điện tử.",
    category: "training",
    status: "active",
    accessLevel: "Cần đăng nhập cán bộ Hội",
    metric: "14 khoá đang mở",
  },
  {
    id: "sv5tot",
    slug: "sinh-vien-5-tot",
    name: "Sinh viên 5 tốt",
    url: "/chu-de/sinh-vien-5-tot",
    description: "Đăng ký, theo dõi hồ sơ và tra cứu danh hiệu.",
    category: "sv5tot",
    status: "active",
    accessLevel: "Cần đăng nhập sinh viên",
  },
  {
    id: "tinh-nguyen",
    slug: "tinh-nguyen",
    name: "Tình nguyện",
    url: "#",
    description: "Chiến dịch, chấm công tình nguyện và báo cáo công trình.",
    category: "volunteer",
    status: "open",
    accessLevel: "Cần đăng nhập sinh viên",
  },
  {
    id: "du-lieu",
    slug: "du-lieu",
    name: "Dữ liệu & Báo cáo",
    url: "#",
    description: "Số liệu phong trào theo tỉnh, thành và nhà trường.",
    category: "data",
    status: "soon",
    accessLevel: "Quyền truy cập sẽ công bố khi mở nền tảng",
  },
];
