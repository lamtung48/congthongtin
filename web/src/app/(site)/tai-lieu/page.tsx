import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";
import { documentService, type PublicDocument } from "@/server/services/documentService";
import { PageHero } from "@/components/ui/PageHero";
import { IconArrowRight, IconDownload, IconExternal, IconFileText, IconMail } from "@/components/icons";
import { absoluteUrl } from "@/lib/siteConfig";
import { formatDateVi } from "@/lib/formatDate";
import { SITE_FOOTER_CONTACT_EMAIL } from "@/lib/siteChrome";

export const metadata: Metadata = {
  title: "Tài liệu",
  description: "Thông báo, kế hoạch, báo cáo, quyết định, quy chế và hướng dẫn của Hội Sinh viên Việt Nam.",
  alternates: { canonical: absoluteUrl("/tai-lieu") },
};

/** Badge colour per file kind — the one glance cue for "what will open". */
function kindTone(kind: string): string {
  if (kind === "PDF") return "pdf";
  if (kind === "DOC" || kind === "DOCX") return "doc";
  if (kind === "XLS" || kind === "XLSX" || kind === "CSV") return "xls";
  if (kind === "PPT" || kind === "PPTX") return "ppt";
  if (kind === "LINK") return "link";
  return "other";
}

function DocumentTile({ document: d }: { document: PublicDocument }) {
  // An uploaded file is served by this site; an external link opens where it
  // lives. Only the second one leaves the origin, so only it gets `noopener`
  // and a new tab.
  const external = !d.downloadUrl.startsWith("/");
  return (
    <li className={styles.tile}>
      <div className={styles.tileTop}>
        <span className={styles.kind} data-tone={kindTone(d.kindLabel)} aria-label={`Định dạng ${d.kindLabel}`}>
          <IconFileText size={18} />
          <span>{d.kindLabel}</span>
        </span>
        {d.labelName && <span className={styles.label}>{d.labelName}</span>}
      </div>
      <h2 className={styles.tileTitle}>
        <a href={d.downloadUrl} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
          {d.title}
        </a>
      </h2>
      {d.description && <p className={styles.tileDesc}>{d.description}</p>}
      <div className={styles.tileFoot}>
        <span className={styles.meta}>
          {d.documentNumber && <span>Số {d.documentNumber}</span>}
          {d.issuedAt && <span>{formatDateVi(d.issuedAt)}</span>}
        </span>
        <span className={styles.action} aria-hidden>
          {external ? <>Mở <IconExternal size={13} /></> : <>Tải về <IconDownload size={14} /></>}
        </span>
      </div>
    </li>
  );
}

/**
 * Full listing behind the homepage's "Tài liệu" section. Filtering is a set
 * of links carrying `?nhan=`, not a client-side control: the filtered view is
 * then a real URL an editor can send to a chi hội, and the page stays a
 * Server Component with no JavaScript of its own. Every published document is
 * read once and filtered here, so the chip counts only count what the public
 * can actually see.
 */
export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ nhan?: string }> }) {
  const { nhan } = await searchParams;
  const [labels, all] = await Promise.all([documentService.listLabels(), documentService.listPublic()]);

  const counts = new Map<string, number>();
  for (const d of all) if (d.labelSlug) counts.set(d.labelSlug, (counts.get(d.labelSlug) ?? 0) + 1);
  const usedLabels = labels.filter((l) => counts.has(l.slug));
  const active = labels.find((l) => l.slug === nhan);
  const documents = nhan ? all.filter((d) => d.labelSlug === nhan) : all;
  const latest = all.reduce<string | undefined>((max, d) => (d.issuedAt && (!max || d.issuedAt > max) ? d.issuedAt : max), undefined);

  return (
    <>
      <PageHero
        breadcrumb={[{ label: "Trang chủ", href: "/" }, { label: "Tài liệu" }]}
        eyebrow="Văn bản · Biểu mẫu"
        icon={<IconFileText size={13} />}
        title="Kho"
        mark="tài liệu"
        description="Thông báo, kế hoạch, hướng dẫn, quy chế và biểu mẫu của Hội Sinh viên Việt Nam — tìm nhanh, tải về trong một chạm."
        stats={all.length === 0 ? undefined : [
          { label: "Tài liệu", value: all.length.toLocaleString("vi-VN") },
          { label: "Nhóm", value: usedLabels.length },
          ...(latest ? [{ label: "Mới nhất", value: formatDateVi(latest) }] : []),
        ]}
      />

      <div className={styles.wrap}>
        <nav aria-label="Lọc theo nhãn" className={`hsvRail ${styles.filters}`}>
          <Link href="/tai-lieu" className={nhan ? styles.filter : styles.filterOn} aria-current={nhan ? undefined : "page"}>
            Tất cả <span className={styles.count}>{all.length}</span>
          </Link>
          {usedLabels.map((l) => (
            <Link
              key={l.id}
              href={`/tai-lieu?nhan=${encodeURIComponent(l.slug)}`}
              className={l.slug === nhan ? styles.filterOn : styles.filter}
              aria-current={l.slug === nhan ? "page" : undefined}
            >
              {l.name} <span className={styles.count}>{counts.get(l.slug)}</span>
            </Link>
          ))}
        </nav>

        {documents.length === 0 ? (
          <div className={styles.empty}>
            <IconFileText size={28} />
            <p>{active ? `Chưa có tài liệu nào thuộc nhãn “${active.name}”.` : "Chưa có tài liệu nào được đăng."}</p>
            {nhan && (
              <Link href="/tai-lieu" className={styles.emptyLink}>
                Xem tất cả tài liệu <IconArrowRight size={14} />
              </Link>
            )}
          </div>
        ) : (
          <ul className={styles.grid}>
            {documents.map((d) => (
              <DocumentTile key={d.id} document={d} />
            ))}
          </ul>
        )}

        <aside className={styles.help}>
          <div>
            <h2 className={styles.helpTitle}>Không tìm thấy văn bản bạn cần?</h2>
            <p className={styles.helpText}>Gửi yêu cầu cho Văn phòng Trung ương Hội — chúng tôi sẽ bổ sung sớm nhất.</p>
          </div>
          <a href={`mailto:${SITE_FOOTER_CONTACT_EMAIL}`} className={styles.helpBtn}>
            <IconMail size={16} /> {SITE_FOOTER_CONTACT_EMAIL}
          </a>
        </aside>
      </div>
    </>
  );
}
