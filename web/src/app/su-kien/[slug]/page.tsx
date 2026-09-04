import type { Metadata } from "next";
import { notFound } from "next/navigation";
import styles from "./page.module.css";
import { PageShell } from "@/components/ui/PageShell";
import { MediaImage } from "@/components/ui/MediaImage";
import { IconArrowRight, IconMapPin } from "@/components/icons";
import { getEventBySlug } from "@/services/contentService";
import { pageMetadata } from "@/lib/seo";
import { eventHref } from "@/lib/routes";
import { formatDateTimeVi } from "@/lib/formatDate";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) {
    return pageMetadata({ title: "Không tìm thấy sự kiện", description: "Sự kiện không tồn tại.", path: eventHref(slug), noIndex: true });
  }
  return pageMetadata({ title: event.title, description: `${event.title} — ${event.place}.`, path: eventHref(event.slug) });
}

export default async function EventPage({ params }: Props) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  return (
    <PageShell
      breadcrumb={[{ label: "Trang chủ", href: "/" }, { label: "Sự kiện" }, { label: event.title }]}
      eyebrow="Sự kiện"
      title={event.title}
    >
      <div className={styles.body}>
        <div className={styles.meta}>
          <span>{formatDateTimeVi(event.startAt)} – {formatDateTimeVi(event.endAt)}</span>
        </div>
        <div className={styles.meta}>
          <IconMapPin size={14} />
          <span>{event.place}</span>
        </div>
        {event.cover && (
          <div className={styles.cover}>
            <MediaImage media={event.cover} />
          </div>
        )}
        <div className={styles.ctaRow}>
          {event.url ? (
            <a href={event.url} className={styles.cta}>
              Đăng ký / xem chi tiết
              <IconArrowRight size={15} />
            </a>
          ) : (
            <span className={styles.note}>Cổng đăng ký cho sự kiện này chưa được kết nối.</span>
          )}
        </div>
      </div>
    </PageShell>
  );
}
