/**
 * Every human-readable date/time in this app — public site and admin alike —
 * is rendered here, in **Giờ Việt Nam (GMT+7)**, regardless of where the code
 * runs.
 *
 * That "regardless" is the whole point. Two different clocks were previously
 * in play and neither of them was Vietnam's:
 *
 *  - On the server these functions used `Date#getDate()`/`getHours()`, which
 *    read the *container's* zone. The app image sets no `TZ`, so Node
 *    defaults to UTC and every server-rendered timestamp was 7 hours behind —
 *    enough to print the wrong calendar day for anything published between
 *    00:00 and 07:00 Vietnam time.
 *  - In a client component the same call reads the *visitor's* zone, so the
 *    server's HTML and the browser's first render disagreed for anyone
 *    outside UTC — a hydration mismatch, and a different date for a reader in
 *    Tokyo than for one in Hà Nội.
 *
 * Pinning the formatter to `Asia/Ho_Chi_Minh` makes both paths produce the
 * same string: this is a Vietnamese national organisation's portal, so "18:30
 * ngày 07.09" means 18:30 in Vietnam to every reader, not "18:30 wherever you
 * happen to be". `docker-compose.yml` additionally sets `TZ` on the
 * containers, which covers raw `new Date()` arithmetic and log lines; this
 * module does not rely on it.
 */

const TIME_ZONE = "Asia/Ho_Chi_Minh";

/** One formatter, reused: constructing an `Intl.DateTimeFormat` is the
 *  expensive part, and these run once per rendered card. `hourCycle: "h23"`
 *  rather than `hour12: false` — the latter still renders midnight as "24" in
 *  some ICU versions. */
const PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export type DateInput = string | number | Date;

interface ViParts {
  day: string;
  month: string;
  year: string;
  hour: string;
  minute: string;
}

function viParts(input: DateInput): ViParts | null {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  const found = PARTS.formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) => found.find((p) => p.type === type)?.value ?? "";
  return { day: get("day"), month: get("month"), year: get("year"), hour: get("hour"), minute: get("minute") };
}

/** "dd.MM.yyyy" in Vietnam time. An unparseable value renders as "—" rather
 *  than "NaN.NaN.NaN". */
export function formatDateVi(input: DateInput): string {
  const p = viParts(input);
  return p ? `${p.day}.${p.month}.${p.year}` : "—";
}

/** "dd.MM.yyyy · HH:mm" in Vietnam time. */
export function formatDateTimeVi(input: DateInput): string {
  const p = viParts(input);
  return p ? `${p.day}.${p.month}.${p.year} · ${p.hour}:${p.minute}` : "—";
}

/** "HH:mm" alone, for a row that already shows the date elsewhere. */
export function formatTimeVi(input: DateInput): string {
  const p = viParts(input);
  return p ? `${p.hour}:${p.minute}` : "—";
}
