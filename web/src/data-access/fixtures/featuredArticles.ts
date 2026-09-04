import type { FeaturedNewsResult } from "@/data-access/types";
import { articleHref } from "@/lib/routes";
import { categoryByName } from "./taxonomy";

const MAIN_SLUG = "tuyen-duong-112-sv5t";

/** Prototype fixture. The lead story used to be hardcoded directly in
 *  `FeaturedNews.tsx` JSX (an audit-flagged inconsistency) — it now lives
 *  here alongside the rest of the homepage content. */
export const FEATURED_ARTICLES: FeaturedNewsResult = {
  main: {
    id: MAIN_SLUG,
    slug: MAIN_SLUG,
    url: articleHref(MAIN_SLUG),
    title: "Tuyên dương 112 “Sinh viên 5 tốt” cấp Trung ương: những chân dung học tập và cống hiến",
    lead: "Danh hiệu năm nay ghi nhận nhiều sinh viên vừa đạt thành tích nghiên cứu quốc tế, vừa duy trì hoạt động tình nguyện tại địa phương trong suốt bốn năm học.",
    category: categoryByName("Sinh viên 5 tốt"),
    publishedAt: "2026-08-31",
    coverImage: { kind: "image", placeholderNote: "Ảnh bài tiêu điểm" },
  },
  secondary: [
    { slug: "phien-thao-luan-viec-lam", category: "Hội nghị", date: "2026-09-01", title: "Phiên thảo luận về việc làm sau tốt nghiệp thu hút 200 đại biểu" },
    { slug: "ban-giao-12-diem-truong", category: "Tình nguyện", date: "2026-08-31", title: "Bàn giao 12 điểm trường tại Điện Biên trước năm học mới" },
    { slug: "boi-duong-can-bo-hoi", category: "Đào tạo", date: "2026-08-30", title: "Khai giảng lớp bồi dưỡng cán bộ Hội chủ chốt khoá 2026" },
  ].map((r) => ({
    id: r.slug,
    slug: r.slug,
    url: articleHref(r.slug),
    title: r.title,
    category: categoryByName(r.category),
    publishedAt: r.date,
  })),
};
