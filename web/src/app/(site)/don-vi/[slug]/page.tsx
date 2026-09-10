import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/ui/PageShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { ArticleRowList } from "@/components/content/ArticleRow";
import { getUnitBySlug, getUnitSlugs } from "@/services/contentService";
import { pageMetadata } from "@/lib/seo";
import { unitHref } from "@/lib/routes";
import { formatDateVi } from "@/lib/formatDate";
import { ORGANIZATION_LEVEL_LABEL } from "@/lib/orgLevel";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await getUnitSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const unit = await getUnitBySlug(slug);
  if (!unit) {
    return pageMetadata({ title: "Không tìm thấy đơn vị", description: "Đơn vị không tồn tại.", path: unitHref(slug), noIndex: true });
  }
  return pageMetadata({ title: unit.name, description: `Tin bài của ${unit.name}.`, path: unitHref(unit.slug) });
}

export default async function UnitPage({ params }: Props) {
  const { slug } = await params;
  const unit = await getUnitBySlug(slug);
  if (!unit) notFound();

  const count = unit.localNews.length;

  return (
    <PageShell
      breadcrumb={[{ label: "Trang chủ", href: "/" }, { label: "Đơn vị" }, { label: unit.name }]}
      eyebrow={ORGANIZATION_LEVEL_LABEL[unit.level]}
      title={unit.name}
      description={count > 0 ? `${count.toLocaleString("vi-VN")} tin bài trên cổng.` : "Tin bài của đơn vị."}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-10)" }}>
        {count > 0 ? (
          <section>
            <h2 style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>
              Tin từ đơn vị · {count.toLocaleString("vi-VN")} bài
            </h2>
            <ArticleRowList
              items={unit.localNews.map((n) => ({
                url: n.url,
                title: n.title,
                lead: n.lead,
                media: n.media,
                meta: (
                  <>
                    <span>{n.place}</span>
                    <span>·</span>
                    <span>{formatDateVi(n.publishedAt)}</span>
                  </>
                ),
              }))}
            />
          </section>
        ) : (
          <EmptyState
            title="Chưa có tin bài từ đơn vị này"
            description="Chưa có tin bài nào được gắn với đơn vị này trên cổng."
            action={{ label: "Xem tất cả tin tức", href: "/tin-tuc" }}
          />
        )}
      </div>
    </PageShell>
  );
}
