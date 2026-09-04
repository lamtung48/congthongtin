import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import listStyles from "@/components/content/ArticleList.module.css";
import { PageShell } from "@/components/ui/PageShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { getUnitBySlug, getUnitSlugs } from "@/services/contentService";
import { pageMetadata } from "@/lib/seo";
import { unitHref } from "@/lib/routes";
import { formatDateVi } from "@/lib/formatDate";

const LEVEL_LABEL = { province: "Hội Sinh viên cấp tỉnh, thành", university: "Hội Sinh viên cấp trường", overseas: "Hội Sinh viên ở nước ngoài" } as const;

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
  return pageMetadata({ title: unit.name, description: `Hồ sơ và tin bài của ${unit.name}.`, path: unitHref(unit.slug) });
}

export default async function UnitPage({ params }: Props) {
  const { slug } = await params;
  const unit = await getUnitBySlug(slug);
  if (!unit) notFound();

  return (
    <PageShell
      breadcrumb={[{ label: "Trang chủ", href: "/" }, { label: "Đơn vị" }, { label: unit.name }]}
      eyebrow={LEVEL_LABEL[unit.level]}
      title={unit.name}
      description="Hồ sơ đơn vị, số liệu báo cáo phong trào và tin bài liên quan."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-10)" }}>
        <EmptyState
          title="Chưa kết nối số liệu báo cáo phong trào"
          description="Số liệu hoạt động, tin bài và sinh viên tham gia của đơn vị được tổng hợp từ bản đồ hoạt động — trang này sẽ hiển thị số liệu thật khi có đường dẫn dữ liệu phía máy chủ cho từng đơn vị."
        />

        {unit.localNews.length > 0 ? (
          <section>
            <h2 style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
              Tin từ đơn vị
            </h2>
            <ul className={listStyles.list}>
              {unit.localNews.map((n) => (
                <li key={n.slug} className={listStyles.item}>
                  <div className={listStyles.meta}>
                    <span className={listStyles.date}>{formatDateVi(n.publishedAt)}</span>
                    <span className={listStyles.place}>{n.place}</span>
                  </div>
                  <h3 className={listStyles.title}>
                    <Link href={n.url}>{n.title}</Link>
                  </h3>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <EmptyState title="Chưa có tin bài từ đơn vị này" description="Dữ liệu mẫu hiện chưa có tin từ cơ sở nào gắn với đơn vị này." />
        )}
      </div>
    </PageShell>
  );
}
