export type ConferenceStatus = "live" | "active" | "maintenance";
export type VolunteerStatus = "open" | "maintenance" | "unavailable";
export type DataPlatformStatus = "soon" | "active";

export interface PlatformView {
  id: string;
  name: string;
  url: string;
  desc: string;
  cta: string;
  access: string;
  note?: string;
  hasCta: boolean;
  metric?: string;
  activity?: string;
}

export function conferencePlatform(status: ConferenceStatus): PlatformView & {
  isLive: boolean;
  isActive: boolean;
  isMaint: boolean;
} {
  return {
    id: "hoi-nghi",
    name: "Nền tảng Hội nghị",
    url: "#",
    desc: "Điểm danh đại biểu, tài liệu phiên họp, góp ý và biểu quyết trực tuyến.",
    activity: "Hội nghị Ban Chấp hành Trung ương Hội lần thứ 3 — phiên biểu quyết đang mở",
    isLive: status === "live",
    isActive: status === "active",
    isMaint: status === "maintenance",
    hasCta: status !== "maintenance",
    cta: status === "live" ? "Tham gia phiên đang diễn ra" : "Truy cập nền tảng",
    note: "Nền tảng đang bảo trì. Tài liệu hội nghị sẽ mở lại sau khi hoàn tất.",
    access: "Cần đăng nhập tài khoản đại biểu",
  };
}

export function trainingPlatform(): PlatformView {
  return {
    id: "dao-tao",
    name: "Nền tảng Đào tạo",
    url: "#",
    metric: "14 khoá đang mở",
    desc: "Bồi dưỡng cán bộ Hội, học liệu và chứng nhận điện tử.",
    cta: "Truy cập nền tảng",
    access: "Cần đăng nhập cán bộ Hội",
    hasCta: true,
  };
}

export function sv5tPlatform(): PlatformView {
  return {
    id: "sv5tot",
    name: "Sinh viên 5 tốt",
    url: "/chu-de/sinh-vien-5-tot",
    desc: "Đăng ký, theo dõi hồ sơ và tra cứu danh hiệu.",
    cta: "Mở hồ sơ",
    access: "Cần đăng nhập sinh viên",
    hasCta: true,
  };
}

export function volunteerPlatform(status: VolunteerStatus): PlatformView & {
  isOpen: boolean;
  isMaint: boolean;
  isDown: boolean;
} {
  return {
    id: "tinh-nguyen",
    name: "Tình nguyện",
    url: "#",
    desc: "Chiến dịch, chấm công tình nguyện và báo cáo công trình.",
    isOpen: status === "open",
    isMaint: status === "maintenance",
    isDown: status === "unavailable",
    hasCta: status === "open",
    cta: "Đăng ký chiến dịch",
    note:
      status === "maintenance"
        ? "Nền tảng đang bảo trì. Bạn có thể đăng ký lại sau khi nền tảng mở."
        : "Nền tảng tạm chưa truy cập được. Liên hệ Hội Sinh viên trường để đăng ký trực tiếp.",
    access: "Cần đăng nhập sinh viên",
  };
}

export function dataPlatform(status: DataPlatformStatus): PlatformView & {
  isSoon: boolean;
  isActive: boolean;
} {
  return {
    id: "du-lieu",
    name: "Dữ liệu & Báo cáo",
    url: "#",
    desc: "Số liệu phong trào theo tỉnh, thành và nhà trường.",
    isSoon: status === "soon",
    isActive: status === "active",
    hasCta: status === "active",
    cta: "Xem báo cáo",
    note: "Nền tảng sẽ mở trong nhiệm kỳ 2026 – 2031. Chưa có đường dẫn truy cập.",
    access: status === "soon" ? "Quyền truy cập sẽ công bố khi mở nền tảng" : "Cần đăng nhập cán bộ Hội",
  };
}
