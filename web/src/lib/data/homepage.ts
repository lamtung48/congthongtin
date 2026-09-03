import type {
  FeaturedItem,
  StoryItem,
  TagItem,
  VideoItem,
  SearchCorpusItem,
  EventSource,
  GalleryItem,
  LocalNewsItem,
  FooterColumn,
} from "@/lib/types";

export const tags: TagItem[] = [
  { name: "DaiHoiXII", count: "48", href: "/chu-de/dai-hoi-xii" },
  { name: "SinhVien5Tot", count: "126", href: "/chu-de/sinh-vien-5-tot" },
  { name: "TinhNguyen", count: "203", href: "/chu-de/tinh-nguyen" },
  { name: "NghienCuuKhoaHoc", count: "87", href: "/chu-de/nghien-cuu-khoa-hoc" },
  { name: "HoiNhapQuocTe", count: "54", href: "/chu-de/hoi-nhap-quoc-te" },
  { name: "ChuyenDoiSo", count: "39", href: "/chu-de/chuyen-doi-so" },
];

export const featured: FeaturedItem[] = [
  { slug: "phien-thao-luan-viec-lam", category: "Hội nghị", date: "01.09.2026", title: "Phiên thảo luận về việc làm sau tốt nghiệp thu hút 200 đại biểu" },
  { slug: "ban-giao-12-diem-truong", category: "Tình nguyện", date: "31.08.2026", title: "Bàn giao 12 điểm trường tại Điện Biên trước năm học mới" },
  { slug: "boi-duong-can-bo-hoi", category: "Đào tạo", date: "30.08.2026", title: "Khai giảng lớp bồi dưỡng cán bộ Hội chủ chốt khoá 2026" },
];

export const stories: StoryItem[] = [
  { slug: "lop-hoc-ta-leng", place: "Điện Biên", date: "31.08.2026", headline: "Lớp học buổi tối trên đỉnh Tà Lèng", category: "Tình nguyện" },
  { slug: "so-hoa-han-nom", place: "Huế", date: "01.09.2026", headline: "Nhóm sinh viên số hoá 4.000 trang tư liệu Hán Nôm", category: "Nghiên cứu" },
  { slug: "quan-trac-man-can-tho", place: "Cần Thơ", date: "01.09.2026", headline: "Mô hình quan trắc mặn do sinh viên tự chế tạo", category: "Khoa học" },
  { slug: "ngoi-nha-viet-praha", place: "Praha, Séc", date: "29.08.2026", headline: "Ngôi nhà Việt của du học sinh giữa mùa đông châu Âu", category: "Hội nhập" },
  { slug: "day-tieng-viet-khiem-thi", place: "TP. Hồ Chí Minh", date: "28.08.2026", headline: "Ba năm dạy tiếng Việt cho trẻ khiếm thị", category: "Cộng đồng" },
  { slug: "y-te-sinh-vien-ha-giang", place: "Hà Giang", date: "28.08.2026", headline: "Đội hình y tế sinh viên đi bộ 14km mỗi đợt khám", category: "Tình nguyện" },
];

export const videos: VideoItem[] = [
  { videoId: "hsv-daihoi-khaimac", category: "Đại hội XII", duration: "04:57", date: "02.09.2026", title: "Toàn cảnh phiên khai mạc Đại hội đại biểu toàn quốc lần thứ XII", desc: "Bản dựng 5 phút về phiên khai mạc: chương trình nghị sự, các phiên thảo luận tổ và phát biểu của đại biểu sinh viên các vùng." },
  { videoId: "hsv-chan-dung-ta-leng", category: "Chân dung", duration: "08:22", date: "31.08.2026", title: "Người nữ sinh giữ lớp học vùng cao", desc: "Bốn năm liền, một nhóm sinh viên luân phiên lên Tà Lèng dạy lớp buổi tối cho trẻ em trong bản." },
  { videoId: "hsv-huong-dan-sv5t", category: "Hướng dẫn", duration: "06:10", date: "28.08.2026", title: "Hồ sơ “Sinh viên 5 tốt”: chuẩn bị thế nào cho đúng", desc: "Hướng dẫn từng bước theo bộ tiêu chí năm học 2026 – 2027, kèm ví dụ hồ sơ đã được công nhận." },
  { videoId: "", category: "Phóng sự", duration: "—", date: "26.08.2026", title: "Mùa hè xanh 2026: 148 công trình và những con đường mới", desc: "Phóng sự đang trong quá trình hậu kỳ. Nguồn video chưa được kết nối trong bản prototype." },
];

