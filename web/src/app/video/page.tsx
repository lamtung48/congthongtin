import type { Metadata } from "next";
import styles from "./page.module.css";
import { PageShell } from "@/components/ui/PageShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { MediaImage } from "@/components/ui/MediaImage";
import { getVideos } from "@/services/homepageService";
import { pageMetadata } from "@/lib/seo";
import { formatDateVi } from "@/lib/formatDate";

export const metadata: Metadata = pageMetadata({
  title: "Video & phóng sự",
  description: "Toàn bộ video và phóng sự trên kênh của Hội Sinh viên Việt Nam.",
  path: "/video",
});

export default async function VideoIndexPage() {
  const videos = await getVideos();

  return (
    <PageShell
      breadcrumb={[{ label: "Trang chủ", href: "/" }, { label: "Video & phóng sự" }]}
      eyebrow="Kênh YouTube của Hội"
      title="Video & phóng sự"
      description="Toàn bộ video và phóng sự đã phát hành."
    >
      {videos.length === 0 ? (
        <EmptyState title="Chưa có video" description="Chưa có video nào trong dữ liệu hiện có." />
      ) : (
        <div className={styles.grid}>
          {videos.map((v) => (
            <article key={v.id} className={styles.card}>
              <div className={styles.thumb}>
                <MediaImage media={v.media} />
              </div>
              <div className={styles.meta}>
                <span className={styles.cat}>{v.category.name}</span>
                <span className={styles.duration}>{v.durationLabel}</span>
                <span className={styles.duration}>{formatDateVi(v.publishedAt)}</span>
              </div>
              <h3 className={styles.title}>{v.title}</h3>
            </article>
          ))}
        </div>
      )}
    </PageShell>
  );
}
