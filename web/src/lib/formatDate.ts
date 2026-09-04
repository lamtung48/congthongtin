/** Renders an ISO date/date-time string as "dd.MM.yyyy" for display — the
 *  format every homepage fixture used to hardcode by hand. */
export function formatDateVi(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

/** Same as `formatDateVi` but with an "HH:mm" time appended after " · ". */
export function formatDateTimeVi(iso: string): string {
  const d = new Date(iso);
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${formatDateVi(iso)} · ${time}`;
}
