import type { Video } from "@/domain/video";
import { categoryByName } from "./taxonomy";

interface RawVideo {
  videoId: string;
  category: string;
  duration: string;
  date: string;
  title: string;
  desc: string;
}

const RAW: RawVideo[] = [
  { videoId: "hsv-daihoi-khaimac", category: "Đại hội XII", duration: "04:57", date: "2026-09-02", title: "Toàn cảnh phiên khai mạc Đại hội đại biểu toàn quốc lần thứ XII", desc: "Bản dựng 5 phút về phiên khai mạc: chương trình nghị sự, các phiên thảo luận tổ và phát biểu của đại biểu sinh viên các vùng." },
  { videoId: "hsv-chan-dung-ta-leng", category: "Chân dung", duration: "08:22", date: "2026-08-31", title: "Người nữ sinh giữ lớp học vùng cao", desc: "Bốn năm liền, một nhóm sinh viên luân phiên lên Tà Lèng dạy lớp buổi tối cho trẻ em trong bản." },
  { videoId: "hsv-huong-dan-sv5t", category: "Hướng dẫn", duration: "06:10", date: "2026-08-28", title: "Hồ sơ “Sinh viên 5 tốt”: chuẩn bị thế nào cho đúng", desc: "Hướng dẫn từng bước theo bộ tiêu chí năm học 2026 – 2027, kèm ví dụ hồ sơ đã được công nhận." },
  { videoId: "", category: "Phóng sự", duration: "—", date: "2026-08-26", title: "Mùa hè xanh 2026: 148 công trình và những con đường mới", desc: "Phóng sự đang trong quá trình hậu kỳ. Nguồn video chưa được kết nối trong bản prototype." },
];

export const VIDEOS: Video[] = RAW.map((r) => ({
  id: r.videoId || r.title,
  title: r.title,
  description: r.desc,
  category: categoryByName(r.category),
  durationLabel: r.duration,
  publishedAt: r.date,
  media: {
    id: `${r.videoId || r.title}-media`,
    provider: r.videoId ? "youtube" : "local-placeholder",
    type: "video",
    sourceId: r.videoId || undefined,
    status: r.videoId ? "ready" : "missing",
    placeholder: "Ảnh bìa phóng sự",
    alt: r.title,
  },
}));
