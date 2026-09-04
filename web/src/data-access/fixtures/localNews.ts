import type { LocalNewsEntry } from "@/data-access/types";
import type { OrganizationLevel } from "@/domain/people";
import { articleHref } from "@/lib/routes";

const LEVEL_MAP: Record<string, OrganizationLevel> = {
  "Tỉnh/thành": "province",
  "Trường": "university",
  "Hội ở nước ngoài": "overseas",
};

interface RawLocalNews {
  level: string;
  org: string;
  place: string;
  title: string;
  date: string;
  slug: string;
  need: string;
  unitUrl?: string;
}

const RAW: RawLocalNews[] = [
  { level: "Tỉnh/thành", org: "Hội Sinh viên TP. Hà Nội", place: "Hà Nội", title: "Ra mắt mạng lưới câu lạc bộ học thuật liên trường", date: "2026-09-02", slug: "mang-luoi-clb-hoc-thuat", need: "Ảnh lễ ra mắt mạng lưới — 4:3" },
  { level: "Tỉnh/thành", org: "Hội Sinh viên TP. Đà Nẵng", place: "Đà Nẵng", title: "Chương trình “Sinh viên với biển đảo quê hương” khởi động", date: "2026-08-30", slug: "sinh-vien-voi-bien-dao", need: "Ảnh chương trình biển đảo — 4:3" },
  { level: "Trường", org: "Hội Sinh viên Đại học Bách khoa Hà Nội", place: "Hà Nội", title: "Sinh viên chế tạo trạm quan trắc không khí đặt tại 12 trường phổ thông", date: "2026-09-01", slug: "tram-quan-trac-khong-khi", need: "Ảnh trạm quan trắc — 4:3" },
  { level: "Trường", org: "Hội Sinh viên Đại học Cần Thơ", place: "Cần Thơ", title: "Mô hình quan trắc mặn của sinh viên được ứng dụng tại ba huyện", date: "2026-08-29", slug: "quan-trac-man-can-tho", need: "Ảnh mô hình quan trắc mặn — 4:3" },
  { level: "Hội ở nước ngoài", org: "Hội Sinh viên Việt Nam tại Nhật Bản", place: "Tokyo, Nhật Bản", title: "Ngày hội văn hoá Việt tại Tokyo thu hút 3.000 người tham dự", date: "2026-08-31", slug: "ngay-hoi-van-hoa-tokyo", need: "Ảnh ngày hội tại Tokyo — 4:3" },
  { level: "Hội ở nước ngoài", org: "Hội Sinh viên Việt Nam tại Pháp", place: "Paris, Pháp", title: "Diễn đàn nghiên cứu trẻ Việt – Pháp lần thứ 5", date: "2026-08-28", slug: "dien-dan-nghien-cuu-tre-viet-phap", need: "Ảnh diễn đàn tại Paris — 4:3" },
];

export const LOCAL_NEWS: LocalNewsEntry[] = RAW.map((r) => ({
  slug: r.slug,
  url: articleHref(r.slug),
  title: r.title,
  publishedAt: r.date,
  level: LEVEL_MAP[r.level],
  orgName: r.org,
  place: r.place,
  unitUrl: r.unitUrl,
  media: { kind: "image", placeholderNote: r.need },
}));
