import type { HeroContent } from "@/domain/homepage";
import type { SearchResultItem } from "@/domain/search";
import { articleHref } from "@/lib/routes";

// Nav/footer chrome moved to `@/lib/siteChrome` — shared, non-fixture site
// config both providers use unchanged. See that file's header comment.

export const HERO_SLUG = "dai-hoi-xii-khai-mac";

/** Prototype fixture. Used to be hardcoded directly in `Hero.tsx` JSX (an
 *  audit-flagged inconsistency with every other section, which reads its
 *  copy from data) — now sourced the same way as the rest of the homepage. */
export const HERO: HeroContent = {
  eyebrow: "Đại hội XII",
  headline: "Đại hội đại biểu toàn quốc Hội Sinh viên Việt Nam lần thứ XII",
  headlineAccent: "khai mạc tại Hà Nội",
  lead: "Hơn 700 đại biểu đại diện cho sinh viên cả nước và du học sinh Việt Nam ở nước ngoài thảo luận phương hướng công tác Hội nhiệm kỳ 2026 – 2031.",
  author: { id: "ban-bien-tap", name: "Ban Biên tập" },
  readingTimeMinutes: 6,
  topicLabel: "Chuyên đề Đại hội",
  publishedAt: "2026-09-02T07:40:00",
  articleUrl: articleHref(HERO_SLUG),
  secondaryCtaLabel: "Chuyên đề Đại hội XII",
  secondaryCtaHref: "/chu-de/dai-hoi-xii",
  media: {
    id: "hero-media",
    provider: "drive",
    type: "image",
    status: "missing",
    placeholder: "Ảnh phiên khai mạc Đại hội XII — ngang, tối thiểu 2400px",
    alt: "Đại hội đại biểu toàn quốc Hội Sinh viên Việt Nam lần thứ XII khai mạc tại Hà Nội",
    metadata: { locationLabel: "Trung tâm Hội nghị Quốc gia, Hà Nội" },
  },
};

interface RawSearchCorpusItem {
  slug: string;
  title: string;
  category: string;
  date: string;
}

/** Small, editorially-curated "Tìm nhiều nhất" suggestions for the search
 *  overlay's idle state — not the search index itself. Real queries go
 *  through `searchContent()`, whose index (`buildSearchIndex()` in
 *  `fixtureProvider.ts`) covers every `SearchResultType`, built fresh from
 *  the actual fixture pools rather than a hand-picked slug list like this
 *  one. See `docs/SEARCH_ARCHITECTURE.md`. */
const RAW_SEARCH_CORPUS: RawSearchCorpusItem[] = [
  { slug: "dai-hoi-xii-khai-mac", title: "Đại hội đại biểu toàn quốc Hội Sinh viên Việt Nam lần thứ XII khai mạc tại Hà Nội", category: "Đại hội XII", date: "2026-09-02" },
  { slug: "tuyen-duong-112-sv5t", title: "Tuyên dương 112 “Sinh viên 5 tốt” cấp Trung ương", category: "Sinh viên 5 tốt", date: "2026-08-31" },
  { slug: "huong-dan-sv5t-2026", title: "Hướng dẫn tiêu chuẩn xét chọn “Sinh viên 5 tốt” năm học 2026 – 2027", category: "Văn bản", date: "2026-08-30" },
  { slug: "mua-he-xanh-148-cong-trinh", title: "Chiến dịch “Mùa hè xanh” 2026 hoàn thành 148 công trình dân sinh", category: "Tình nguyện", date: "2026-09-02" },
  { slug: "dien-dan-sv-chau-au", title: "Diễn đàn sinh viên Việt Nam tại châu Âu lần thứ 9 mở đăng ký", category: "Hội nhập", date: "2026-08-29" },
  { slug: "tram-quan-trac-khong-khi", title: "Trạm quan trắc không khí do sinh viên chế tạo đặt tại 12 trường phổ thông", category: "Nghiên cứu", date: "2026-09-01" },
];

export const SEARCH_CORPUS: SearchResultItem[] = RAW_SEARCH_CORPUS.map((r) => ({
  id: `article:${r.slug}`,
  type: "article",
  url: articleHref(r.slug),
  title: r.title,
  category: r.category,
  publishedAt: r.date,
}));