export const searchCorpus: SearchCorpusItem[] = [
  { title: "Đại hội đại biểu toàn quốc Hội Sinh viên Việt Nam lần thứ XII khai mạc tại Hà Nội", category: "Đại hội XII", date: "02.09.2026" },
  { title: "Tuyên dương 112 “Sinh viên 5 tốt” cấp Trung ương", category: "Sinh viên 5 tốt", date: "31.08.2026" },
  { title: "Hướng dẫn tiêu chuẩn xét chọn “Sinh viên 5 tốt” năm học 2026 – 2027", category: "Văn bản", date: "30.08.2026" },
  { title: "Chiến dịch “Mùa hè xanh” 2026 hoàn thành 148 công trình dân sinh", category: "Tình nguyện", date: "02.09.2026" },
  { title: "Diễn đàn sinh viên Việt Nam tại châu Âu lần thứ 9 mở đăng ký", category: "Hội nhập", date: "29.08.2026" },
  { title: "Trạm quan trắc không khí do sinh viên chế tạo đặt tại 12 trường phổ thông", category: "Nghiên cứu", date: "01.09.2026" },
];

/** Prototype fixture — event times are compared against a fixed demo "now" by default. */
export const eventsSource: EventSource[] = [
  { slug: "dai-hoi-xii-thao-luan-to", title: "Đại hội đại biểu toàn quốc lần thứ XII — phiên thảo luận tổ", place: "Trung tâm Hội nghị Quốc gia, Hà Nội", start: "2026-09-03T09:00:00", end: "2026-09-03T17:30:00", url: "", imageNeed: "Ảnh phiên thảo luận tổ — ngang, tối thiểu 1600px" },
  { slug: "tap-huan-can-bo-mien-trung", title: "Tập huấn cán bộ Hội cấp trường khu vực miền Trung", place: "Đại học Đà Nẵng", start: "2026-09-05T08:00:00", end: "2026-09-05T17:00:00", capacity: 300, registered: 260, url: "", imageNeed: "Ảnh lớp tập huấn cán bộ Hội — ngang" },
  { slug: "ngay-hoi-chuyen-doi-so", title: "Ngày hội “Sinh viên với chuyển đổi số” 2026", place: "TP. Hồ Chí Minh", start: "2026-09-12T08:30:00", end: "2026-09-12T16:00:00", capacity: 500, registered: 500, url: "/chu-de/sinh-vien-5-tot", imageNeed: "Ảnh ngày hội chuyển đổi số — ngang" },
  { slug: "dien-dan-sv-chau-au", title: "Diễn đàn sinh viên Việt Nam tại châu Âu lần thứ 9", place: "Praha, Cộng hoà Séc", start: "2026-09-26T09:00:00", end: "2026-09-27T17:00:00", url: "", imageNeed: "Ảnh diễn đàn du học sinh châu Âu — ngang" },
  { slug: "tuyen-duong-112-sv5t", title: "Lễ tuyên dương “Sinh viên 5 tốt” cấp Trung ương", place: "Hà Nội", start: "2026-08-28T14:00:00", end: "2026-08-28T17:00:00", url: "/tin/tuyen-duong-112-sv5t", imageNeed: "Ảnh lễ tuyên dương Sinh viên 5 tốt — ngang" },
];

/** Fixed "now" reference used by the prototype so every event status is reachable on demand. */
export const EVENTS_DEMO_NOW = "2026-09-03T11:20:00";

export const gallerySource: GalleryItem[] = [
  { caption: "Phiên khai mạc Đại hội đại biểu toàn quốc lần thứ XII", place: "Hà Nội", date: "02.09.2026", need: "Ảnh phiên khai mạc — ngang, tối thiểu 2400px" },
  { caption: "Đội hình tình nguyện Mùa hè xanh tại Điện Biên", place: "Điện Biên", date: "20.08.2026", need: "Ảnh đội hình tình nguyện — vuông" },
  { caption: "Lớp học buổi tối trên đỉnh Tà Lèng", place: "Điện Biên", date: "23.08.2026", need: "Ảnh lớp học buổi tối — vuông" },
  { caption: "Phòng thí nghiệm sinh viên Đại học Cần Thơ", place: "Cần Thơ", date: "29.08.2026", need: "Ảnh phòng thí nghiệm — vuông" },
  { caption: "Ngày hội văn hoá của du học sinh Việt Nam tại Praha", place: "Praha, Cộng hoà Séc", date: "29.08.2026", need: "Ảnh ngày hội văn hoá — vuông" },
  { caption: "Hiến máu “Chủ nhật đỏ” tại Thái Nguyên", place: "Thái Nguyên", date: "26.08.2026", need: "Ảnh hiến máu tình nguyện — vuông" },
  { caption: "Bàn giao điểm trường trước năm học mới", place: "Điện Biên", date: "31.08.2026", need: "Ảnh bàn giao điểm trường — vuông" },
  { caption: "Trạm quan trắc không khí do sinh viên chế tạo", place: "Hà Nội", date: "01.09.2026", need: "Ảnh trạm quan trắc — vuông" },
  { caption: "Tuyên dương “Sinh viên 5 tốt” cấp Trung ương", place: "Hà Nội", date: "28.08.2026", need: "Ảnh lễ tuyên dương — vuông" },
];

