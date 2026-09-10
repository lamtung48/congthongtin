import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "./page.module.css";
import { PageShell } from "@/components/ui/PageShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { MediaImage } from "@/components/ui/MediaImage";
import { ArticleRowList } from "@/components/content/ArticleRow";
import { getLocalityBySlug, getLocalitySlugs } from "@/services/contentService";
import { pageMetadata } from "@/lib/seo";
import { localityHref, eventHref } from "@/lib/routes";
import { formatDateTimeVi, formatDateVi } from "@/lib/formatDate";
import { ORGANIZATION_LEVEL_LABEL } from "@/lib/orgLevel";
import type { LocalityProfile } from "@/data-access/types";
import type { MediaAsset } from "@/domain/media";

interface Props {
  params: Promise<{ slug: string }>;
}

function fmt(n: number): string {
  return n.toLocaleString("vi-VN");
}

/** Also doubles as `PageShell`'s description and the page's meta
 *  description, so the three never say three different things. */
function summaryText(locality: LocalityProfile): string {
  const { activity, name } = locality;
  const count = activity?.articleCount ?? 0;
  if (count > 0) {
    return `${name} có ${fmt(count)} tin bài trên cổng.`;
  }
  return `Tin tức và hoạt động sinh viên gắn với ${name}.`;
}

const EVENT_PLACEHOLDER: MediaAsset = { id: "locality-activity-fallback", provider: "local-placeholder", type: "image", status: "missing", placeholder: "Ảnh hoạt động" };

export async function generateStaticParams() {
  const slugs = await getLocalitySlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const locality = await getLocalityBySlug(slug);
  if (!locality) {
    return pageMetadata({ title: "Không tìm thấy địa phương", description: "Địa phương không tồn tại.", path: localityHref(slug), noIndex: true });
  }
  return pageMetadata({ title: locality.name, description: summaryText(locality), path: localityHref(locality.slug) });
}

