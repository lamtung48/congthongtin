import type { Metadata } from "next";
import { requirePermission } from "@/server/auth/guard";
import { taxonomyService } from "@/server/services/taxonomyService";
import { SOURCE_TYPE_LABELS } from "@/lib/sourceLabels";
import { createSourceAction } from "../actions";

export const metadata: Metadata = { title: "Nguồn mới" };

/** ADMIN only (brief section 1: "cấu hình source... token/integration") —
 *  MANAGER's role here is read-only (`source.view`), so this page never
 *  renders for them at all. */
export default async function NewSourcePage() {
  await requirePermission("source.manage");
  const categories = await taxonomyService.listCategories();

  return (
    <>
      <div className="adminPageHead">
        <div>
          <h1 className="adminPageTitle">Nguồn mới</h1>
          <p className="adminPageSubtitle">Đăng ký một nguồn nội dung bên ngoài để thu thập vào Social Inbox.</p>
        </div>
      </div>

      <form action={createSourceAction} className="adminCard adminCardPad" style={{ maxWidth: 640, display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="name">Tên nguồn</label>
          <input id="name" name="name" type="text" required className="adminInput" />
        </div>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="type">Loại nguồn</label>
          <select id="type" name="type" required defaultValue="RSS" className="adminSelect">
            {(Object.entries(SOURCE_TYPE_LABELS) as [string, string][])
              .filter(([value]) => value !== "MANUAL_EXTERNAL")
              .map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
          </select>
        </div>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="externalUrl">URL (feed RSS/Atom, website, hoặc Page/kênh)</label>
          <input id="externalUrl" name="externalUrl" type="text" placeholder="https://…" className="adminInput" />
        </div>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="externalId">ID nền tảng (Facebook Page ID / YouTube Channel ID)</label>
          <input id="externalId" name="externalId" type="text" className="adminInput" />
        </div>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="credential">Credential (Facebook Page access token / YouTube API key)</label>
          <input id="credential" name="credential" type="password" autoComplete="off" className="adminInput" />
          <p className="adminHint">Được mã hoá khi lưu — không hiển thị lại sau khi tạo.</p>
        </div>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="categoryId">Chuyên mục gợi ý khi chuyển thành bài (tuỳ chọn)</label>
          <select id="categoryId" name="categoryId" defaultValue="" className="adminSelect">
            <option value="">— Không chọn —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="includeHashtags">Chỉ lấy hashtag (mỗi dòng hoặc phẩy, để trống = lấy tất cả)</label>
          <textarea id="includeHashtags" name="includeHashtags" rows={2} placeholder="tinhnguyen, sinhvien5tot" className="adminInput" />
        </div>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="excludeHashtags">Loại trừ hashtag</label>
          <textarea id="excludeHashtags" name="excludeHashtags" rows={2} className="adminInput" />
        </div>
        <p className="adminHint">Rule hashtag chỉ áp dụng trên dữ liệu đã fetch hợp lệ từ nguồn — không tìm kiếm toàn nền tảng theo hashtag.</p>
        <button type="submit" className="adminButton adminButtonPrimary">Tạo nguồn</button>
      </form>
    </>
  );
}
