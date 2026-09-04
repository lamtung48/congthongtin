import type { OrganizationLevel } from "@/domain/people";

/** Shared between `/don-vi/[slug]` and `/dia-phuong/[slug]`'s organization
 *  list — one label per `OrganizationLevel`, not duplicated per page. */
export const ORGANIZATION_LEVEL_LABEL: Record<OrganizationLevel, string> = {
  province: "Hội Sinh viên cấp tỉnh, thành",
  university: "Hội Sinh viên cấp trường",
  overseas: "Hội Sinh viên ở nước ngoài",
};
