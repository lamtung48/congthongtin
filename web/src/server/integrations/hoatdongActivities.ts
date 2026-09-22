/**
 * Reads the Hoạt động platform's PUBLIC activity list — the same list its
 * own "Khám phá" tab shows anonymously (`GET /api/activities/discover`,
 * already enriched with the organiser's name, hsv-id type and locality) —
 * and normalises it for `PlatformActivity` (see schema.prisma). Used only by
 * `scripts/syncPlatformActivities.ts`; nothing here runs on a page request.
 *
 * No key needed (public endpoint, same data as the public site), called on
 * the internal docker URL (HOATDONG_URL); links and images are rewritten to
 * the public origin (HOATDONG_PUBLIC_URL).
 */

export interface HoatdongActivity {
  id: string;
  code: string;
  title: string;
  url: string;
  thumbnailUrl: string | null;
  organizationName: string;
  organizationType: string | null;
  localityName: string | null;
  status: string;
  tags: string[];
  participantCount: number;
  startAt: Date;
  endAt: Date;
}

interface DiscoverItem {
  id: string;
  code: string;
  title: string;
  detailUrl: string;
  thumbnailUrl: string | null;
  thumbnailIsFallback: boolean;
  organizationName: string;
  organizationLevel: string | null;
  provinceName: string | null;
  activityStatus: string;
  tags: { code: string; label: string }[];
  participantDisplayCount: number;
  startAt: string;
  endAt: string;
}

/** The discover endpoint has a fixed page size (12); this caps one sync at ~720 activities. */
const MAX_PAGES = 60;

function absolute(publicUrl: string, path: string): string {
  return /^https?:\/\//.test(path) ? path : `${publicUrl}${path.startsWith("/") ? "" : "/"}${path}`;
}

/**
 * Hoạt động stores Drive images as their "view" page link
 * (`drive.google.com/file/d/<id>/view`), which is an HTML page, not an image.
 * Drive's thumbnail endpoint serves the same file as an image; if the file is
 * not viewable publicly the <img> falls back on the client (onError).
 */
export function renderableThumbnail(publicUrl: string, item: Pick<DiscoverItem, "thumbnailUrl" | "thumbnailIsFallback">): string | null {
  if (item.thumbnailIsFallback || !item.thumbnailUrl) return null;
  const drive = item.thumbnailUrl.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (drive) return `https://drive.google.com/thumbnail?id=${drive[1]}&sz=w640`;
  return absolute(publicUrl, item.thumbnailUrl);
}

function normalise(publicUrl: string, item: DiscoverItem): HoatdongActivity | null {
  const startAt = new Date(item.startAt);
  const endAt = new Date(item.endAt);
  if (!item.id || !item.title || Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) return null;
  return {
    id: item.id,
    code: item.code,
    title: item.title.trim(),
    url: absolute(publicUrl, item.detailUrl || `/hoat-dong/${item.code}`),
    thumbnailUrl: renderableThumbnail(publicUrl, item),
    organizationName: item.organizationName,
    organizationType: item.organizationLevel ?? null,
    localityName: item.provinceName ?? null,
    status: item.activityStatus,
    tags: (item.tags ?? []).map((t) => t.label).filter(Boolean),
    participantCount: Math.max(0, Math.round(item.participantDisplayCount ?? 0)),
    startAt,
    endAt,
  };
}

/**
 * Every public activity, page by page. `complete` is false when a page failed
 * midway or the page cap was hit — the caller must then NOT delete rows it
 * didn't see. `null` = not configured, or Hoạt động unreachable on page 1.
 */
export async function fetchAllPublicActivities(): Promise<{ items: HoatdongActivity[]; complete: boolean } | null> {
  const baseUrl = process.env.HOATDONG_URL?.replace(/\/$/, "");
  const publicUrl = process.env.HOATDONG_PUBLIC_URL?.replace(/\/$/, "");
  if (!baseUrl || !publicUrl) return null;

  const items: HoatdongActivity[] = [];
  let seen = 0; // raw rows received (a malformed row is skipped but still counts as "seen")
  let total = Infinity;
  for (let page = 1; page <= MAX_PAGES && seen < total; page++) {
    let body: { items?: DiscoverItem[]; total?: number } | null = null;
    try {
      const res = await fetch(`${baseUrl}/api/activities/discover?page=${page}`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
      body = res.ok ? await res.json() : null;
    } catch (err) {
      console.error(`[hoatdong] đọc danh sách hoạt động (trang ${page}) thất bại:`, err instanceof Error ? err.message : err);
    }
    if (!body?.items) return page === 1 ? null : { items, complete: false };
    total = typeof body.total === "number" ? body.total : seen + body.items.length;
    if (body.items.length === 0) break;
    seen += body.items.length;
    for (const raw of body.items) {
      const a = normalise(publicUrl, raw);
      if (a) items.push(a);
    }
  }
  return { items, complete: seen >= total };
}

/** "Khánh Hoà" / "Khánh Hòa" / "TP. Hồ Chí Minh" / "Thành phố Hồ Chí Minh" → one comparable key. */
export function placeKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/^(thanh pho|tp\.?|tinh)\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
