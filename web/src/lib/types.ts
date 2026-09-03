export type NewsCategory =
  | "Tình nguyện"
  | "Sinh viên 5 tốt"
  | "Nghiên cứu"
  | "Hội nhập"
  | "Đào tạo"
  | "Hội nghị";

export interface NewsItem {
  slug: string;
  cat: NewsCategory;
  date: string;
  title: string;
  lead: string;
  textOnly?: boolean;
}

export interface FeaturedItem {
  slug: string;
  category: string;
  date: string;
  title: string;
}

export interface StoryItem {
  slug: string;
  place: string;
  date: string;
  headline: string;
  category: string;
}

export interface TagItem {
  name: string;
  count: string;
  href: string;
}

export interface VideoItem {
  videoId: string;
  category: string;
  duration: string;
  date: string;
  title: string;
  desc: string;
}

export interface SearchCorpusItem {
  title: string;
  category: string;
  date: string;
}

export interface EventSource {
  slug: string;
  title: string;
  place: string;
  start: string;
  end: string;
  url: string;
  imageNeed: string;
  capacity?: number;
  registered?: number;
}

export type EventStatus = "live" | "upcoming" | "soldout" | "completed";

export interface GalleryItem {
  caption: string;
  place: string;
  date: string;
  need: string;
}

export type LocalNewsLevel = "Tỉnh/thành" | "Trường" | "Hội ở nước ngoài";

export interface LocalNewsItem {
  level: LocalNewsLevel;
  org: string;
  place: string;
  title: string;
  date: string;
  slug: string;
  need: string;
  unitUrl?: string;
}

export interface FooterLink {
  label: string;
  href?: string;
}

export interface FooterColumn {
  title: string;
  items: FooterLink[];
}

/* ---------- Activity map fixture shape (data/activity-map.sample.json) ---------- */

export interface ActivityMapCategory {
  slug: string;
  label: string;
}

export interface ActivityMapArchipelago {
  id: string;
  name: string;
  administered_by: string;
  lat: number;
  lon: number;
  islet_offsets: [number, number][];
  illustrative: boolean;
}

export interface ActivityMapProvince {
  province_id: string;
  province_name: string;
  slug: string;
  lat: number;
  lon: number;
  activity_count: number | null;
  article_count: number | null;
  unit_count: number | null;
  latest_article: { title: string; published_at: string } | null;
  category_distribution: Record<string, number> | null;
  student_count: number | null;
  reported: boolean;
  unit_url: string;
  period: string;
}

export interface ActivityMapOverseasCountry {
  name: string;
  activity_count: number;
}

export interface ActivityMapData {
  note: string;
  updated_at: string;
  summary: {
    total_activities: number;
    total_articles: number;
    participating_students: number;
    provinces_total: number;
    provinces_reported: number;
    period: string;
  };
  categories: ActivityMapCategory[];
  archipelagos: ActivityMapArchipelago[];
  provinces: ActivityMapProvince[];
  overseas: {
    label: string;
    countries: ActivityMapOverseasCountry[];
    note: string;
  };
  source: string;
  planned_endpoint: string;
  geometry_source: { name: string; unit_codes: string; verified: boolean };
  reporting_period: { label: string; from: string; to: string };
}

export type MapDataState = "api" | "loading" | "empty" | "error" | "geometry" | "stale";

export interface PlatformCard {
  id: string;
  name: string;
  url: string;
  desc: string;
  cta: string;
  access: string;
  note?: string;
  hasCta: boolean;
  metric?: string;
}
