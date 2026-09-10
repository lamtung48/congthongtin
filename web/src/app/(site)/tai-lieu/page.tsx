import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";
import { documentService } from "@/server/services/documentService";
import { DocumentCard } from "@/components/home/DocumentsSection";
import { PageShell } from "@/components/ui/PageShell";
import { absoluteUrl } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Tài liệu",
  description: "Thông báo, kế hoạch, báo cáo, quyết định, quy chế và hướng dẫn của Hội Sinh viên Việt Nam.",
  alternates: { canonical: absoluteUrl("/tai-lieu") },
};

/**
 * Full listing behind the homepage's "Tài liệu" section. Filtering is a set
 * of links carrying `?nhan=`, not a client-side control: the filtered view is
 * then a real URL an editor can send to a chi hội, and the page stays a
 * Server Component with no JavaScript of its own.
 */
export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ nhan?: string }> }) {
  const { nhan } = await searchParams;
  const [labels, documents] = await Promise.all([
    documentService.listLabelsWithUsage(),
    documentService.listPublic(nhan ? { labelSlug: nhan } : {}),
  ]);
  const active = labels.find((l) => l.slug === nhan);

  return (
    <PageShell
      eyebrow="Văn bản"
      title="Tài liệu"
      description="Thông báo, kế hoạch, báo cáo, quyết định, quy chế và hướng dẫn của Hội Sinh viên Việt Nam — tải về trực tiếp."
      breadcrumb={[{ label: "Trang chủ", href: "/" }, { label: "Tài liệu" }]}
    >
      <nav aria-label="Lọc theo nhãn" className={styles.filters}>
        <Link href="/tai-lieu" className={nhan ? styles.filter : styles.filterOn}>
          Tất cả
        </Link>
        {labels
          .filter((l) => l._count.documents > 0)
          .map((l) => (
            <Link
              key={l.id}
              href={`/tai-lieu?nhan=${encodeURIComponent(l.slug)}`}
              className={l.slug === nhan ? styles.filterOn : styles.filter}
            >
              {l.name}
            </Link>
          ))}
      </nav>

      {documents.length === 0 ? (
        <p className={styles.empty}>
          {active ? `Chưa có tài liệu nào thuộc nhãn “${active.name}”.` : "Chưa có tài liệu nào được đăng."}
        </p>
      ) : (
        <div className={styles.grid}>
          {documents.map((d) => (
            <DocumentCard key={d.id} document={d} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
