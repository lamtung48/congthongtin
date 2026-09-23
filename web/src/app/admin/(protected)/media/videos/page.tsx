import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/server/auth/session";
import { hasPermission } from "@/server/auth/permissions";
import { mediaService } from "@/server/services/mediaService";
import { youtubeService } from "@/server/services/youtubeService";
import { isYoutubeApiKeyConfigured, isYoutubeConnected } from "@/server/integrations/youtube";
import { userRepository } from "@/server/repositories/userRepository";
import { videoRepository } from "@/server/repositories/videoRepository";
import { homepageService } from "@/server/services/homepageService";
import { sortVideosByPin } from "@/lib/videoOrder";
import type { MediaAdminFilter, MediaUsageDetail } from "@/server/repositories/mediaRepository";
import type { MediaStatus, YoutubeVisibility } from "@/generated/prisma/client";
import { AddVideoPanel } from "./AddVideoPanel";
import { VideoRowActions } from "./VideoRowActions";
import { VideoPinButton } from "./VideoPinButton";
import { formatDateVi } from "@/lib/formatDate";

export const metadata: Metadata = { title: "Video (YouTube)" };

const PAGE_SIZE = 20;

const STATUS_LABELS: Record<MediaStatus, string> = {
  READY: "Sẵn sàng",
  MISSING: "Thiếu tệp",
  REMOVED: "Đã gỡ",
  PROCESSING: "Đang xử lý",
};
const STATUS_BADGE: Record<MediaStatus, string> = {
  READY: "adminBadgeSuccess",
  MISSING: "adminBadgeWarning",
  REMOVED: "adminBadgeDanger",
  PROCESSING: "adminBadgeNeutral",
};
/** Brief section 7: the specific reasons a `READY` (or `REMOVED`) video may
 *  still fail to actually play for a visitor — see `youtubeService.ts`'s
 *  `mapUploadStatusToMedia` for where these codes are produced. */
const ERROR_REASON_LABELS: Record<string, string> = {
  private: "Video đang ở chế độ riêng tư",
  embed_disabled: "Chủ kênh đã tắt nhúng video",
  removed: "Video đã bị xoá/gỡ trên YouTube",
  upload_failed: "Tải lên YouTube thất bại",
  quota_exceeded: "Vượt hạn mức API YouTube",
};
const VISIBILITY_LABELS: Record<YoutubeVisibility, string> = { PUBLIC: "Công khai", UNLISTED: "Không công khai", PRIVATE: "Riêng tư" };
const VISIBILITY_BADGE: Record<YoutubeVisibility, string> = { PUBLIC: "adminBadgeSuccess", UNLISTED: "adminBadgeNeutral", PRIVATE: "adminBadgeDanger" };

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds < 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function buildQuery(params: Record<string, string | undefined>, overrides: Record<string, string | undefined>): string {
  const merged = { ...params, ...overrides };
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value) qs.set(key, value);
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
}

interface SearchParams {
  uploader?: string;
  status?: string;
  visibility?: string;
  usage?: string;
  from?: string;
  to?: string;
  page?: string;
  youtubeOAuth?: string;
  youtubeOAuthMessage?: string;
}

/** Same "usage" filter with no backing DB column as `/admin/media` — see
 *  that page's header comment for why it scans up to this many candidate
 *  rows and paginates the filtered result in-memory rather than in SQL. */
const USAGE_SCAN_LIMIT = 500;

