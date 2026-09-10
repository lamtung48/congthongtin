import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/server/auth/guard";
import { galleryService } from "@/server/services/galleryService";
import { homepageService } from "@/server/services/homepageService";
import { adminImagePreviewUrl } from "@/lib/media/adminPreview";
import { GalleryPhotoUploader } from "../GalleryPhotoUploader";
import {
  updateGalleryAction,
  deleteGalleryAction,
  removePhotoAction,
  movePhotoAction,
  setPhotoCaptionAction,
  toggleGalleryOnHomepageAction,
} from "../actions";

export const metadata: Metadata = { title: "Sửa nhóm ảnh" };

export default async function GalleryEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("gallery.manage");
  const { id } = await params;
  const [gallery, pinnedId] = await Promise.all([galleryService.getById(id), homepageService.getPinnedGalleryId()]);
  if (!gallery) notFound();
  const pinned = pinnedId === gallery.id;

  return (
    <>
      <div className="adminPageHead">
        <div>
          <h1 className="adminPageTitle">{gallery.title}</h1>
          <p className="adminPageSubtitle">{gallery.items.length} ảnh · thứ tự dưới đây là thứ tự hiển thị trên trang chủ</p>
        </div>
        <Link href="/admin/media/galleries" className="adminButton">← Tất cả nhóm ảnh</Link>
      </div>

      <div className="adminCard adminCardPad" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <strong>{pinned ? "Đang hiển thị tại “Ảnh hoạt động” trên trang chủ." : "Chưa ghim lên trang chủ."}</strong>
          <p className="adminHint" style={{ margin: "2px 0 0" }}>
            {pinned
              ? "Bỏ ghim thì trang chủ quay lại hiển thị nhóm ảnh mới nhất."
              : "Mục “Ảnh hoạt động” chỉ hiển thị một nhóm — ghim nhóm này sẽ thay nhóm đang được ghim (nếu có)."}
          </p>
        </div>
        <form action={toggleGalleryOnHomepageAction}>
          <input type="hidden" name="galleryId" value={gallery.id} />
          <input type="hidden" name="pinned" value={pinned ? "false" : "true"} />
          <button type="submit" className={`adminButton adminButtonSmall${pinned ? "" : " adminButtonPrimary"}`}>
            {pinned ? "Gỡ khỏi trang chủ" : "★ Hiển thị trên trang chủ"}
          </button>
        </form>
      </div>

      <form action={updateGalleryAction} className="adminCard adminCardPad" style={{ display: "grid", gap: 10, maxWidth: 640, marginBottom: 16 }}>
        <input type="hidden" name="galleryId" value={gallery.id} />
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="g-title">Tên nhóm ảnh</label>
          <input id="g-title" name="title" type="text" required defaultValue={gallery.title} className="adminInput" />
        </div>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="g-desc">Mô tả</label>
          <input id="g-desc" name="description" type="text" defaultValue={gallery.description ?? ""} className="adminInput" />
        </div>
        <button type="submit" className="adminButton adminButtonPrimary" style={{ justifySelf: "start" }}>Lưu</button>
      </form>

      <div style={{ marginBottom: 16 }}>
        <GalleryPhotoUploader galleryId={gallery.id} nameHint={gallery.title} />
      </div>

      <div className="adminCard adminCardPad">
        <span className="adminLabel">Ảnh trong nhóm</span>
        {gallery.items.length === 0 ? (
          <div className="adminEmptyState">Chưa có ảnh nào. Kéo thả ảnh vào ô phía trên để thêm.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 14, marginTop: 10 }}>
            {gallery.items.map((item, i) => {
              const url = adminImagePreviewUrl(item.media);
              return (
                <div key={item.id} style={{ border: "1px solid var(--admin-border)", borderRadius: "var(--admin-radius)", overflow: "hidden" }}>
                  <div style={{ position: "relative", aspectRatio: "4/3", background: "var(--admin-bg)" }}>
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`${url}${url.startsWith("/api/media/") ? "?w=480" : ""}`}
                        alt={item.media.alt ?? ""}
                        loading="lazy"
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <span className="adminHint" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
                        Ảnh lỗi
                      </span>
                    )}
                    <span className="adminBadge adminBadgeNeutral" style={{ position: "absolute", top: 6, left: 6 }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>

                  <div style={{ padding: 8, display: "grid", gap: 6 }}>
                    <form action={setPhotoCaptionAction} style={{ display: "flex", gap: 4 }}>
                      <input type="hidden" name="itemId" value={item.id} />
                      <input type="hidden" name="galleryId" value={gallery.id} />
                      <input
                        name="caption"
                        type="text"
                        defaultValue={item.caption ?? ""}
                        placeholder="Chú thích ảnh…"
                        className="adminInput"
                        style={{ flex: 1, padding: "4px 8px", fontSize: 12 }}
                      />
                      <button type="submit" className="adminButton adminButtonSmall">Lưu</button>
                    </form>

                    <div style={{ display: "flex", gap: 4 }}>
                      <form action={movePhotoAction}>
                        <input type="hidden" name="itemId" value={item.id} />
                        <input type="hidden" name="galleryId" value={gallery.id} />
                        <input type="hidden" name="direction" value="up" />
                        <button type="submit" disabled={i === 0} className="adminButton adminButtonSmall" aria-label="Chuyển lên trước">←</button>
                      </form>
                      <form action={movePhotoAction}>
                        <input type="hidden" name="itemId" value={item.id} />
                        <input type="hidden" name="galleryId" value={gallery.id} />
                        <input type="hidden" name="direction" value="down" />
                        <button type="submit" disabled={i === gallery.items.length - 1} className="adminButton adminButtonSmall" aria-label="Chuyển xuống sau">→</button>
                      </form>
                      <form action={removePhotoAction} style={{ marginLeft: "auto" }}>
                        <input type="hidden" name="itemId" value={item.id} />
                        <input type="hidden" name="galleryId" value={gallery.id} />
                        <button type="submit" className="adminButton adminButtonSmall adminButtonDanger">Gỡ</button>
                      </form>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <form action={deleteGalleryAction} style={{ marginTop: 16 }}>
        <input type="hidden" name="galleryId" value={gallery.id} />
        <button type="submit" className="adminButton adminButtonDanger adminButtonSmall">Xoá nhóm ảnh này</button>
        <span className="adminHint" style={{ marginLeft: 8 }}>Chỉ xoá nhóm — các ảnh vẫn còn trong thư viện Media.</span>
      </form>
    </>
  );
}
