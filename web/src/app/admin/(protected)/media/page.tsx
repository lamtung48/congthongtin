import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/server/auth/session";
import { hasPermission } from "@/server/auth/permissions";
import { mediaService } from "@/server/services/mediaService";
import { userRepository } from "@/server/repositories/userRepository";
import type { MediaAdminFilter, MediaUsageDetail } from "@/server/repositories/mediaRepository";
import type { MediaStatus, MediaType } from "@/generated/prisma/client";
import { MediaRowActions } from "./MediaRowActions";

export const metadata: Metadata = { title: "Media" };

const PAGE_SIZE = 20;

const TYPE_LABELS: Record<MediaType, string> = { IMAGE: "Ảnh", VIDEO: "Video" };
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
  type?: string;
  status?: string;
  usage?: string;
  from?: string;
  to?: string;
  page?: string;
}

/**
 * Brief section 5: everyone (including CONTRIBUTOR) sees the full library
 * here — `mediaService.listForAdmin` deliberately doesn't scope by actor
 * (see its own header comment) — "để tái sử dụng"; only the per-row manage
 * controls (`MediaRowActions`) are gated to what that actor is actually
 * allowed to edit/delete, same "don't hide-as-authorization, do check
 * server-side too" discipline as `/admin/articles`.
 *
 * The "usage" filter (đang dùng / chưa dùng) has no backing database column
 * — `MediaUsageDetail` is computed by walking every FK/`MediaUsage` row per
 * asset — so filtering by it can't be pushed into the `WHERE` clause the way
 * uploader/type/status/date can. When it's active this scans up to
 * `USAGE_SCAN_LIMIT` matching rows and paginates the filtered result
 * in-memory instead of at the database. Acceptable for an internal admin
 * tool at this CMS's scale; not something to do for a public-facing list.
 */
const USAGE_SCAN_LIMIT = 500;

export default async function AdminMediaPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireSession();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const canManageAny = hasPermission(session.role, "media.manage.any");
  const isAdmin = session.role === "ADMIN";

  const baseFilter: MediaAdminFilter = {
    createdById: params.uploader || undefined,
    type: (params.type as MediaType) || undefined,
    status: (params.status as MediaStatus) || undefined,
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
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filterQueryOnly: Record<string, string | undefined> = {
    uploader: params.uploader,
    type: params.type,
    status: params.status,
    usage: params.usage,
    from: params.from,
    to: params.to,
  };

  return (
    <>
      <div className="adminPageHead">
        <div>
          <h1 className="adminPageTitle">Media</h1>
          <p className="adminPageSubtitle">Toàn bộ tệp media trong hệ thống — dùng để tái sử dụng trong bài viết.</p>
        </div>
      </div>

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
          <label className="adminLabel" htmlFor="f-type">Loại tệp</label>
          <select id="f-type" name="type" defaultValue={params.type ?? ""} className="adminSelect">
            <option value="">Tất cả</option>
            {(Object.keys(TYPE_LABELS) as MediaType[]).map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
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
        <Link href="/admin/media" className="adminButton">Xoá lọc</Link>
      </form>

      <div className="adminCard">
        {pageAssets.length === 0 ? (
          <div className="adminEmptyState">Không có media nào khớp bộ lọc.</div>
        ) : (
          <div className="adminTableWrap">
            <table className="adminTable">
              <thead>
                <tr>
                  <th>Xem trước</th>
                  <th>Tên tệp</th>
                  <th>Loại</th>
                  <th>Nguồn</th>
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
                  const previewUrl = m.provider === "GOOGLE_DRIVE" && m.status === "READY" ? `/api/media/${m.id}` : null;
                  return (
                    <tr key={m.id}>
                      <td>
                        {previewUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- admin-only thumbnail, unoptimized is already the site-wide next/image config
                          <img src={previewUrl} alt={m.alt ?? ""} style={{ width: 48, height: 48, objectFit: "cover", borderRadius: "var(--admin-radius)" }} />
                        ) : (
                          <span className="adminHint">—</span>
                        )}
                      </td>
                      <td>{m.filename ?? m.caption ?? m.id}</td>
                      <td className="adminHint">{TYPE_LABELS[m.type]}</td>
                      <td className="adminHint">{m.provider}</td>
                      <td><span className={`adminBadge ${STATUS_BADGE[m.status]}`}>{STATUS_LABELS[m.status]}</span></td>
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
                        <MediaRowActions mediaId={m.id} alt={m.alt ?? ""} caption={m.caption ?? ""} canManage={canManageThis} isAdmin={isAdmin} />
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
          <span>Trang {page}/{totalPages} · {total} media</span>
          {page > 1 && (
            <Link href={`/admin/media${buildQuery(filterQueryOnly, { page: String(page - 1) })}`} className="adminButton adminButtonSmall">← Trước</Link>
          )}
          {page < totalPages && (
            <Link href={`/admin/media${buildQuery(filterQueryOnly, { page: String(page + 1) })}`} className="adminButton adminButtonSmall">Sau →</Link>
          )}
        </div>
      )}
    </>
  );
}
