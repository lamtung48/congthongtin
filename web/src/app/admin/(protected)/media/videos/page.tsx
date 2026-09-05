import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/server/auth/session";
import { hasPermission } from "@/server/auth/permissions";
import { mediaService } from "@/server/services/mediaService";
import { youtubeService } from "@/server/services/youtubeService";
import { startYoutubeConnectAction, disconnectYoutubeAction } from "./actions";
import { userRepository } from "@/server/repositories/userRepository";
import type { MediaAdminFilter, MediaUsageDetail } from "@/server/repositories/mediaRepository";
import type { MediaStatus, YoutubeVisibility } from "@/generated/prisma/client";
import { AddVideoPanel } from "./AddVideoPanel";
import { VideoRowActions } from "./VideoRowActions";

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

  const uploaders = await userRepository.list({ take: 200 });
  const connectionStatus = isAdmin ? await youtubeService.getConnectionStatus(session) : null;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Extracted ahead of the JSX (rather than narrowed inline in a ternary)
  // because TypeScript does not reliably propagate `&&`-narrowing of a
  // nullable discriminated union into a ternary's consequent branch.
  let connectionBanner: { channelLabel: string; connectedAtLabel: string } | null = null;
  if (connectionStatus && connectionStatus.connected) {
    connectionBanner = {
      channelLabel: connectionStatus.channelTitle || connectionStatus.channelId,
      connectedAtLabel: connectionStatus.connectedAt.toLocaleDateString("vi-VN"),
    };
  }

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
        <div className="adminCard adminCardPad" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          {connectionBanner ? (
            <>
              <div>
                <strong>Kênh đã kết nối:</strong> {connectionBanner.channelLabel}
                <span className="adminHint" style={{ marginLeft: 8 }}>
                  từ {connectionBanner.connectedAtLabel}
                </span>
              </div>
              <form action={disconnectYoutubeAction}>
                <button type="submit" className="adminButton adminButtonSmall adminButtonDanger">Ngắt kết nối</button>
              </form>
            </>
          ) : (
            <>
              <div>
                <strong>Chưa kết nối kênh YouTube.</strong>{" "}
                {!youtubeService.isConfigured() && (
                  <span className="adminHint">Hệ thống chưa cấu hình OAuth client (xem biến môi trường YOUTUBE_OAUTH_*).</span>
                )}
              </div>
              <form action={startYoutubeConnectAction}>
                <button type="submit" className="adminButton adminButtonSmall adminButtonPrimary" disabled={!youtubeService.isConfigured()}>
                  Kết nối kênh YouTube
                </button>
              </form>
            </>
          )}
        </div>
      )}

      <AddVideoPanel canUpload={canUpload} canManageAny={canManageAny} />

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
                  <th>Sử dụng</th>
                  <th>Người upload</th>
                  <th>Ngày tạo</th>
                  <th style={{ minWidth: 150 }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {pageAssets.map((m) => {
                  const usage = usageByMediaId.get(m.id) ?? [];
                  const canManageThis = canManageAny || m.createdById === session.id;
                  const videoId = m.providerFileId;
                  return (
                    <tr key={m.id}>
                      <td>
                        {videoId ? (
                          // eslint-disable-next-line @next/next/no-img-element -- a public YouTube thumbnail URL, not a local asset next/image would optimize
                          <img
                            src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                            alt={m.filename ?? ""}
                            style={{ width: 80, height: 45, objectFit: "cover", borderRadius: "var(--admin-radius)" }}
                          />
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
                        {usage.length === 0 ? (
                          <span className="adminBadge adminBadgeNeutral">Chưa dùng</span>
                        ) : (
                          <span className="adminBadge adminBadgeWarning" title={usage.map((u) => u.entityLabel).join("; ")}>
                            Đang dùng · {usage.length} nơi
                          </span>
                        )}
                      </td>
                      <td className="adminHint">{m.createdBy?.displayName ?? "—"}</td>
                      <td className="adminHint">{m.createdAt.toLocaleDateString("vi-VN")}</td>
                      <td>
                        <VideoRowActions
                          mediaId={m.id}
                          title={m.filename ?? ""}
                          description={m.caption ?? ""}
                          visibility={m.visibility ?? "unlisted"}
                          canManage={canManageThis}
                          canSetAnyVisibility={canManageAny}
                          isAdmin={isAdmin}
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
