import type { Metadata } from "next";
import { requirePermission } from "@/server/auth/guard";
import { siteAppearanceService } from "@/server/services/siteAppearanceService";
import { userRepository } from "@/server/repositories/userRepository";
import { formatDateTimeVi } from "@/lib/formatDate";
import { AppearanceEditor } from "./AppearanceEditor";

export const metadata: Metadata = { title: "Giao diện" };

/**
 * Site-wide background colour. `system.configure` (ADMIN only) rather than
 * `homepage.manage`: this repaints every public page at once, which is a
 * system setting, not editorial arrangement of one section.
 */
export default async function AdminAppearancePage() {
  await requirePermission("system.configure");
  const appearance = await siteAppearanceService.get();
  const editor = appearance.updatedById ? await userRepository.findById(appearance.updatedById) : null;
  const lastUpdatedLabel = appearance.updatedAt
    ? `Cập nhật ${formatDateTimeVi(appearance.updatedAt.toISOString())}${editor ? ` bởi ${editor.displayName}` : ""}`
    : null;

  return (
    <>
      <div className="adminPageHead">
        <div>
          <h1 className="adminPageTitle">Giao diện</h1>
          <p className="adminPageSubtitle">
            Đổi màu nền cho toàn bộ trang công khai. Màu chọn sẽ áp dụng cho nền trang, thẻ tin, dải nền xen kẽ
            và đường kẻ — chữ, nút, huy hiệu và ảnh bìa giữ nguyên theo bộ nhận diện.
          </p>
        </div>
      </div>

      <AppearanceEditor initialBackground={appearance.pageBackground} lastUpdatedLabel={lastUpdatedLabel} />
    </>
  );
}
