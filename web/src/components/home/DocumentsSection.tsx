import Link from "next/link";
import styles from "./DocumentsSection.module.css";
import { IconArrowRight } from "@/components/icons";
import { formatDateVi } from "@/lib/formatDate";
import type { PublicDocument } from "@/server/services/documentService";

/**
 * "Tài liệu" — the newest published văn bản, as download cards.
 *
 * Renders nothing when there is none, rather than a heading over an empty
 * grid: an organisation that has not posted a document yet should not have a
 * hole on its homepage announcing that. Same rule the platform bento follows.
 */
export function DocumentsSection({ documents }: { documents: PublicDocument[] }) {
  if (documents.length === 0) return null;

  return (
    <section aria-labelledby="documents-title" className={styles.section}>
      <div className={styles.head}>
        <div className={styles.headText}>
          <span className={styles.eyebrow}>Văn bản</span>
          <h2 id="documents-title" className={styles.title}>Tài liệu</h2>
          <p className={styles.desc}>
            Thông báo, kế hoạch, báo cáo, quyết định và hướng dẫn của Hội Sinh viên Việt Nam — tải về trực tiếp.
          </p>
        </div>
        <Link href="/tai-lieu" className={styles.allLink}>
          Tất cả tài liệu
          <IconArrowRight size={15} />
        </Link>
      </div>

      <div className={styles.grid}>
        {documents.map((d) => (
          <DocumentCard key={d.id} document={d} />
        ))}
      </div>
    </section>
  );
}

export function DocumentCard({ document: d }: { document: PublicDocument }) {
  // An uploaded file is served by this site; an external link opens where it
  // lives. Only the second one leaves the origin, so only it gets `noopener`
  // and a new tab.
  const external = !d.downloadUrl.startsWith("/");
  const content = (
    <>
      <span className={styles.icon} aria-hidden="true">{d.kindLabel}</span>
      <span className={styles.body}>
        {d.labelName && <span className={styles.label}>{d.labelName}</span>}
        <span className={styles.cardTitle}>{d.title}</span>
        <span className={styles.meta}>
          {d.documentNumber && <span>{d.documentNumber}</span>}
          {d.issuedAt && <span>{formatDateVi(d.issuedAt)}</span>}
          <span>{external ? "Mở liên kết ↗" : "Tải về ↓"}</span>
        </span>
      </span>
    </>
  );

  return external ? (
    <a href={d.downloadUrl} target="_blank" rel="noopener noreferrer" className={styles.card}>
      {content}
    </a>
  ) : (
    <a href={d.downloadUrl} className={styles.card}>
      {content}
    </a>
  );
}
