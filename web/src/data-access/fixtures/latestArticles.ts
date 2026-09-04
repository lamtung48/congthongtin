import type { ArticleSummary } from "@/domain/article";
import { articleHref } from "@/lib/routes";
import { categoryByName } from "./taxonomy";

interface RawLatestArticle {
  slug: string;
  cat: string;
  date: string;
  title: string;
  lead: string;
  textOnly?: boolean;
}

/** Prototype fixture — not yet wired to a CMS. Dates are ISO; the original
 *  hand-authored fixture used pre-formatted "dd.MM.yyyy" strings, now
 *  produced on read via `formatDateVi` instead of baked into the data. */
const RAW: RawLatestArticle[] = [
  { slug: "mua-he-xanh-148-cong-trinh", cat: "Tình nguyện", date: "2026-09-02", title: "Chiến dịch “Mùa hè xanh” 2026 hoàn thành 148 công trình dân sinh", lead: "Gần 96.000 sinh viên tham gia 34 đội hình cấp tỉnh, tập trung vào đường giao thông nông thôn, điểm trường và hạ tầng nước sạch." },
  { slug: "huong-dan-sv5t-2026", cat: "Sinh viên 5 tốt", date: "2026-08-30", title: "Hướng dẫn mới về tiêu chuẩn xét chọn “Sinh viên 5 tốt” năm học 2026 – 2027", lead: "Bộ tiêu chí bổ sung phần đánh giá năng lực số và hoạt động cộng đồng tại địa phương.", textOnly: true },
  { slug: "bao-cao-ai-khu-vuc", cat: "Nghiên cứu", date: "2026-09-01", title: "Bốn nhóm sinh viên Việt Nam có báo cáo được nhận tại hội nghị AI khu vực", lead: "Các báo cáo tập trung vào xử lý tiếng Việt và mô hình dự báo ngập lụt đô thị." },
  { slug: "tiep-suc-mua-thi-truc-tuyen", cat: "Tình nguyện", date: "2026-08-28", title: "“Tiếp sức mùa thi” chuyển sang mô hình hỗ trợ trực tuyến toàn quốc", lead: "Tổng đài sinh viên tình nguyện trực 12 giờ mỗi ngày trong cao điểm tuyển sinh." },
  { slug: "quy-ho-tro-nghien-cuu", cat: "Nghiên cứu", date: "2026-08-27", title: "Quỹ hỗ trợ nghiên cứu sinh viên công bố 60 đề tài được tài trợ", lead: "Mức tài trợ cao nhất 80 triệu đồng cho đề tài có sản phẩm ứng dụng thực tế." },
  { slug: "tram-quan-trac-khong-khi", cat: "Nghiên cứu", date: "2026-09-01", title: "Trạm quan trắc không khí do sinh viên chế tạo đặt tại 12 trường phổ thông", lead: "Thiết bị có giá thành bằng một phần tư sản phẩm nhập khẩu tương đương." },
  { slug: "dien-dan-sv-chau-au", cat: "Hội nhập", date: "2026-08-29", title: "Diễn đàn sinh viên Việt Nam tại châu Âu lần thứ 9 mở đăng ký", lead: "Diễn đàn năm nay bàn về đường trở về của nhân lực trẻ sau đào tạo ở nước ngoài." },
  { slug: "tuyen-duong-112-sv5t", cat: "Sinh viên 5 tốt", date: "2026-08-31", title: "Tuyên dương 112 “Sinh viên 5 tốt” cấp Trung ương", lead: "Danh hiệu ghi nhận thành tích nghiên cứu quốc tế song hành với hoạt động tình nguyện tại địa phương." },
  { slug: "hoc-lieu-can-bo-hoi", cat: "Đào tạo", date: "2026-08-30", title: "Bộ học liệu mới cho cán bộ Hội cấp chi hội được mở truy cập tự do", lead: "Gồm 42 bài giảng ngắn về tổ chức hoạt động, truyền thông và quản lý tài chính chi hội." },
  { slug: "ngay-hoi-van-hoa-tokyo", cat: "Hội nhập", date: "2026-08-31", title: "Ngày hội văn hoá Việt tại Tokyo thu hút 3.000 người tham dự", lead: "Hội Sinh viên Việt Nam tại Nhật Bản phối hợp cùng bảy hội sinh viên vùng." },
  { slug: "quan-trac-man-can-tho", cat: "Nghiên cứu", date: "2026-08-29", title: "Mô hình quan trắc mặn của sinh viên được ứng dụng tại ba huyện", lead: "Dữ liệu độ mặn được gửi trực tiếp về điện thoại của hộ nuôi trồng thuỷ sản." },
  { slug: "hien-mau-chu-nhat-do", cat: "Tình nguyện", date: "2026-08-26", title: "“Chủ nhật đỏ” tại Thái Nguyên tiếp nhận 1.240 đơn vị máu", lead: "Chương trình mở rộng sang bốn trường cao đẳng trong tỉnh." },
  { slug: "hoc-bong-du-hoc-sinh", cat: "Hội nhập", date: "2026-08-25", title: "Mạng lưới du học sinh mở 30 suất hướng dẫn hồ sơ học bổng miễn phí", lead: "Người hướng dẫn là du học sinh đang theo học tại 12 quốc gia." },
  { slug: "sv5t-cap-truong-mo-rong", cat: "Sinh viên 5 tốt", date: "2026-08-24", title: "Danh hiệu “Sinh viên 5 tốt” cấp trường mở rộng tới 214 cơ sở giáo dục", lead: "Hội Sinh viên các trường được chủ động bổ sung tiêu chí đặc thù ngành." },
  { slug: "lop-hoc-ta-leng", cat: "Tình nguyện", date: "2026-08-23", title: "Lớp học buổi tối trên đỉnh Tà Lèng bước sang năm thứ tư", lead: "Bảy nhóm sinh viên luân phiên dạy học sau giờ lên lớp chính khoá." },
  { slug: "so-hoa-han-nom", cat: "Nghiên cứu", date: "2026-08-22", title: "Nhóm sinh viên Huế số hoá 4.000 trang tư liệu Hán Nôm", lead: "Toàn bộ bản số hoá được mở truy cập cho các trường và viện nghiên cứu." },
  { slug: "vat-lieu-tu-vo-tram", cat: "Nghiên cứu", date: "2026-08-21", title: "Vật liệu cách nhiệt làm từ vỏ trấu của sinh viên Cần Thơ đạt giải khu vực", lead: "Sản phẩm đang được thử nghiệm tại hai công trình nhà ở nông thôn." },
  { slug: "sinh-vien-nckh-ky-yeu", cat: "Nghiên cứu", date: "2026-08-20", title: "Kỷ yếu nghiên cứu sinh viên toàn quốc mở nhận bài đến hết tháng 10", lead: "Ban biên tập nhận cả báo cáo ngắn và bài tổng quan có người hướng dẫn.", textOnly: true },
  { slug: "xay-cau-dan-sinh-son-la", cat: "Tình nguyện", date: "2026-08-22", title: "Sinh viên xây bốn cầu dân sinh tại Sơn La trước mùa mưa", lead: "Công trình do sinh viên khối kỹ thuật thiết kế và giám sát thi công." },
  { slug: "so-hoa-ho-so-benh-an", cat: "Tình nguyện", date: "2026-08-21", title: "Sinh viên y khoa hỗ trợ số hoá hồ sơ tại 18 trạm y tế xã", lead: "Mỗi đội hình làm việc hai tuần, bàn giao kèm hướng dẫn sử dụng cho cán bộ trạm." },
  { slug: "tinh-nguyen-mua-thi-tay-nguyen", cat: "Tình nguyện", date: "2026-08-20", title: "Đội hình tình nguyện Tây Nguyên mở 60 lớp ôn thi miễn phí", lead: "Lớp học tổ chức tại nhà văn hoá thôn, ưu tiên học sinh lớp 12 vùng khó khăn." },
  { slug: "sv5t-ho-so-mau", cat: "Sinh viên 5 tốt", date: "2026-08-23", title: "Công bố 12 hồ sơ “Sinh viên 5 tốt” tiêu biểu làm tài liệu tham khảo", lead: "Hồ sơ được chọn từ ba khối ngành, kèm nhận xét của hội đồng xét chọn." },
  { slug: "sv5t-doi-thoai", cat: "Sinh viên 5 tốt", date: "2026-08-22", title: "Đối thoại giữa hội đồng xét chọn và sinh viên về tiêu chí thể lực", lead: "Nhiều ý kiến đề nghị công nhận thêm các môn thể thao phong trào trong trường." },
  { slug: "sv5t-mang-luoi-cuu-danh-hieu", cat: "Sinh viên 5 tốt", date: "2026-08-21", title: "Mạng lưới cựu “Sinh viên 5 tốt” nhận hướng dẫn hồ sơ cho khoá sau", lead: "Hơn 300 cựu sinh viên đăng ký làm người hướng dẫn trong năm học mới." },
  { slug: "du-hoc-sinh-ve-nuoc", cat: "Hội nhập", date: "2026-08-24", title: "Bốn nhóm du học sinh trở về tham gia đề án nghiên cứu trong nước", lead: "Các nhóm làm việc cùng phòng thí nghiệm của trường đại học đối tác." },
  { slug: "dien-dan-nghien-cuu-tre-viet-phap", cat: "Hội nhập", date: "2026-08-23", title: "Diễn đàn nghiên cứu trẻ Việt – Pháp lần thứ 5 tại Paris", lead: "Chủ đề năm nay là năng lượng tái tạo và quản lý nước đô thị." },
  { slug: "tieng-viet-cho-the-he-hai", cat: "Hội nhập", date: "2026-08-22", title: "Lớp tiếng Việt cho thế hệ thứ hai mở tại 9 địa bàn có đông người Việt", lead: "Giáo viên là du học sinh và nghiên cứu sinh đang học tập tại các nước sở tại." },
];

export const LATEST_ARTICLES: ArticleSummary[] = RAW.map((r) => ({
  id: r.slug,
  slug: r.slug,
  url: articleHref(r.slug),
  title: r.title,
  lead: r.lead,
  category: categoryByName(r.cat),
  publishedAt: r.date,
  isTextOnly: r.textOnly,
}));
