/** Opaque identifier assigned by whatever system owns the record (fixture, DB, CMS). */
export type ID = string;

/** URL-safe, human-readable identifier used in routes (e.g. "tinh-nguyen"). */
export type Slug = string;

/** ISO 8601 date or date-time string, always UTC-naive local wall-clock for this domain. */
export type ISODateTime = string;
