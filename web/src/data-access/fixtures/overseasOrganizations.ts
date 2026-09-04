import type { OverseasOrganization } from "@/domain/geo";
import { slugifyOverseasName } from "@/lib/slug";

/**
 * Identity for the 16 overseas Hội Sinh viên chapters — extracted once from
 * `public/data/activity-map.json`'s `overseas.countries` list, which only
 * carries `name`/`activity_count`. Unlike provinces, the map dataset has no
 * `slug` field here, so `id` is derived via `slugify()` on the country name
 * (stripping the shared "Hội Sinh viên Việt Nam tại " prefix, matching how
 * `VietnamMapSvg` already displays these names).
 */
const COUNTRIES = [
  "Australia",
  "Pháp",
  "Singapore",
  "Thái Lan",
  "Italia",
  "Hàn Quốc",
  "Bỉ",
  "Hungary",
  "Đức",
  "New Zealand",
  "Vương quốc Anh",
  "Hà Lan",
  "Áo",
  "Liên bang Nga",
  "Ireland",
  "Ấn Độ",
];

export const OVERSEAS_ORGANIZATIONS: OverseasOrganization[] = COUNTRIES.map((country) => {
  const name = `Hội Sinh viên Việt Nam tại ${country}`;
  return { id: slugifyOverseasName(name), name, country };
});

export function overseasOrganizationBySlug(slug: string): OverseasOrganization | undefined {
  return OVERSEAS_ORGANIZATIONS.find((o) => o.id === slug);
}
