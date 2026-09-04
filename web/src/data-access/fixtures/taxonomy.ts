import type { Category, Topic } from "@/domain";

/** Prototype fixture — not yet wired to a CMS taxonomy service. */
export const CATEGORIES: Category[] = [
  { id: "tinh-nguyen", slug: "tinh-nguyen", name: "Tình nguyện" },
  { id: "sinh-vien-5-tot", slug: "sinh-vien-5-tot", name: "Sinh viên 5 tốt" },
  { id: "nghien-cuu", slug: "nghien-cuu", name: "Nghiên cứu" },
  { id: "hoi-nhap", slug: "hoi-nhap", name: "Hội nhập" },
  { id: "dao-tao", slug: "dao-tao", name: "Đào tạo" },
  { id: "hoi-nghi", slug: "hoi-nghi", name: "Hội nghị" },
  { id: "khoa-hoc", slug: "khoa-hoc", name: "Khoa học" },
  { id: "cong-dong", slug: "cong-dong", name: "Cộng đồng" },
  { id: "dai-hoi-xii", slug: "dai-hoi-xii", name: "Đại hội XII" },
  { id: "chan-dung", slug: "chan-dung", name: "Chân dung" },
  { id: "huong-dan", slug: "huong-dan", name: "Hướng dẫn" },
  { id: "phong-su", slug: "phong-su", name: "Phóng sự" },
];

export function categoryByName(name: string): Category {
  const found = CATEGORIES.find((c) => c.name === name);
  if (!found) throw new Error(`Unknown category: ${name}`);
  return found;
}

export function categoryBySlug(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
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
