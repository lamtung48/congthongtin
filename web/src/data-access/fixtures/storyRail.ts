import type { StoryRailItem } from "@/data-access/types";
import { articleHref } from "@/lib/routes";
import { categoryByName } from "./taxonomy";

interface RawStory {
  slug: string;
  place: string;
  date: string;
  headline: string;
  category: string;
}

const RAW: RawStory[] = [
  { slug: "lop-hoc-ta-leng", place: "Điện Biên", date: "2026-08-31", headline: "Lớp học buổi tối trên đỉnh Tà Lèng", category: "Tình nguyện" },
  { slug: "so-hoa-han-nom", place: "Huế", date: "2026-09-01", headline: "Nhóm sinh viên số hoá 4.000 trang tư liệu Hán Nôm", category: "Nghiên cứu" },
  { slug: "quan-trac-man-can-tho", place: "Cần Thơ", date: "2026-09-01", headline: "Mô hình quan trắc mặn do sinh viên tự chế tạo", category: "Khoa học" },
  { slug: "ngoi-nha-viet-praha", place: "Praha, Séc", date: "2026-08-29", headline: "Ngôi nhà Việt của du học sinh giữa mùa đông châu Âu", category: "Hội nhập" },
  { slug: "day-tieng-viet-khiem-thi", place: "TP. Hồ Chí Minh", date: "2026-08-28", headline: "Ba năm dạy tiếng Việt cho trẻ khiếm thị", category: "Cộng đồng" },
  { slug: "y-te-sinh-vien-ha-giang", place: "Hà Giang", date: "2026-08-28", headline: "Đội hình y tế sinh viên đi bộ 14km mỗi đợt khám", category: "Tình nguyện" },
];

export const STORY_RAIL: StoryRailItem[] = RAW.map((r) => ({
  slug: r.slug,
  url: articleHref(r.slug),
  place: r.place,
  publishedAt: r.date,
  headline: r.headline,
  category: categoryByName(r.category),
}));
