import type { PlatformCategory, PlatformStatus, PlatformIntegrationType } from "@/generated/prisma/client";

/** Vietnamese display labels for the three `Platform` enums — shared by
 *  every `/admin/platforms` screen (list, create, edit) so the same enum
 *  value always reads the same way everywhere, and adding a new enum
 *  member only ever means updating this one file. No server-only code
 *  here (plain records), safe to import from a Client Component form too. */
export const PLATFORM_CATEGORY_LABELS: Record<PlatformCategory, string> = {
  CONFERENCE: "Hội nghị",
  TRAINING: "Đào tạo",
  SV5TOT: "Sinh viên 5 tốt",
  VOLUNTEER: "Tình nguyện",
  DATA: "Dữ liệu & Báo cáo",
};

export const PLATFORM_STATUS_LABELS: Record<PlatformStatus, string> = {
  LIVE: "Đang diễn ra",
  ACTIVE: "Đang hoạt động",
  MAINTENANCE: "Đang bảo trì",
  OPEN: "Đang mở",
  UNAVAILABLE: "Tạm không truy cập",
  SOON: "Sắp ra mắt",
};

export const PLATFORM_INTEGRATION_TYPE_LABELS: Record<PlatformIntegrationType, string> = {
  EXTERNAL_LINK: "Liên kết ngoài",
  API: "Tích hợp API",
  SSO_READY: "Sẵn sàng SSO",
};
