import type { Event } from "@/domain/event";

interface RawEvent {
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

/** Prototype fixture — event times are compared against the real clock at
 *  render time (see `LiveEvents`, which reads `now` client-side for
 *  hydration safety), not a fixed demo timestamp. */
const RAW: RawEvent[] = [
  { slug: "dai-hoi-xii-thao-luan-to", title: "Đại hội đại biểu toàn quốc lần thứ XII — phiên thảo luận tổ", place: "Trung tâm Hội nghị Quốc gia, Hà Nội", start: "2026-09-03T09:00:00", end: "2026-09-03T17:30:00", url: "", imageNeed: "Ảnh phiên thảo luận tổ — ngang, tối thiểu 1600px" },
  { slug: "tap-huan-can-bo-mien-trung", title: "Tập huấn cán bộ Hội cấp trường khu vực miền Trung", place: "Đại học Đà Nẵng", start: "2026-09-05T08:00:00", end: "2026-09-05T17:00:00", capacity: 300, registered: 260, url: "", imageNeed: "Ảnh lớp tập huấn cán bộ Hội — ngang" },
  { slug: "ngay-hoi-chuyen-doi-so", title: "Ngày hội “Sinh viên với chuyển đổi số” 2026", place: "TP. Hồ Chí Minh", start: "2026-09-12T08:30:00", end: "2026-09-12T16:00:00", capacity: 500, registered: 500, url: "/chu-de/sinh-vien-5-tot", imageNeed: "Ảnh ngày hội chuyển đổi số — ngang" },
  { slug: "dien-dan-sv-chau-au", title: "Diễn đàn sinh viên Việt Nam tại châu Âu lần thứ 9", place: "Praha, Cộng hoà Séc", start: "2026-09-26T09:00:00", end: "2026-09-27T17:00:00", url: "", imageNeed: "Ảnh diễn đàn du học sinh châu Âu — ngang" },
  { slug: "tuyen-duong-112-sv5t", title: "Lễ tuyên dương “Sinh viên 5 tốt” cấp Trung ương", place: "Hà Nội", start: "2026-08-28T14:00:00", end: "2026-08-28T17:00:00", url: "/tin/tuyen-duong-112-sv5t", imageNeed: "Ảnh lễ tuyên dương Sinh viên 5 tốt — ngang" },
];

export const EVENTS: Event[] = RAW.map((r) => ({
  id: r.slug,
  slug: r.slug,
  title: r.title,
  place: r.place,
  startAt: r.start,
  endAt: r.end,
  url: r.url || undefined,
  cover: { kind: "image", placeholderNote: r.imageNeed },
  capacity: r.capacity,
  registered: r.registered,
}));
