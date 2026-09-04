import type { ArticleBlock } from "@/domain/articleContent";
import type { Author } from "@/domain/people";
import type { Tag, Topic } from "@/domain/taxonomy";
import type { MediaAsset } from "@/domain/media";
import { topicBySlug } from "./taxonomy";

/**
 * Extra fields merged onto an `Article` by slug, on top of whatever summary
 * fixture already resolved it (`HERO`, `LATEST_ARTICLES`, ...). Kept in its
 * own file instead of inflating every summary fixture, since only a couple
 * of articles need a full body today — see `docs/ARTICLE_DETAIL.md` for why
 * most article pages still render the "đang được biên tập" empty state.
 */
export interface ArticleContentExtra {
  body: ArticleBlock[];
  author?: Author;
  tags?: Tag[];
  topics?: Topic[];
  updatedAt?: string;
  readingTimeMinutes?: number;
}

const BAN_BIEN_TAP: Author = { id: "ban-bien-tap", name: "Ban Biên tập", title: "Cổng thông tin số Hội Sinh viên Việt Nam" };

const daiHoiCoverGallery: MediaAsset[] = [
  { id: "dhxii-gallery-1", provider: "drive", type: "image", status: "missing", placeholder: "Toàn cảnh hội trường phiên khai mạc", caption: "Toàn cảnh hội trường trong phiên khai mạc sáng 2/9." },
  { id: "dhxii-gallery-2", provider: "drive", type: "image", status: "missing", placeholder: "Đoàn chủ tịch điều hành đại hội", caption: "Đoàn chủ tịch điều hành phiên làm việc thứ nhất." },
  { id: "dhxii-gallery-3", provider: "drive", type: "image", status: "missing", placeholder: "Đại biểu sinh viên quốc tế dự đại hội", caption: "Đại biểu đại diện sinh viên Việt Nam ở nước ngoài tham dự đại hội." },
];

