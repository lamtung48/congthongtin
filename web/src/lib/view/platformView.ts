import type { Platform } from "@/domain/platform";

/**
 * Per-category display copy for one platform card. This is a straight port
 * of the five separate `conferencePlatform`/`trainingPlatform`/... functions
 * that used to live in `lib/data/platforms.ts` — same text, same branching —
 * now keyed off `platform.status`/`platform.category` (data) instead of a
 * literal argument at the call site (UI code).
 */
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
  isLive?: boolean;
  isActive?: boolean;
  isMaint?: boolean;
  isOpen?: boolean;
  isDown?: boolean;
  isSoon?: boolean;
}

export function buildPlatformView(p: Platform): PlatformView {
  switch (p.category) {
    case "conference":
      return {
        id: p.id,
        name: p.name,
        url: p.url,
        desc: p.description,
        activity: p.liveActivityNote,
        isLive: p.status === "live",
        isActive: p.status === "active",
        isMaint: p.status === "maintenance",
        hasCta: p.status !== "maintenance",
        cta: p.status === "live" ? "Tham gia phiên đang diễn ra" : "Truy cập nền tảng",
        note: "Nền tảng đang bảo trì. Tài liệu hội nghị sẽ mở lại sau khi hoàn tất.",
        access: p.accessLevel,
      };
    case "training":
      return {
        id: p.id,
        name: p.name,
        url: p.url,
        metric: p.metric,
        desc: p.description,
        cta: "Truy cập nền tảng",
        access: p.accessLevel,
        hasCta: true,
      };
    case "sv5tot":
      return {
        id: p.id,
        name: p.name,
        url: p.url,
        desc: p.description,
        cta: "Mở hồ sơ",
        access: p.accessLevel,
        hasCta: true,
      };
    case "volunteer":
      return {
        id: p.id,
        name: p.name,
        url: p.url,
        desc: p.description,
        isOpen: p.status === "open",
        isMaint: p.status === "maintenance",
        isDown: p.status === "unavailable",
        hasCta: p.status === "open",
        cta: "Đăng ký chiến dịch",
        note:
          p.status === "maintenance"
            ? "Nền tảng đang bảo trì. Bạn có thể đăng ký lại sau khi nền tảng mở."
            : "Nền tảng tạm chưa truy cập được. Liên hệ Hội Sinh viên trường để đăng ký trực tiếp.",
        access: p.accessLevel,
      };
    case "data":
      return {
        id: p.id,
        name: p.name,
        url: p.url,
        desc: p.description,
        isSoon: p.status === "soon",
        isActive: p.status === "active",
        hasCta: p.status === "active",
        cta: "Xem báo cáo",
        note: "Nền tảng sẽ mở trong nhiệm kỳ 2026 – 2031. Chưa có đường dẫn truy cập.",
        access: p.status === "soon" ? "Quyền truy cập sẽ công bố khi mở nền tảng" : "Cần đăng nhập cán bộ Hội",
      };
  }
}
