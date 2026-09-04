import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import listStyles from "@/components/content/ArticleList.module.css";
import { PageShell } from "@/components/ui/PageShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { getLocalityBySlug } from "@/services/contentService";
import { pageMetadata } from "@/lib/seo";
import { localityHref } from "@/lib/routes";
import { formatDateVi } from "@/lib/formatDate";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const locality = await getLocalityBySlug(slug);
  if (!locality) {
    return pageMetadata({ title: "Không tìm thấy địa phương", description: "Địa phương không tồn tại.", path: localityHref(slug), noIndex: true });
  }
  return pageMetadata({ title: locality.name, description: `Tin tức và câu chuyện sinh viên tại ${locality.name}.`, path: localityHref(locality.slug) });
}

export default async function LocalityPage({ params }: Props) {
  const { slug } = await params;
  const locality = await getLocalityBySlug(slug);
  if (!locality) notFound();

  const hasContent = locality.localNews.length > 0 || locality.stories.length > 0;

  return (
    <PageShell
      breadcrumb={[{ label: "Trang chủ", href: "/" }, { label: "Địa phương" }, { label: locality.name }]}
      eyebrow="Địa phương"
      title={locality.name}
      description={`Tin từ cơ sở và câu chuyện sinh viên gắn với ${locality.name}.`}
    >
      {!hasContent ? (
        <EmptyState
          title="Chưa có nội dung cho địa phương này"
          description="Dữ liệu mẫu hiện chưa có tin từ cơ sở hoặc câu chuyện sinh viên nào gắn với địa phương này."
          action={{ label: "Xem tất cả tin tức", href: "/tin-tuc" }}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-10)" }}>
          {locality.localNews.length > 0 && (
            <section>
              <h2 style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
                Tin từ cơ sở
              </h2>
              <ul className={listStyles.list}>
                {locality.localNews.map((n) => (
                  <li key={n.slug} className={listStyles.item}>
                    <div className={listStyles.meta}>
                      <span className={listStyles.date}>{formatDateVi(n.publishedAt)}</span>
                      <span className={listStyles.place}>{n.orgName}</span>
                    </div>
                    <h3 className={listStyles.title}>
                      <Link href={n.url}>{n.title}</Link>
                    </h3>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {locality.stories.length > 0 && (
            <section>
              <h2 style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
                Dòng chảy sinh viên
              </h2>
              <ul className={listStyles.list}>
                {locality.stories.map((s) => (
                  <li key={s.slug} className={listStyles.item}>
                    <div className={listStyles.meta}>
                      <span className={listStyles.cat}>{s.category.name}</span>
                      <span className={listStyles.date}>{formatDateVi(s.publishedAt)}</span>
                    </div>
                    <h3 className={listStyles.title}>
                      <Link href={s.url}>{s.headline}</Link>
                    </h3>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </PageShell>
  );
}
