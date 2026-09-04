import type { ID, ISODateTime, Slug } from "./common";
import type { MediaAsset } from "./media";

/** Computed from `startAt`/`endAt`/`capacity`/`registered` against "now" at
 *  render time (see `buildEventView`) — never stored on the entity itself. */
export type EventStatus = "live" | "upcoming" | "soldout" | "completed";

export interface Event {
  id: ID;
  slug: Slug;
  title: string;
  place: string;
  startAt: ISODateTime;
  endAt: ISODateTime;
  url?: string;
  cover?: MediaAsset;
  capacity?: number;
  registered?: number;
}
