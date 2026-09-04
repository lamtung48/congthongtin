/**
 * Canonical slug rule for the whole app: kebab-case, no diacritics. Content
 * that already carries a real slug (articles, events, categories, topics,
 * provinces from the activity-map dataset) uses that slug directly — this
 * function only derives one from a display name where no real slug exists
 * yet (overseas chapter names, local-news organization names).
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Overseas Hội Sinh viên chapters are always named "Hội Sinh viên Việt Nam
 *  tại <country>" — this is the one slug derivation rule shared between the
 *  `overseasOrganizations` fixture and the activity map's "đơn vị" link, so
 *  both land on the same `/don-vi/[slug]`. */
export function slugifyOverseasName(name: string): string {
  return slugify(name.replace(/^Hội Sinh viên Việt Nam tại /, ""));
}
