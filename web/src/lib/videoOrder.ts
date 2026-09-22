/**
 * The single ordering rule for videos: pinned first, in pin order, then
 * everything else in whatever order it arrived (newest first).
 *
 * Lives in `lib/` rather than beside either caller because both sides run
 * it — `DatabaseProvider.getVideos` for the public homepage and `/video`,
 * and the admin video list for its own rows. "Đồng bộ với thứ tự hiển thị
 * ngoài trang chủ" only actually holds if the two run the same function, not
 * two that merely look alike; and putting it here keeps the admin page from
 * importing the whole data-access provider just to sort a list.
 *
 * A pinned id matching no row (video deleted, unpublished, or scheduled for
 * later) contributes nothing — no gap, no crash.
 */
export function sortVideosByPin<T extends { id: string }>(rows: T[], pinnedIds: string[]): T[] {
  const rank = new Map(pinnedIds.map((id, i) => [id, i]));
  const pinned = rows.filter((r) => rank.has(r.id)).sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
  const rest = rows.filter((r) => !rank.has(r.id));
  return [...pinned, ...rest];
}