export default async function AdminVideosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireSession();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const canManageAny = hasPermission(session.role, "media.manage.any");
  // Pinning is a homepage decision, not a media one — same permission the
  // article list's Hero/Dòng chảy toggles use.
  const canManageHomepage = hasPermission(session.role, "homepage.manage");
  const isAdmin = session.role === "ADMIN";
  const canUpload = youtubeService.canUploadVideo(session);

  const baseFilter: MediaAdminFilter = {
    type: "VIDEO",
    createdById: params.uploader || undefined,
    status: (params.status as MediaStatus) || undefined,
    visibility: (params.visibility as YoutubeVisibility) || undefined,
    createdFrom: params.from ? new Date(params.from) : undefined,
    createdTo: params.to ? new Date(`${params.to}T23:59:59`) : undefined,
  };
  const usageFilter = params.usage === "used" || params.usage === "unused" ? params.usage : undefined;

  let pageAssets: Awaited<ReturnType<typeof mediaService.listForAdmin>>;
  let total: number;
  let usageByMediaId = new Map<string, MediaUsageDetail[]>();

  if (usageFilter) {
    const candidates = await mediaService.listForAdmin(session, { ...baseFilter, take: USAGE_SCAN_LIMIT });
    const withUsage = await Promise.all(
      candidates.map(async (asset) => ({ asset, usage: await mediaService.getUsageDetail(asset.id) })),
    );
    const filtered = withUsage.filter(({ usage }) => (usageFilter === "used" ? usage.length > 0 : usage.length === 0));
    total = filtered.length;
    const start = (page - 1) * PAGE_SIZE;
    const slice = filtered.slice(start, start + PAGE_SIZE);
    pageAssets = slice.map((s) => s.asset);
    usageByMediaId = new Map(slice.map((s) => [s.asset.id, s.usage]));
  } else {
    [pageAssets, total] = await Promise.all([
      mediaService.listForAdmin(session, { ...baseFilter, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
      mediaService.countForAdmin(session, baseFilter),
    ]);
    const usageEntries = await Promise.all(pageAssets.map(async (asset) => [asset.id, await mediaService.getUsageDetail(asset.id)] as const));
    usageByMediaId = new Map(usageEntries);
  }

  // Homepage pin state for the rows on this page. `Video` is the record the
  // public section reads; the list here is of `MediaAsset`s, so the two are
  // bridged by `mediaId`. A media asset never published as a video simply has
  // no entry, and gets no pin button.
  const pinnedVideoIds = await homepageService.listPinnedVideoIds();
  const videosByMediaId = new Map(
    (await Promise.all(pageAssets.map(async (a) => [a.id, await videoRepository.findByMediaId(a.id)] as const)))
      .filter((entry): entry is [string, NonNullable<Awaited<ReturnType<typeof videoRepository.findByMediaId>>>] => entry[1] !== null),
  );
  const pinRankByVideoId = new Map(pinnedVideoIds.map((id, i) => [id, i + 1]));

  // Same sort the public side runs (`sortVideosByPin`), applied to this
  // page's rows so the admin list reads in the homepage's order. It sorts
  // what is on screen, not the whole catalogue: with pagination, a pinned
  // video that falls on a later page stays there — which is why every pinned
  // row also carries its rank ("★ Trang chủ #2"), so the true homepage order
  // is legible even then.
  const items = sortVideosByPin(
    // Keyed by the *video* id, since that is what a placement points at; the
    // asset rides along untouched. An asset with no video gets a key that
    // matches no pin, so it sorts with the rest.
    pageAssets.map((asset) => ({ id: videosByMediaId.get(asset.id)?.id ?? `chua-dang-${asset.id}`, asset })),
    pinnedVideoIds,
  ).map((row) => row.asset);

  const uploaders = await userRepository.list({ take: 200 });
  const hasYoutubeApiKey = isYoutubeApiKeyConfigured();
  // Uploading and browsing a channel both need an OAuth channel connection.
  // The CMS attaches public videos by link instead, so those two only appear
  // if a connection happens to exist — otherwise they would be dead buttons
  // that fail at submit with "chưa kết nối kênh".
  const channelConnected = await isYoutubeConnected();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filterQueryOnly: Record<string, string | undefined> = {
    uploader: params.uploader,
    status: params.status,
    visibility: params.visibility,
    usage: params.usage,
    from: params.from,
    to: params.to,
  };

  return (
    <>
      <div className="adminPageHead">
        <div>
          <h1 className="adminPageTitle">Video (YouTube)</h1>
          <p className="adminPageSubtitle">Video được lưu trữ và phát trực tiếp trên YouTube — hệ thống không lưu tệp video.</p>
        </div>
      </div>

      {params.youtubeOAuth === "connected" && (
        <div className="adminCard adminCardPad" style={{ borderColor: "var(--admin-success, green)" }}>
          <p style={{ margin: 0 }}>Đã kết nối kênh YouTube thành công.</p>
        </div>
      )}
      {params.youtubeOAuth === "error" && (
        <div className="adminCard adminCardPad">
          <p className="adminErrorText" role="alert" style={{ margin: 0 }}>
            {params.youtubeOAuthMessage || "Kết nối YouTube thất bại."}
          </p>
        </div>
      )}

      {isAdmin && (
        <div className="adminCard adminCardPad">
          <strong>Video được thêm bằng cách dán link YouTube công khai.</strong>
          <p className="adminHint" style={{ margin: "4px 0 0" }}>
            Không cần kết nối kênh: dán URL (hoặc video ID) của bất kỳ video công khai nào ở ô bên dưới, hệ thống tự lấy
            tiêu đề và ảnh đại diện.{" "}
            {hasYoutubeApiKey
              ? "Đã cấu hình YouTube API key nên lấy được cả thời lượng video."
              : "Chưa cấu hình YOUTUBE_API_KEY nên chưa lấy được thời lượng video (hiển thị “—”); thêm khoá là có ngay."}
          </p>
        </div>
      )}

      <AddVideoPanel
        canUpload={canUpload && channelConnected}
        canManageAny={canManageAny}
        canBrowseChannel={canManageAny && channelConnected}
      />

      <form className="adminFilterGrid adminCard adminCardPad" method="get">
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="f-uploader">Người upload</label>
          <select id="f-uploader" name="uploader" defaultValue={params.uploader ?? ""} className="adminSelect">
            <option value="">Tất cả</option>
            <option value={session.id}>Chỉ của tôi</option>
            {uploaders.filter((u) => u.id !== session.id).map((u) => <option key={u.id} value={u.id}>{u.displayName}</option>)}
          </select>
        </div>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="f-status">Trạng thái</label>
          <select id="f-status" name="status" defaultValue={params.status ?? ""} className="adminSelect">
            <option value="">Tất cả</option>
            {(Object.keys(STATUS_LABELS) as MediaStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="f-visibility">Chế độ hiển thị</label>
          <select id="f-visibility" name="visibility" defaultValue={params.visibility ?? ""} className="adminSelect">
            <option value="">Tất cả</option>
            {(Object.keys(VISIBILITY_LABELS) as YoutubeVisibility[]).map((v) => <option key={v} value={v}>{VISIBILITY_LABELS[v]}</option>)}
          </select>
        </div>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="f-usage">Sử dụng</label>
          <select id="f-usage" name="usage" defaultValue={params.usage ?? ""} className="adminSelect">
            <option value="">Tất cả</option>
            <option value="used">Đang sử dụng</option>
            <option value="unused">Chưa sử dụng</option>
          </select>
        </div>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="f-from">Từ ngày</label>
          <input id="f-from" name="from" type="date" defaultValue={params.from ?? ""} className="adminInput" />
        </div>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="f-to">Đến ngày</label>
          <input id="f-to" name="to" type="date" defaultValue={params.to ?? ""} className="adminInput" />
        </div>
        <button type="submit" className="adminButton">Lọc</button>
        <Link href="/admin/media/videos" className="adminButton">Xoá lọc</Link>
      </form>

      <div className="adminCard">
        {pageAssets.length === 0 ? (
          <div className="adminEmptyState">Không có video nào khớp bộ lọc.</div>
        ) : (
          <div className="adminTableWrap">
            <table className="adminTable">
              <thead>
                <tr>
                  <th>Xem trước</th>
                  <th>Tiêu đề</th>
                  <th>Video ID</th>
                  <th>Chế độ</th>
                  <th>Thời lượng</th>
                  <th>Trạng thái</th>
                  <th>Trang chủ</th>
                  <th>Sử dụng</th>
                  <th>Người upload</th>
                  <th>Ngày tạo</th>
                  <th style={{ minWidth: 150 }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {items.map((m) => {
                  const usage = usageByMediaId.get(m.id) ?? [];
                  const canManageThis = canManageAny || m.createdById === session.id;
                  const videoId = m.providerFileId;
                  // Custom cover (Drive) when one is set, else YouTube's own still.
                  const customThumbUrl = m.thumbnail?.status === "READY" ? `/api/media/${m.thumbnail.id}` : null;
                  const previewSrc = customThumbUrl ? `${customThumbUrl}?w=320` : videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;
                  return (
                    <tr key={m.id}>
                      <td>
                        {previewSrc ? (
                          <div style={{ display: "grid", gap: 2, justifyItems: "start" }}>
                            {/* eslint-disable-next-line @next/next/no-img-element -- a YouTube still / this app's own media route, not a local asset next/image would optimize */}
                            <img
                              src={previewSrc}
                              alt={m.filename ?? ""}
                              style={{ width: 80, height: 45, objectFit: "cover", borderRadius: "var(--admin-radius)" }}
                            />
                            {customThumbUrl && <span className="adminHint" style={{ fontSize: 10.5 }}>Ảnh riêng</span>}
                          </div>
                        ) : (
                          <span className="adminHint">—</span>
                        )}
                      </td>
                      <td>{m.filename ?? m.caption ?? m.id}</td>
                      <td className="adminHint" style={{ fontFamily: "monospace", fontSize: 12 }}>{videoId ?? "—"}</td>
                      <td>
                        {m.visibility ? (
                          <span className={`adminBadge ${VISIBILITY_BADGE[m.visibility]}`}>{VISIBILITY_LABELS[m.visibility]}</span>
                        ) : (
                          <span className="adminHint">—</span>
                        )}
                      </td>
                      <td className="adminHint">{formatDuration(m.durationSeconds)}</td>
                      <td>
                        <div style={{ display: "grid", gap: 2 }}>
                          <span className={`adminBadge ${STATUS_BADGE[m.status]}`}>{STATUS_LABELS[m.status]}</span>
                          {m.errorReason && (
                            <span className="adminHint" style={{ fontSize: 11 }}>{ERROR_REASON_LABELS[m.errorReason] ?? m.errorReason}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <VideoPinButton
                          mediaId={m.id}
                          videoId={videosByMediaId.get(m.id)?.id ?? null}
                          pinRank={(() => {
                            const vid = videosByMediaId.get(m.id)?.id;
                            return vid ? pinRankByVideoId.get(vid) ?? null : null;
                          })()}
                          canManage={canManageHomepage}
                        />
                      </td>
                      <td>
                        {usage.length === 0 ? (
                          <span className="adminBadge adminBadgeNeutral">Chưa dùng</span>
                        ) : (
                          <span className="adminBadge adminBadgeWarning" title={usage.map((u) => u.entityLabel).join("; ")}>
                            Đang dùng · {usage.length} nơi
                          </span>
                        )}
                      </td>
                      <td className="adminHint">{m.createdBy?.displayName ?? "—"}</td>
                      <td className="adminHint">{formatDateVi(m.createdAt)}</td>
                      <td>
                        <VideoRowActions
                          mediaId={m.id}
                          title={m.filename ?? ""}
                          description={m.caption ?? ""}
                          visibility={m.visibility ?? "unlisted"}
                          canManage={canManageThis}
                          canSetAnyVisibility={canManageAny}
                          isAdmin={isAdmin}
                          youtubeId={videoId}
                          thumbnailUrl={customThumbUrl}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="adminPagination">
          <span>Trang {page}/{totalPages} · {total} video</span>
          {page > 1 && (
            <Link href={`/admin/media/videos${buildQuery(filterQueryOnly, { page: String(page - 1) })}`} className="adminButton adminButtonSmall">← Trước</Link>
          )}
          {page < totalPages && (
            <Link href={`/admin/media/videos${buildQuery(filterQueryOnly, { page: String(page + 1) })}`} className="adminButton adminButtonSmall">Sau →</Link>
          )}
        </div>
      )}
    </>
  );
}
