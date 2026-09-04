import type { Gallery } from "@/domain/media";

interface RawGalleryItem {
  caption: string;
  place: string;
  date: string;
  need: string;
}

const RAW: RawGalleryItem[] = [
  { caption: "Phiên khai mạc Đại hội đại biểu toàn quốc lần thứ XII", place: "Hà Nội", date: "2026-09-02", need: "Ảnh phiên khai mạc — ngang, tối thiểu 2400px" },
  { caption: "Đội hình tình nguyện Mùa hè xanh tại Điện Biên", place: "Điện Biên", date: "2026-08-20", need: "Ảnh đội hình tình nguyện — vuông" },
  { caption: "Lớp học buổi tối trên đỉnh Tà Lèng", place: "Điện Biên", date: "2026-08-23", need: "Ảnh lớp học buổi tối — vuông" },
  { caption: "Phòng thí nghiệm sinh viên Đại học Cần Thơ", place: "Cần Thơ", date: "2026-08-29", need: "Ảnh phòng thí nghiệm — vuông" },
  { caption: "Ngày hội văn hoá của du học sinh Việt Nam tại Praha", place: "Praha, Cộng hoà Séc", date: "2026-08-29", need: "Ảnh ngày hội văn hoá — vuông" },
  { caption: "Hiến máu “Chủ nhật đỏ” tại Thái Nguyên", place: "Thái Nguyên", date: "2026-08-26", need: "Ảnh hiến máu tình nguyện — vuông" },
  { caption: "Bàn giao điểm trường trước năm học mới", place: "Điện Biên", date: "2026-08-31", need: "Ảnh bàn giao điểm trường — vuông" },
  { caption: "Trạm quan trắc không khí do sinh viên chế tạo", place: "Hà Nội", date: "2026-09-01", need: "Ảnh trạm quan trắc — vuông" },
  { caption: "Tuyên dương “Sinh viên 5 tốt” cấp Trung ương", place: "Hà Nội", date: "2026-08-28", need: "Ảnh lễ tuyên dương — vuông" },
];

export const HOMEPAGE_GALLERY: Gallery = {
  id: "homepage-activity-gallery",
  title: "Ảnh hoạt động",
  items: RAW.map((r, i) => ({
    id: `gallery-${i}`,
    provider: "drive",
    type: "image",
    status: "missing",
    caption: r.caption,
    placeholder: r.need,
    metadata: { locationLabel: r.place, capturedAt: r.date },
  })),
};