export default async function LocalityPage({ params }: Props) {
  const { slug } = await params;
  const locality = await getLocalityBySlug(slug);
  if (!locality) notFound();

  const { activity, latestActivity, organizations, relatedMedia, localNews, stories } = locality;
  const hasNews = localNews.length > 0 || stories.length > 0;
  const articleCount = activity?.articleCount ?? 0;

  return (
    <PageShell
      breadcrumb={[{ label: "Trang chủ", href: "/" }, { label: "Địa phương" }, { label: locality.name }]}
      eyebrow="Địa phương"
      title={locality.name}
      description={summaryText(locality)}
    >
      <div className={styles.stack}>
        {/* Tin bài của địa phương — số liệu thật, đếm từ bài đã xuất bản */}
        <section className={styles.section} aria-label="Tin bài của địa phương">
          <h2 className={styles.sectionTitle}>Tin bài của địa phương</h2>
          {articleCount === 0 ? (
            <EmptyState
              title="Chưa có tin bài"
              description={`Chưa có tin bài nào được gắn với ${locality.name} trên cổng.`}
            />
          ) : (
            <>
              <div data-l="locality-stats" className={styles.statsGrid} style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                <div className={styles.statCell}>
                  <span className={styles.statValue}>{fmt(articleCount)}</span>
                  <span className={styles.statLabel}>Tin bài</span>
                </div>
                {activity?.latestArticle && (
                  <div className={styles.statCell}>
                    <span className={styles.statValue}>{formatDateVi(activity.latestArticle.publishedAt)}</span>
                    <span className={styles.statLabel}>Tin mới nhất</span>
                  </div>
                )}
              </div>
              {activity?.updatedAt && (
                <p className={styles.updatedNote}>Cập nhật {formatDateVi(activity.updatedAt)}</p>
              )}
            </>
          )}
        </section>

        {/* Hoạt động gần đây */}
        <section className={styles.section} aria-label="Hoạt động gần đây">
          <h2 className={styles.sectionTitle}>Hoạt động gần đây</h2>
          {latestActivity ? (
            <div data-l="locality-activity" className={styles.activityCard}>
              <div className={styles.activityMedia}>
                <MediaImage media={latestActivity.cover ?? EVENT_PLACEHOLDER} />
              </div>
              <div className={styles.activityBody}>
                <h3 className={styles.activityTitle}>
                  <Link href={latestActivity.url || eventHref(latestActivity.slug)}>{latestActivity.title}</Link>
                </h3>
                <span className={styles.activityMeta}>{latestActivity.place} · {formatDateTimeVi(latestActivity.startAt)}</span>
              </div>
            </div>
          ) : (
            <EmptyState title="Chưa có hoạt động gần đây" description="Chưa có hoạt động nào được ghi nhận tại địa phương này trong dữ liệu hiện có." />
          )}
        </section>

        {/* Tin tức mới nhất */}
        <section className={styles.section} aria-label="Tin tức mới nhất">
          <h2 className={styles.sectionTitle}>Tin tức mới nhất</h2>
          {!hasNews ? (
            <EmptyState
              title="Chưa có tin tức cho địa phương này"
              description="Chưa có tin từ cơ sở hoặc câu chuyện sinh viên nào gắn với địa phương này."
              action={{ label: "Xem tất cả tin tức", href: "/tin-tuc" }}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-8)" }}>
              {localNews.length > 0 && (
                <div>
                  <h3 className={styles.sectionTitle} style={{ marginBottom: 12 }}>Tin từ cơ sở</h3>
                  <ArticleRowList
                    items={localNews.map((n) => ({
                      url: n.url,
                      title: n.title,
                      lead: n.lead,
                      media: n.media,
                      meta: (
                        <>
                          <span>{n.orgName}</span>
                          <span>·</span>
                          <span>{formatDateVi(n.publishedAt)}</span>
                        </>
                      ),
                    }))}
                  />
                </div>
              )}

              {stories.length > 0 && (
                <div>
                  <h3 className={styles.sectionTitle} style={{ marginBottom: 12 }}>Dòng chảy sinh viên</h3>
                  <ArticleRowList
                    items={stories.map((s) => ({
                      url: s.url,
                      title: s.headline,
                      lead: s.lead,
                      media: s.media,
                      meta: (
                        <>
                          <span>{s.category.name}</span>
                          <span>·</span>
                          <span>{formatDateVi(s.publishedAt)}</span>
                        </>
                      ),
                    }))}
                  />
                </div>
              )}
            </div>
          )}
        </section>

        {/* Đơn vị Hội tại địa phương, nếu có */}
        {organizations.length > 0 && (
          <section className={styles.section} aria-label="Đơn vị Hội tại địa phương">
            <h2 className={styles.sectionTitle}>Đơn vị Hội tại địa phương</h2>
            <ul className={styles.orgList}>
              {organizations.map((org) => (
                <li key={org.id} className={styles.orgItem}>
                  <Link href={org.url ?? "#"} className={styles.orgName}>{org.name}</Link>
                  <span className={styles.orgLevel}>{ORGANIZATION_LEVEL_LABEL[org.level]}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Ảnh hoạt động liên quan */}
        <section className={styles.section} aria-label="Ảnh hoạt động liên quan">
          <h2 className={styles.sectionTitle}>Ảnh hoạt động liên quan</h2>
          {relatedMedia.length === 0 ? (
            <EmptyState title="Chưa có ảnh cho địa phương này" description="Thư viện ảnh hoạt động hiện chưa có ảnh nào gắn với địa phương này." />
          ) : (
            <div data-l="locality-media" className={styles.mediaGrid}>
              {relatedMedia.map((m) => (
                <div key={m.id} className={styles.mediaTile}>
                  <div className={styles.mediaFrame}>
                    <MediaImage media={m} />
                  </div>
                  {m.caption && <p className={styles.mediaCaption}>{m.caption}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}
