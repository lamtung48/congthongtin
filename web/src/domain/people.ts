import type { ID } from "./common";
import type { MediaAsset } from "./media";
import type { Province } from "./geo";

export interface Author {
  id: ID;
  name: string;
  title?: string;
  avatar?: MediaAsset;
}

/** How a reporting/publishing unit sits in the Hội's structure. `"central"`
 *  (Trung ương Hội) and `"other"` mirror the two `OrganizationType` values
 *  the database has beyond the three original province/university/overseas
 *  reporting tiers (`prisma/schema.prisma`) — added when the public site
 *  started reading real `Organization` rows, which can legitimately carry
 *  either. */
export type OrganizationLevel = "province" | "university" | "overseas" | "central" | "other";

/** A Hội Sinh viên unit that can publish news or report activity — a province
 *  chapter, a university chapter, or an overseas chapter. */
export interface Organization {
  id: ID;
  name: string;
  level: OrganizationLevel;
  province?: Province;
  country?: string;
  url?: string;
}
