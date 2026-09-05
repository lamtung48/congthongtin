import type { Metadata } from "next";
import { requirePermission } from "@/server/auth/guard";
import { homepageRepository } from "@/server/repositories/homepageRepository";

export const metadata: Metadata = { title: "Homepage" };

const SECTION_LABELS: Record<string, string> = {
  HERO: "Hero",
  FEATURED_ARTICLES: "Tin nổi bật",
  STORY_RAIL: "Dòng chảy sinh viên",
  VIDEO_FEATURE: "Video nổi bật",
  PLATFORM_CARDS: "Nền tảng",
  EVENTS: "Sự kiện",
  GALLERY: "Thư viện ảnh",
  LOCAL_NEWS: "Tin địa phương",
};

/**
 * Read-only view of which sections have CMS-configured placements versus
 * which are currently relying on the automatic fallback query (brief
 * section 11: "phải giữ fallback tự động nếu CMS chưa cấu hình" —
 * `homepageService.ts`). Editing placements is out of this task's scope.
 */
export default async function AdminHomepagePage() {
  await requirePermission("homepage.manage");
  const config = await homepageRepository.findActiveConfiguration();
  const sections = config?.sections ?? [];

  return (
    <>
      <div className="adminPageHead">
        <div>
          <h1 className="adminPageTitle">Homepage</h1>
          <p className="adminPageSubtitle">
            {config ? `Cấu hình đang dùng: "${config.name}".` : "Chưa có cấu hình nào — toàn bộ trang chủ đang chạy theo fallback tự động."}
          </p>
        </div>
      </div>

      <div className="adminCard">
        <table className="adminTable">
          <thead>
            <tr>
              <th>Khu vực</th>
              <th>Trạng thái</th>
              <th>Số mục đã ghim</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(SECTION_LABELS).map(([key, label]) => {
              const section = sections.find((s) => s.key === key);
              const activeCount = section?.placements.filter((p) => p.isEnabled).length ?? 0;
              return (
                <tr key={key}>
                  <td>{label}</td>
                  <td>
                    {section?.isEnabled && activeCount > 0 ? (
                      <span className="adminBadge adminBadgeSuccess">Đã cấu hình</span>
                    ) : (
                      <span className="adminBadge adminBadgeNeutral">Dùng fallback tự động</span>
                    )}
                  </td>
                  <td className="adminHint">{activeCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
