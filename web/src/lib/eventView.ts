import type { Event } from "@/domain/event";
import type { EventStatus } from "@/domain/event";
import type { MediaAsset } from "@/domain/media";
import { eventHref } from "@/lib/routes";

function midnight(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
function dd(d: Date) {
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}
function hh(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function duration(ms: number) {
  const m = Math.max(Math.round(ms / 60000), 0);
  const h = Math.floor(m / 60);
  if (h >= 1) return `${h} giờ${m % 60 ? ` ${m % 60} phút` : ""}`;
  return `${m} phút`;
}

export interface EventView {
  slug: string;
  cover: MediaAsset;
  title: string;
  place: string;
  isLive: boolean;
  order: number;
  sortKey: number;
  status: EventStatus;
  statusLabel: string;
  badgeBg: string;
  badgeFg: string;
  timeColor: string;
  titleColor: string;
  borderColor: string;
  cardOpacity: string;
  whenLine: string;
  dateLine: string;
  hasSeats: boolean;
  seatLine: string;
  seatColor: string;
  cta: string;
  ctaHref: string;
  /** Every event now links somewhere — either its own external `url`, or
   *  this app's `/su-kien/[slug]` detail page as a fallback. `ctaNote`
   *  (non-empty only in the fallback case) explains what isn't connected
   *  yet, shown alongside the link rather than in place of it. See
   *  "Không để href=#" in `docs/ROUTES.md`. */
  ctaNote: string;
}

export function buildEventView(e: Event, now: Date): EventView {
  const s = new Date(e.startAt);
  const en = new Date(e.endAt);
  const dayDiff = Math.round((midnight(s) - midnight(now)) / 86400000);
  const seats = e.capacity != null && e.registered != null;
  const full = seats && (e.registered as number) >= (e.capacity as number);

  let status: EventStatus = "upcoming";
  if (now >= s && now <= en) status = "live";
  else if (now > en) status = "completed";
  else if (full) status = "soldout";

  let when = "";
  if (status === "live") when = `${hh(s)} – ${hh(en)} · còn ${duration(en.getTime() - now.getTime())}`;
  else if (status === "completed") when = dayDiff === -1 ? "Hôm qua" : dayDiff >= -7 ? `${-dayDiff} ngày trước` : "Đã diễn ra";
  else if (dayDiff === 0) when = `Hôm nay · ${hh(s)}`;
  else if (dayDiff === 1) when = `Ngày mai · ${hh(s)}`;
  else if (dayDiff <= 7) when = `Còn ${dayDiff} ngày · ${hh(s)}`;
  else when = `Còn ${dayDiff} ngày`;

  const cta = { live: "Xem trực tuyến", upcoming: "Đăng ký", soldout: "Xem chi tiết", completed: "Xem lại" }[status];
  const note = {
    live: "Đường dẫn phiên trực tuyến do Ban tổ chức cung cấp — chưa có.",
    upcoming: "Cổng đăng ký chưa được kết nối.",
    soldout: "Trang chi tiết sự kiện chưa có.",
    completed: "Bản ghi chưa được đăng tải.",
  }[status];
  const skin = {
    live: { badgeBg: "var(--red-500)", badgeFg: "#fff", label: "Đang diễn ra", time: "var(--red-600)", title: "var(--text-strong)", border: "var(--red-100)", op: "1" },
    upcoming: { badgeBg: "rgba(255,255,255,.94)", badgeFg: "var(--brand-primary)", label: "Sắp diễn ra", time: "var(--text-brand)", title: "var(--text-strong)", border: "var(--border-subtle)", op: "1" },
    soldout: { badgeBg: "var(--amber-100)", badgeFg: "var(--ink-900)", label: "Hết chỗ", time: "var(--text-body)", title: "var(--text-strong)", border: "var(--border-subtle)", op: "1" },
    completed: { badgeBg: "rgba(255,255,255,.92)", badgeFg: "var(--text-muted)", label: "Đã kết thúc", time: "var(--text-muted)", title: "var(--text-muted)", border: "var(--border-subtle)", op: ".72" },
  }[status];

  return {
    slug: e.slug,
    cover: e.cover ?? { id: `${e.slug}-cover`, provider: "local-placeholder", type: "image", status: "missing" },
    title: e.title,
    place: e.place,
    isLive: status === "live",
    order: status === "live" ? 0 : status === "completed" ? 2 : 1,
    sortKey: s.getTime(),
    status,
    statusLabel: skin.label,
    badgeBg: skin.badgeBg,
    badgeFg: skin.badgeFg,
    timeColor: skin.time,
    titleColor: skin.title,
    borderColor: skin.border,
    cardOpacity: skin.op,
    whenLine: when,
    dateLine: dd(s) + (status === "completed" ? "" : ` · ${hh(s)}`),
    hasSeats: status !== "completed" && seats,
    seatLine: full
      ? "Hết chỗ — danh sách chờ mở khi có thông báo"
      : seats
        ? `Còn ${(e.capacity as number) - (e.registered as number)}/${e.capacity} suất`
        : "",
    seatColor: full ? "var(--text-body)" : "var(--text-muted)",
    cta: e.url ? cta : "Xem chi tiết sự kiện",
    ctaHref: e.url || eventHref(e.slug),
    ctaNote: e.url ? "" : note,
  };
}
