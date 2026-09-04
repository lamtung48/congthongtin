import type { Province } from "@/domain/geo";

/**
 * Identity (slug/name/coordinates) for Vietnam's 34 provinces/centrally-run
 * cities — extracted once from `public/data/activity-map.json` so
 * `/dia-phuong/[slug]` and `/don-vi/[slug]` can look up a province's name
 * without depending on the map's own client-side data fetch (see
 * `docs/DATA_ACCESS.md` on why the activity map stays a client fetch).
 * Slugs match the map dataset's own `province.slug` field exactly.
 */
export const PROVINCES: Province[] = [
  { id: "ha-noi", slug: "ha-noi", name: "Hà Nội", lat: 21.028, lon: 105.854 },
  { id: "tp-ho-chi-minh", slug: "tp-ho-chi-minh", name: "TP. Hồ Chí Minh", lat: 10.776, lon: 106.7 },
  { id: "da-nang", slug: "da-nang", name: "Đà Nẵng", lat: 16.047, lon: 108.206 },
  { id: "hai-phong", slug: "hai-phong", name: "Hải Phòng", lat: 20.865, lon: 106.684 },
  { id: "hue", slug: "hue", name: "Huế", lat: 16.463, lon: 107.59 },
  { id: "can-tho", slug: "can-tho", name: "Cần Thơ", lat: 10.034, lon: 105.786 },
  { id: "tuyen-quang", slug: "tuyen-quang", name: "Tuyên Quang", lat: 21.823, lon: 105.214 },
  { id: "cao-bang", slug: "cao-bang", name: "Cao Bằng", lat: 22.666, lon: 106.258 },
  { id: "lai-chau", slug: "lai-chau", name: "Lai Châu", lat: 22.396, lon: 103.459 },
  { id: "lao-cai", slug: "lao-cai", name: "Lào Cai", lat: 22.485, lon: 103.975 },
  { id: "thai-nguyen", slug: "thai-nguyen", name: "Thái Nguyên", lat: 21.594, lon: 105.848 },
  { id: "dien-bien", slug: "dien-bien", name: "Điện Biên", lat: 21.386, lon: 103.017 },
  { id: "lang-son", slug: "lang-son", name: "Lạng Sơn", lat: 21.853, lon: 106.761 },
  { id: "son-la", slug: "son-la", name: "Sơn La", lat: 21.327, lon: 103.914 },
  { id: "phu-tho", slug: "phu-tho", name: "Phú Thọ", lat: 21.323, lon: 105.402 },
  { id: "bac-ninh", slug: "bac-ninh", name: "Bắc Ninh", lat: 21.186, lon: 106.076 },
  { id: "quang-ninh", slug: "quang-ninh", name: "Quảng Ninh", lat: 20.971, lon: 107.043 },
  { id: "hung-yen", slug: "hung-yen", name: "Hưng Yên", lat: 20.646, lon: 106.051 },
  { id: "ninh-binh", slug: "ninh-binh", name: "Ninh Bình", lat: 20.25, lon: 105.974 },
  { id: "thanh-hoa", slug: "thanh-hoa", name: "Thanh Hoá", lat: 19.807, lon: 105.776 },
  { id: "nghe-an", slug: "nghe-an", name: "Nghệ An", lat: 18.679, lon: 105.681 },
  { id: "ha-tinh", slug: "ha-tinh", name: "Hà Tĩnh", lat: 18.343, lon: 105.906 },
  { id: "quang-tri", slug: "quang-tri", name: "Quảng Trị", lat: 17.468, lon: 106.622 },
  { id: "quang-ngai", slug: "quang-ngai", name: "Quảng Ngãi", lat: 15.12, lon: 108.792 },
  { id: "gia-lai", slug: "gia-lai", name: "Gia Lai", lat: 13.782, lon: 109.219 },
  { id: "khanh-hoa", slug: "khanh-hoa", name: "Khánh Hoà", lat: 12.238, lon: 109.196 },
  { id: "lam-dong", slug: "lam-dong", name: "Lâm Đồng", lat: 11.94, lon: 108.442 },
  { id: "dak-lak", slug: "dak-lak", name: "Đắk Lắk", lat: 12.68, lon: 108.05 },
  { id: "dong-nai", slug: "dong-nai", name: "Đồng Nai", lat: 10.95, lon: 106.822 },
  { id: "tay-ninh", slug: "tay-ninh", name: "Tây Ninh", lat: 11.31, lon: 106.098 },
  { id: "vinh-long", slug: "vinh-long", name: "Vĩnh Long", lat: 10.253, lon: 105.972 },
  { id: "dong-thap", slug: "dong-thap", name: "Đồng Tháp", lat: 10.459, lon: 105.637 },
  { id: "an-giang", slug: "an-giang", name: "An Giang", lat: 10.012, lon: 105.081 },
  { id: "ca-mau", slug: "ca-mau", name: "Cà Mau", lat: 9.177, lon: 105.15 },
];

export function provinceBySlug(slug: string): Province | undefined {
  return PROVINCES.find((p) => p.slug === slug);
}