export const localSource: LocalNewsItem[] = [
  { level: "Tỉnh/thành", org: "Hội Sinh viên TP. Hà Nội", place: "Hà Nội", title: "Ra mắt mạng lưới câu lạc bộ học thuật liên trường", date: "02.09.2026", slug: "mang-luoi-clb-hoc-thuat", need: "Ảnh lễ ra mắt mạng lưới — 4:3" },
  { level: "Tỉnh/thành", org: "Hội Sinh viên TP. Đà Nẵng", place: "Đà Nẵng", title: "Chương trình “Sinh viên với biển đảo quê hương” khởi động", date: "30.08.2026", slug: "sinh-vien-voi-bien-dao", need: "Ảnh chương trình biển đảo — 4:3" },
  { level: "Trường", org: "Hội Sinh viên Đại học Bách khoa Hà Nội", place: "Hà Nội", title: "Sinh viên chế tạo trạm quan trắc không khí đặt tại 12 trường phổ thông", date: "01.09.2026", slug: "tram-quan-trac-khong-khi", need: "Ảnh trạm quan trắc — 4:3" },
  { level: "Trường", org: "Hội Sinh viên Đại học Cần Thơ", place: "Cần Thơ", title: "Mô hình quan trắc mặn của sinh viên được ứng dụng tại ba huyện", date: "29.08.2026", slug: "quan-trac-man-can-tho", need: "Ảnh mô hình quan trắc mặn — 4:3" },
  { level: "Hội ở nước ngoài", org: "Hội Sinh viên Việt Nam tại Nhật Bản", place: "Tokyo, Nhật Bản", title: "Ngày hội văn hoá Việt tại Tokyo thu hút 3.000 người tham dự", date: "31.08.2026", slug: "ngay-hoi-van-hoa-tokyo", need: "Ảnh ngày hội tại Tokyo — 4:3" },
  { level: "Hội ở nước ngoài", org: "Hội Sinh viên Việt Nam tại Pháp", place: "Paris, Pháp", title: "Diễn đàn nghiên cứu trẻ Việt – Pháp lần thứ 5", date: "28.08.2026", slug: "dien-dan-nghien-cuu-tre-viet-phap", need: "Ảnh diễn đàn tại Paris — 4:3" },
];

export const footerColumns: FooterColumn[] = [
  { title: "Về chúng tôi", items: [{ label: "Giới thiệu Hội" }, { label: "Điều lệ Hội" }, { label: "Ban Thư ký Trung ương" }, { label: "Liên hệ" }] },
  { title: "Nội dung", items: [{ label: "Tin tức", href: "/tin-tuc" }, { label: "Phong trào" }, { label: "Sinh viên 5 tốt", href: "/chu-de/sinh-vien-5-tot" }, { label: "Văn bản — hướng dẫn" }] },
  { title: "Nền tảng số", items: [{ label: "Hội nghị" }, { label: "Đào tạo" }, { label: "Tình nguyện" }, { label: "Dữ liệu & báo cáo" }] },
  { title: "Hỗ trợ", items: [{ label: "Hướng dẫn sử dụng" }, { label: "Câu hỏi thường gặp" }, { label: "Góp ý nội dung" }, { label: "Báo lỗi" }] },
];

export const socials = ["Facebook", "YouTube", "TikTok", "Zalo"];
export const policies = [
  { label: "Điều khoản sử dụng" },
  { label: "Chính sách dữ liệu cá nhân" },
];

export interface NavItem {
  label: string;
  href: string;
  soon?: boolean;
}

export const navAll: NavItem[] = [
  { label: "Trang chủ", href: "/" },
  { label: "Tin tức", href: "/tin-tuc" },
  { label: "Phong trào", href: "#", soon: true },
  { label: "Sinh viên 5 tốt", href: "/chu-de/sinh-vien-5-tot" },
  { label: "Hội nghị", href: "#", soon: true },
  { label: "Đào tạo", href: "#", soon: true },
  { label: "Giới thiệu", href: "#", soon: true },
];
