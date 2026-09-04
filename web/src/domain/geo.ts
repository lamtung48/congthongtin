import type { ID, Slug } from "./common";

/** One of Vietnam's 34 provinces/centrally-run cities. */
export interface Province {
  id: ID;
  slug: Slug;
  name: string;
  lat: number;
  lon: number;
}

/** A national-level Hội Sinh viên Việt Nam chapter operating outside Vietnam. */
export interface OverseasOrganization {
  id: ID;
  name: string;
  country?: string;
}
