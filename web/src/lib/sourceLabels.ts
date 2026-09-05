import type { SourceType, SourceStatus, ExternalItemStatus } from "@/generated/prisma/client";

/** Vietnamese display labels — shared by `/admin/sources` and
 *  `/admin/social-inbox`, same "one file, no drift" reasoning as
 *  `platformLabels.ts`. */
export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  FACEBOOK_PAGE: "Facebook Page",
  RSS: "RSS/Atom",
  WEBSITE: "Website",
  YOUTUBE: "Kênh YouTube",
  MANUAL_EXTERNAL: "Nhập thủ công",
};

export const SOURCE_STATUS_LABELS: Record<SourceStatus, string> = {
  ACTIVE: "Hoạt động",
  DISABLED: "Đã tắt",
  ERROR: "Lỗi",
};

export const EXTERNAL_ITEM_STATUS_LABELS: Record<ExternalItemStatus, string> = {
  PENDING_REVIEW: "Chờ xử lý",
  ASSIGNED: "Đã giao",
  CONVERTED: "Đã chuyển bài",
  IGNORED: "Đã bỏ qua",
};
