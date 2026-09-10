import type { Category, Topic } from "@/domain";

/**
 * Named after the sections a visitor actually reads on the homepage, so the
 * "Chuyên mục" dropdown an editor picks from and the site they are picking
 * for use the same words. Kept in sync with the migrations that realigned the
 * live rows — `20260906120000_categories_match_homepage`, then
 * `20260908090000_merge_phong_trao_sv5t`, which folded "Sinh viên 5 tốt" into
 * "Phong trào" as the single "Phong trào Sinh viên 5 tốt".
 */
export const CATEGORIES: Category[] = [
  { id: "tieu-diem", slug: "tieu-diem", name: "Tiêu điểm" },
  { id: "phong-trao-sinh-vien-5-tot", slug: "phong-trao-sinh-vien-5-tot", name: "Phong trào Sinh viên 5 tốt" },
  { id: "dong-chay-sinh-vien", slug: "dong-chay-sinh-vien", name: "Dòng chảy sinh viên" },
  { id: "tin-tu-co-so", slug: "tin-tu-co-so", name: "Tin từ cơ sở" },
  { id: "video-phong-su", slug: "video-phong-su", name: "Video và phóng sự" },
  { id: "hoi-nghi", slug: "hoi-nghi", name: "Hội nghị" },
  { id: "dao-tao", slug: "dao-tao", name: "Đào tạo" },
  { id: "van-ban-huong-dan", slug: "van-ban-huong-dan", name: "Văn bản — hướng dẫn" },
];

/** The pre-realignment names/slugs the fixture articles, videos and seed
 *  data still refer to, mapped onto their new home — so renaming the
 *  taxonomy didn't require rewriting every fixture that mentions one. */
const CATEGORY_ALIASES: Record<string, string> = {
  "phong-trao": "phong-trao-sinh-vien-5-tot",
  "Phong trào": "phong-trao-sinh-vien-5-tot",
  "sinh-vien-5-tot": "phong-trao-sinh-vien-5-tot",
  "Sinh viên 5 tốt": "phong-trao-sinh-vien-5-tot",
  "tinh-nguyen": "phong-trao-sinh-vien-5-tot",
  "Tình nguyện": "phong-trao-sinh-vien-5-tot",
  "cong-dong": "phong-trao-sinh-vien-5-tot",
  "Cộng đồng": "phong-trao-sinh-vien-5-tot",
  "nghien-cuu": "dong-chay-sinh-vien",
  "Nghiên cứu": "dong-chay-sinh-vien",
  "khoa-hoc": "dong-chay-sinh-vien",
  "Khoa học": "dong-chay-sinh-vien",
  "chan-dung": "dong-chay-sinh-vien",
  "Chân dung": "dong-chay-sinh-vien",
  "hoi-nhap": "tin-tu-co-so",
  "Hội nhập": "tin-tu-co-so",
  "dai-hoi-xii": "tieu-diem",
  "Đại hội XII": "tieu-diem",
  "phong-su": "video-phong-su",
  "Phóng sự": "video-phong-su",
  "huong-dan": "van-ban-huong-dan",
  "Hướng dẫn": "van-ban-huong-dan",
  "Văn bản": "van-ban-huong-dan",
};

function resolveAlias(key: string): Category | undefined {
  const slug = CATEGORY_ALIASES[key];
  return slug ? CATEGORIES.find((c) => c.slug === slug) : undefined;
}

export function categoryByName(name: string): Category {
  const found = CATEGORIES.find((c) => c.name === name) ?? resolveAlias(name);
  if (!found) throw new Error(`Unknown category: ${name}`);
  return found;
}

export function categoryBySlug(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug) ?? resolveAlias(slug);
}

export const TOPICS: Topic[] = [
  { id: "dai-hoi-xii", slug: "dai-hoi-xii", name: "DaiHoiXII", articleCount: 48, url: "/chu-de/dai-hoi-xii" },
  { id: "sinh-vien-5-tot", slug: "sinh-vien-5-tot", name: "SinhVien5Tot", articleCount: 126, url: "/chu-de/sinh-vien-5-tot" },
  { id: "tinh-nguyen", slug: "tinh-nguyen", name: "TinhNguyen", articleCount: 203, url: "/chu-de/tinh-nguyen" },
  { id: "nghien-cuu-khoa-hoc", slug: "nghien-cuu-khoa-hoc", name: "NghienCuuKhoaHoc", articleCount: 87, url: "/chu-de/nghien-cuu-khoa-hoc" },
  { id: "hoi-nhap-quoc-te", slug: "hoi-nhap-quoc-te", name: "HoiNhapQuocTe", articleCount: 54, url: "/chu-de/hoi-nhap-quoc-te" },
  { id: "chuyen-doi-so", slug: "chuyen-doi-so", name: "ChuyenDoiSo", articleCount: 39, url: "/chu-de/chuyen-doi-so" },
];

export function topicBySlug(slug: string): Topic | undefined {
  return TOPICS.find((t) => t.slug === slug);
}
