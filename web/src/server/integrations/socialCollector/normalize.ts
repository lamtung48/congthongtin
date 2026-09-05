import { createHash } from "node:crypto";

/** Vietnamese hashtags carry combining diacritics under Unicode
 *  normalization — `\p{L}` alone (no explicit diacritic ranges) already
 *  matches composed Vietnamese letters (NFC, what every platform's own
 *  API returns text as), so no separate Vietnamese-specific pattern is
 *  needed. */
const HASHTAG_RE = /#([\p{L}\p{N}_]+)/gu;

/** Brief section 9: "Rule hashtag chỉ chạy trên dữ liệu đã fetch hợp lệ"
 *  — this is the extraction step that runs on real fetched text, never on
 *  a live platform search. Lower-cased and deduplicated so rule matching
 *  (`passesHashtagRules`) is a plain case-insensitive set lookup. */
export function extractHashtags(text: string): string[] {
  const tags = new Set<string>();
  for (const match of text.matchAll(HASHTAG_RE)) {
    tags.add(match[1].toLowerCase());
  }
  return [...tags];
}

/** Dedup check 3 (brief section 7: "normalized content") — collapses
 *  whitespace/case differences that would otherwise make the exact same
 *  post fetched twice (or lightly re-edited) hash differently. Never
 *  displayed, only compared. */
export function normalizedContentHash(text: string): string {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, " ");
  return createHash("sha256").update(normalized).digest("hex");
}

/**
 * Brief section 9. `includeHashtags` empty = no include-filter (everything
 * passes that axis); non-empty = at least one must match. `excludeHashtags`
 * always applies when non-empty, regardless of `includeHashtags` — an
 * excluded tag wins even if an included one is also present, since
 * "exclude" is meant as a hard block (e.g. spam/off-topic tags), not a
 * tie-breaker.
 */
export function passesHashtagRules(hashtags: string[], includeHashtags: string[], excludeHashtags: string[]): boolean {
  const present = new Set(hashtags.map((h) => h.toLowerCase()));
  if (excludeHashtags.some((h) => present.has(h.toLowerCase()))) return false;
  if (includeHashtags.length > 0 && !includeHashtags.some((h) => present.has(h.toLowerCase()))) return false;
  return true;
}
