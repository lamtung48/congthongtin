import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "./page.module.css";
import listStyles from "@/components/content/ArticleList.module.css";
import { PageShell } from "@/components/ui/PageShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { MediaImage } from "@/components/ui/MediaImage";
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

/** Item 2, "Summary" — also doubles as `PageShell`'s description and the
 *  page's meta description, so the three never say three different things. */
function summaryText(locality: LocalityProfile): string {
  const { activity, name } = locality;
  if (!activity) {
    return `Tin tức và hoạt động sinh viên gắn với ${name}.`;
  }
  if (!activity.reported) {
    return `${name} chưa gửi số liệu hoạt động trong kỳ thống kê ${activity.period}.`;
  }
  const parts: string[] = [];
  if (activity.activityCount != null) parts.push(`${fmt(activity.activityCount)} hoạt động`);
  if (activity.articleCount != null) parts.push(`${fmt(activity.articleCount)} tin bài`);
  if (activity.studentCount != null) parts.push(`${fmt(activity.studentCount)} sinh viên tham gia`);
  if (parts.length === 0) return `${name} — số liệu hoạt động đang được cập nhật.`;
  return `${name} ghi nhận ${parts.join(", ")} trong kỳ thống kê ${activity.period}.`;
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

  return (
    <PageShell
      breadcrumb={[{ label: "Trang chủ", href: "/" }, { label: "Địa phương" }, { label: locality.name }]}
      eyebrow="Địa phương"
      title={locality.name}
      description={summaryText(locality)}
    >
      <div className={styles.stack}>
        {/* Item 3 — Statistics */}
        <section className={styles.section} aria-label="Số liệu hoạt động">
          <h2 className={styles.sectionTitle}>Số liệu hoạt động</h2>
          {!activity ? (
            <EmptyState
              title="Không áp dụng số liệu cấp tỉnh"
              description="Địa phương này không phải là một trong 34 tỉnh, thành được Bản đồ hoạt động theo dõi, nên chưa có số liệu báo cáo theo tỉnh cho nơi này."
            />
          ) : !activity.reported ? (
            <EmptyState
              title="Chưa có số liệu báo cáo"
              description={`${locality.name} chưa gửi số liệu hoạt động trong kỳ thống kê ${activity.period}. Số liệu sẽ hiển thị ngay khi đơn vị gửi báo cáo.`}
            />
          ) : (
            <>
              <div data-l="locality-stats" className={styles.statsGrid}>
                {activity.activityCount != null && (
                  <div className={styles.statCell}>
                    <span className={styles.statValue}>{fmt(activity.activityCount)}</span>
                    <span className={styles.statLabel}>Hoạt động</span>
                  </div>
                )}
                {activity.articleCount != null && (
                  <div className={styles.statCell}>
                    <span className={styles.statValue}>{fmt(activity.articleCount)}</span>
                    <span className={styles.statLabel}>Tin bài</span>
                  </div>
                )}
                {activity.studentCount != null && (
                  <div className={styles.statCell}>
                    <span className={styles.statValue}>{fmt(activity.studentCount)}</span>
                    <span className={styles.statLabel}>Sinh viên tham gia</span>
                  </div>
                )}
              </div>
              <p className={styles.updatedNote}>
                Kỳ thống kê: {activity.period} · Cập nhật {formatDateVi(activity.updatedAt)}
              </p>
            </>
          )}
        </section>

        {/* Item 4 — Latest activities */}
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

        {/* Item 5 — Latest news */}
        <section className={styles.section} aria-label="Tin tức mới nhất">
          <h2 className={styles.sectionTitle}>Tin tức mới nhất</h2>
          {!hasNews ? (
            <EmptyState
              title="Chưa có tin tức cho địa phương này"
              description="Dữ liệu mẫu hiện chưa có tin từ cơ sở hoặc câu chuyện sinh viên nào gắn với địa phương này."
              action={{ label: "Xem tất cả tin tức", href: "/tin-tuc" }}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-8)" }}>
              {localNews.length > 0 && (
                <div>
                  <h3 className={styles.sectionTitle} style={{ marginBottom: 8 }}>Tin từ cơ sở</h3>
                  <ul className={listStyles.list}>
                    {localNews.map((n) => (
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
                </div>
              )}

              {stories.length > 0 && (
                <div>
                  <h3 className={styles.sectionTitle} style={{ marginBottom: 8 }}>Dòng chảy sinh viên</h3>
                  <ul className={listStyles.list}>
                    {stories.map((s) => (
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
                </div>
              )}
            </div>
          )}
        </section>

        {/* Item 6 — Category distribution, nếu có */}
        {activity?.categoryDistribution && activity.categoryDistribution.length > 0 && (
          <section className={styles.section} aria-label="Phân bố theo chuyên mục">
            <h2 className={styles.sectionTitle}>Phân bố theo chuyên mục</h2>
            <div className={styles.categoryBars}>
              {(() => {
                const max = Math.max(...activity.categoryDistribution.map((c) => c.count));
                return activity.categoryDistribution.map((c) => (
                  <div key={c.slug} className={styles.categoryRow}>
                    <span className={styles.categoryLabel}>{c.label}</span>
                    <span className={styles.categoryTrack}>
                      <span className={styles.categoryFill} style={{ width: `${max > 0 ? Math.round((c.count / max) * 100) : 0}%` }} />
                    </span>
                    <span className={styles.categoryValue}>{fmt(c.count)}</span>
                  </div>
                ));
              })()}
            </div>
          </section>
        )}

        {/* Item 7 — Organization list, nếu có */}
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

        {/* Item 8 — Related media */}
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
