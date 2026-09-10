import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/server/auth/guard";
import { galleryService } from "@/server/services/galleryService";
import { homepageService } from "@/server/services/homepageService";
import { adminImagePreviewUrl } from "@/lib/media/adminPreview";
import { createGalleryAction } from "./actions";
import { formatDateVi } from "@/lib/formatDate";

export const metadata: Metadata = { title: "Thư viện ảnh" };

/** "Ảnh hoạt động" on the homepage renders one gallery — the pinned one, or
 *  the most recent if nothing is pinned. */
export default async function GalleriesPage() {
  await requirePermission("gallery.manage");
  const [galleries, pinnedId] = await Promise.all([galleryService.list(), homepageService.getPinnedGalleryId()]);

  return (
    <>
      <div className="adminPageHead">
        <div>
          <h1 className="adminPageTitle">Thư viện ảnh</h1>
          <p className="adminPageSubtitle">
            Nhóm ảnh hiển thị ở mục “Ảnh hoạt động” trên trang chủ. Trang chủ hiển thị nhóm được ghim, hoặc nhóm mới nhất
            nếu chưa ghim nhóm nào.
          </p>
        </div>
      </div>

      <form action={createGalleryAction} className="adminCard adminCardPad" style={{ display: "grid", gap: 10, maxWidth: 640, marginBottom: 16 }}>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="g-title">Tạo nhóm ảnh mới</label>
          <input id="g-title" name="title" type="text" required placeholder="Ví dụ: Đại hội XII — ngày làm việc thứ nhất" className="adminInput" />
        </div>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="g-desc">Mô tả (tuỳ chọn)</label>
          <input id="g-desc" name="description" type="text" className="adminInput" />
        </div>
        <button type="submit" className="adminButton adminButtonPrimary" style={{ justifySelf: "start" }}>Tạo nhóm ảnh</button>
      </form>

      <div className="adminCard">
        {galleries.length === 0 ? (
          <div className="adminEmptyState">Chưa có nhóm ảnh nào. Tạo nhóm đầu tiên ở trên.</div>
        ) : (
          <div className="adminTableWrap">
            <table className="adminTable">
              <thead>
                <tr>
                  <th style={{ width: "45%" }}>Nhóm ảnh</th>
                  <th style={{ whiteSpace: "nowrap" }}>Số ảnh</th>
                  <th style={{ whiteSpace: "nowrap" }}>Trang chủ</th>
                  <th style={{ whiteSpace: "nowrap" }}>Ngày tạo</th>
                </tr>
              </thead>
              <tbody>
                {galleries.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <Link href={`/admin/media/galleries/${g.id}`} style={{ fontWeight: 600 }}>{g.title}</Link>
                      {g.description && <div className="adminHint" style={{ marginTop: 2 }}>{g.description}</div>}
                      <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                        {g.items.slice(0, 6).map((it) => {
                          const url = adminImagePreviewUrl(it.media);
                          return url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={it.id}
                              src={`${url}${url.startsWith("/api/media/") ? "?w=320" : ""}`}
                              alt=""
                              loading="lazy"
                              style={{ width: 42, height: 42, objectFit: "cover", borderRadius: 4 }}
                            />
                          ) : null;
                        })}
                        {g.items.length > 6 && <span className="adminHint" style={{ alignSelf: "center" }}>+{g.items.length - 6}</span>}
                      </div>
                    </td>
                    <td className="adminHint">{g.items.length}</td>
                    <td>
                      {pinnedId === g.id ? (
                        <span className="adminBadge adminBadgeBrand">★ Đang hiển thị</span>
                      ) : (
                        <span className="adminHint">—</span>
                      )}
                    </td>
                    <td className="adminHint" style={{ whiteSpace: "nowrap" }}>{formatDateVi(g.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
