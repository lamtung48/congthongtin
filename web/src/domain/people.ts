import type { ID } from "./common";
import type { MediaAsset } from "./media";
import type { Province } from "./geo";

export interface Author {
  id: ID;
  name: string;
  title?: string;
  avatar?: MediaAsset;
}

/** How a reporting/publishing unit sits in the Hội's structure. */
export type OrganizationLevel = "province" | "university" | "overseas";

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