export const ARTICLE_CONTENT: Record<string, ArticleContentExtra> = {
  /**
   * Showcase article — the one place every block type is exercised at
   * once, linked from the homepage Hero (see `Hero.tsx` + `useArticleTransitionClick`).
   */
  "dai-hoi-xii-khai-mac": {
    author: BAN_BIEN_TAP,
    readingTimeMinutes: 6,
    updatedAt: "2026-09-02T10:15:00",
    tags: [
      { id: "dai-hoi-xii", slug: "dai-hoi-xii", name: "Đại hội XII" },
      { id: "to-chuc-hoi", slug: "to-chuc-hoi", name: "Tổ chức Hội" },
      { id: "ha-noi", slug: "ha-noi", name: "Hà Nội" },
    ],
    topics: [topicBySlug("dai-hoi-xii")].filter((t): t is Topic => !!t),
    body: [
      {
        type: "paragraph",
        id: "p1",
        runs: [
          { text: "Sáng 2/9, " },
          { text: "Đại hội đại biểu toàn quốc Hội Sinh viên Việt Nam lần thứ XII", bold: true },
          { text: " chính thức khai mạc tại Trung tâm Hội nghị Quốc gia, Hà Nội, với sự tham dự của hơn 700 đại biểu chính thức đại diện cho hơn 3 triệu hội viên, sinh viên trong cả nước và du học sinh Việt Nam ở nước ngoài." },
        ],
      },
      {
        type: "paragraph",
        id: "p2",
        runs: [
          { text: "Đại hội diễn ra trong bối cảnh phong trào sinh viên có nhiều chuyển biến về mô hình hoạt động số, đặt ra yêu cầu xây dựng phương hướng công tác Hội nhiệm kỳ 2026 – 2031 gắn với chuyển đổi số toàn diện. Nội dung này được đề cập chi tiết tại " },
          { text: "chuyên đề Đại hội XII", href: "/chu-de/dai-hoi-xii" },
          { text: "." },
        ],
      },
      { type: "heading", id: "h1", level: 2, text: "Ba nội dung trọng tâm của nhiệm kỳ mới" },
      {
        type: "paragraph",
        id: "p3",
        runs: [
          { text: "Báo cáo tại phiên khai mạc xác định ba nhóm nhiệm vụ trọng tâm: nâng cao chất lượng phong trào “Sinh viên 5 tốt”, mở rộng nền tảng số dùng chung cho cán bộ Hội cấp cơ sở, và tăng cường kết nối với mạng lưới sinh viên, du học sinh Việt Nam ở nước ngoài." },
        ],
      },
      {
        type: "image",
        id: "img1",
        caption: "Toàn cảnh hội trường trong phiên khai mạc sáng 2/9.",
        media: { id: "dhxii-inline-1", provider: "drive", type: "image", status: "missing", placeholder: "Ảnh toàn cảnh phiên khai mạc — ngang, tối thiểu 2000px", alt: "Toàn cảnh hội trường phiên khai mạc Đại hội XII" },
      },
      {
        type: "quote",
        id: "q1",
        text: "Mỗi nhiệm kỳ của Hội Sinh viên phải trả lời được câu hỏi: sinh viên hôm nay cần gì từ tổ chức của mình — không phải tổ chức cần gì từ sinh viên.",
        cite: "Phát biểu của đại biểu tại phiên thảo luận tổ, sáng 2/9",
      },
      { type: "heading", id: "h2", level: 2, text: "Hình ảnh tại đại hội" },
      { type: "gallery", id: "gal1", caption: "Một số hình ảnh tại phiên khai mạc.", items: daiHoiCoverGallery },
      {
        type: "youtube",
        id: "yt1",
        title: "Toàn cảnh phiên khai mạc Đại hội đại biểu toàn quốc Hội Sinh viên Việt Nam lần thứ XII",
        media: { id: "dhxii-video-1", provider: "youtube", type: "video", status: "missing", placeholder: "Video phiên khai mạc — kênh YouTube của Hội", alt: "Video phiên khai mạc Đại hội XII" },
      },
      { type: "heading", id: "h3", level: 2, text: "Cơ cấu đại biểu tham dự" },
      {
        type: "table",
        id: "tbl1",
        caption: "Số lượng đại biểu chính thức theo khu vực",
        headers: ["Khu vực", "Số đại biểu", "Tỷ lệ nữ"],
        rows: [
          ["Miền Bắc", "268", "54%"],
          ["Miền Trung – Tây Nguyên", "187", "49%"],
          ["Miền Nam", "203", "57%"],
          ["Du học sinh ở nước ngoài", "44", "52%"],
        ],
      },
      {
        type: "paragraph",
        id: "p4",
        runs: [
          { text: "Đại hội sẽ tiếp tục làm việc đến hết ngày 4/9 với các phiên thảo luận tổ, hiệp thương nhân sự Ban Chấp hành Trung ương Hội khoá mới và thông qua Điều lệ Hội (sửa đổi, bổ sung)." },
        ],
      },
      {
        type: "embed",
        id: "emb1",
        provider: "livestream",
        title: "Trực tiếp phiên khai mạc Đại hội XII",
        status: "missing",
      },
    ],
  },

  /** Simpler showcase — proves a second, independently-authored body works
   *  through the same block system, linked from the homepage's Featured
   *  News main card (see `FeaturedNews.tsx`). */
  "tuyen-duong-112-sv5t": {
    author: { id: "phong-thi-dua-khen-thuong", name: "Ban Thi đua – Khen thưởng Trung ương Hội" },
    readingTimeMinutes: 4,
    tags: [
      { id: "sinh-vien-5-tot", slug: "sinh-vien-5-tot", name: "Sinh viên 5 tốt" },
      { id: "tuyen-duong", slug: "tuyen-duong", name: "Tuyên dương" },
    ],
    topics: [topicBySlug("sinh-vien-5-tot")].filter((t): t is Topic => !!t),
    body: [
      {
        type: "paragraph",
        id: "p1",
        runs: [
          { text: "112 sinh viên tiêu biểu vừa được tuyên dương danh hiệu " },
          { text: "“Sinh viên 5 tốt” cấp Trung ương", bold: true },
          { text: " năm học 2025 – 2026, ghi nhận thành tích đồng thời ở học tập, nghiên cứu khoa học, thể lực, tình nguyện và hội nhập." },
        ],
      },
      { type: "heading", id: "h1", level: 2, text: "Nhiều gương mặt song hành nghiên cứu quốc tế và tình nguyện" },
      {
        type: "paragraph",
        id: "p2",
        runs: [
          { text: "Trong số các gương mặt được tuyên dương, nhiều sinh viên có công bố quốc tế vẫn duy trì hoạt động tình nguyện thường xuyên tại địa phương trong suốt bốn năm học — điểm được hội đồng xét chọn đánh giá cao so với các năm trước." },
        ],
      },
      {
        type: "quote",
        id: "q1",
        text: "Danh hiệu này không phải phần thưởng cho một năm học, mà là ghi nhận cho một cách sống suốt bốn năm đại học.",
        cite: "Đại diện Ban Thi đua – Khen thưởng Trung ương Hội",
      },
      {
        type: "paragraph",
        id: "p3",
        runs: [
          { text: "Danh sách đầy đủ 112 gương mặt được đăng tải trên " },
          { text: "chuyên đề Sinh viên 5 tốt", href: "/chu-de/sinh-vien-5-tot" },
          { text: "." },
        ],
      },
    ],
  },
};
