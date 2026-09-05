import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/server/auth/guard";
import { taxonomyService } from "@/server/services/taxonomyService";
import { sourceService } from "@/server/services/sourceService";
import { SOURCE_TYPE_LABELS } from "@/lib/sourceLabels";
import { updateSourceAction } from "../../actions";

export const metadata: Metadata = { title: "Chỉnh sửa nguồn" };

/** ADMIN only — same reasoning as `new/page.tsx`. */
export default async function EditSourcePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission("source.manage");
  const { id } = await params;
  const source = await sourceService.getById(session, id);
  if (!source) notFound();
  const categories = await taxonomyService.listCategories();

  return (
    <>
      <div className="adminPageHead">
        <div>
          <h1 className="adminPageTitle">{source.name}</h1>
          <p className="adminPageSubtitle">{SOURCE_TYPE_LABELS[source.type]}</p>
        </div>
      </div>

      <form action={updateSourceAction} className="adminCard adminCardPad" style={{ maxWidth: 640, display: "flex", flexDirection: "column", gap: 14 }}>
        <input type="hidden" name="sourceId" value={source.id} />
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="name">Tên nguồn</label>
          <input id="name" name="name" type="text" required defaultValue={source.name} className="adminInput" />
        </div>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="type">Loại nguồn</label>
          <select id="type" name="type" required defaultValue={source.type} className="adminSelect">
            {(Object.entries(SOURCE_TYPE_LABELS) as [string, string][])
              .filter(([value]) => value !== "MANUAL_EXTERNAL")
              .map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
          </select>
        </div>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="externalUrl">URL (feed RSS/Atom, website, hoặc Page/kênh)</label>
          <input id="externalUrl" name="externalUrl" type="text" defaultValue={source.externalUrl ?? ""} className="adminInput" />
        </div>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="externalId">ID nền tảng (Facebook Page ID / YouTube Channel ID)</label>
          <input id="externalId" name="externalId" type="text" defaultValue={source.externalId ?? ""} className="adminInput" />
        </div>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="credential">Credential (Facebook Page access token / YouTube API key)</label>
          <input id="credential" name="credential" type="password" autoComplete="off" placeholder="Để trống nếu không đổi" className="adminInput" />
          <p className="adminHint">Không hiển thị giá trị đã lưu — chỉ nhập khi muốn thay bằng giá trị mới.</p>
        </div>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="categoryId">Chuyên mục gợi ý khi chuyển thành bài</label>
          <select id="categoryId" name="categoryId" defaultValue={source.categoryId ?? ""} className="adminSelect">
            <option value="">— Không chọn —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="includeHashtags">Chỉ lấy hashtag (mỗi dòng hoặc phẩy, để trống = lấy tất cả)</label>
          <textarea id="includeHashtags" name="includeHashtags" rows={2} defaultValue={source.includeHashtags.join(", ")} className="adminInput" />
        </div>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="excludeHashtags">Loại trừ hashtag</label>
          <textarea id="excludeHashtags" name="excludeHashtags" rows={2} defaultValue={source.excludeHashtags.join(", ")} className="adminInput" />
        </div>
        <button type="submit" className="adminButton adminButtonPrimary" style={{ alignSelf: "flex-start" }}>Lưu</button>
      </form>
    </>
  );
}
