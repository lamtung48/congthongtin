import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import styles from "./page.module.css";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { EmptyState } from "@/components/ui/EmptyState";
import { MediaImage } from "@/components/ui/MediaImage";
import { Reveal } from "@/components/ui/Reveal";
import { ArticleCoverLink } from "@/components/content/ArticleCoverLink";
import { IconArrowRight, IconMapPin } from "@/components/icons";
import { getLocalityBySlug, getLocalitySlugs } from "@/services/contentService";
import { pageMetadata } from "@/lib/seo";
import { localityHref, eventHref } from "@/lib/routes";
import { formatDateTimeVi, formatDateVi } from "@/lib/formatDate";
import { ORGANIZATION_LEVEL_LABEL } from "@/lib/orgLevel";
import { articleCoverTransitionName } from "@/lib/viewTransition";
import type { LocalityProfile } from "@/data-access/types";
import type { MediaAsset } from "@/domain/media";

interface Props {
  params: Promise<{ slug: string }>;
}

function fmt(n: number): string {
  return n.toLocaleString("vi-VN");
}

/** One article in the locality feed, whichever list(s) it came from. */
interface FeedItem {
  slug: string;
  url: string;
  title: string;
  lead?: string;
  media: MediaAsset;
  publishedAt: string;
  /** Set when the article was filed by a Hội unit ("Tin từ cơ sở"). */
  orgName?: string;
  categoryName?: string;
}

/**
 * `localNews` (articles filed by a Hội unit) is a subset of `stories` (every
 * published article tagged with this province), so rendering both lists
 * showed each unit article twice. Merge them into one feed keyed by slug,
 * keeping the unit name from one side and the category from the other.
 */
function buildFeed({ localNews, stories }: LocalityProfile): FeedItem[] {
  const bySlug = new Map<string, FeedItem>();
  for (const s of stories) {
    bySlug.set(s.slug, { slug: s.slug, url: s.url, title: s.headline, lead: s.lead, media: s.media, publishedAt: s.publishedAt, categoryName: s.category.name });
  }
  for (const n of localNews) {
    const existing = bySlug.get(n.slug);
    if (existing) {
      existing.orgName = n.orgName;
    } else {
      bySlug.set(n.slug, { slug: n.slug, url: n.url, title: n.title, lead: n.lead, media: n.media, publishedAt: n.publishedAt, orgName: n.orgName });
    }
  }
  return [...bySlug.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

/** Also doubles as the page's meta description. */
function summaryText(locality: LocalityProfile, count: number): string {
  if (count > 0) return `${locality.name} có ${fmt(count)} tin bài trên cổng.`;
  return `Tin tức và hoạt động sinh viên gắn với ${locality.name}.`;
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
  return pageMetadata({ title: locality.name, description: summaryText(locality, buildFeed(locality).length), path: localityHref(locality.slug) });
}

function SourceTags({ item, light = false }: { item: FeedItem; light?: boolean }) {
  return (
    <span className={styles.tags}>
      {item.orgName && <span className={light ? styles.tagOrgLight : styles.tagOrg}>{item.orgName}</span>}
      {item.categoryName && <span className={light ? styles.tagLight : styles.tag}>{item.categoryName}</span>}
    </span>
  );
}

export default async function LocalityPage({ params }: Props) {
  const { slug } = await params;
  const locality = await getLocalityBySlug(slug);
  if (!locality) notFound();

  const { latestActivity, organizations, relatedMedia } = locality;
  const feed = buildFeed(locality);
  const [lead, ...others] = feed;
  const cards = others.slice(0, 4);
  const rows = others.slice(4);
  const unitCount = feed.filter((f) => f.orgName).length;

  return (
    <>
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Địa phương" }, { label: locality.name }]} />

      <header className={styles.hero}>
        <span aria-hidden className={styles.backdrop} />
        <Reveal className={styles.heroInner}>
          <span className={styles.eyebrow}>
            <IconMapPin size={13} />
            Địa phương
          </span>
          <h1 className={styles.title}>
            <span className={styles.mark}>
              {locality.name}
              <svg aria-hidden viewBox="0 0 300 24" preserveAspectRatio="none" className={styles.markSvg}>
                <path d="M4 16 C 60 6, 120 20, 180 11 S 270 8, 296 13" pathLength={1} className={styles.markPath} />
              </svg>
            </span>
          </h1>
          <p className={styles.desc}>{summaryText(locality, feed.length)}</p>

          <dl className={styles.stats}>
            <div className={styles.stat}>
              <dt>Tin bài</dt>
              <dd>{fmt(feed.length)}</dd>
            </div>
            <div className={styles.stat}>
              <dt>Tin từ cơ sở</dt>
              <dd>{fmt(unitCount)}</dd>
            </div>
            <div className={styles.stat}>
              <dt>Đơn vị Hội</dt>
              <dd>{fmt(organizations.length)}</dd>
            </div>
            {lead && (
              <div className={styles.stat}>
                <dt>Tin mới nhất</dt>
                <dd>{formatDateVi(lead.publishedAt)}</dd>
              </div>
            )}
          </dl>
        </Reveal>
      </header>

      <div className={styles.wrap}>
        <div className={styles.layout}>
          <section className={styles.main} aria-labelledby="locality-news">
            <div className={styles.sectionHead}>
              <h2 id="locality-news" className={styles.sectionTitle}>Tin bài địa phương</h2>
              <Link href="/tin-tuc" className={styles.allLink}>
                Tất cả tin tức
                <IconArrowRight size={14} />
              </Link>
            </div>

            {!lead ? (
              <EmptyState
                title="Chưa có tin bài"
                description={`Chưa có tin bài nào được gắn với ${locality.name} trên cổng.`}
                action={{ label: "Xem tất cả tin tức", href: "/tin-tuc" }}
              />
            ) : (
              <>
                <Reveal as="article" className={styles.lead}>
                  <ArticleCoverLink href={lead.url} className={styles.leadLink}>
                    <span className={styles.leadMedia} style={{ viewTransitionName: articleCoverTransitionName(lead.url) }}>
                      <MediaImage media={lead.media} priority sizes="(max-width: 1000px) 100vw, 65vw" />
                    </span>
                    <span aria-hidden className={styles.leadScrim} />
                    <span className={styles.leadBody}>
                      <SourceTags item={lead} light />
                      <h3 className={styles.leadTitle}>{lead.title}</h3>
                      {lead.lead && <p className={styles.leadLead}>{lead.lead}</p>}
                      <span className={styles.leadMeta}>
                        {formatDateVi(lead.publishedAt)}
                        <span className={styles.readMore}>
                          Đọc tiếp <IconArrowRight size={14} />
                        </span>
                      </span>
                    </span>
                  </ArticleCoverLink>
                </Reveal>

                {cards.length > 0 && (
                  <div className={styles.cards} data-count={cards.length}>
                    {cards.map((item, i) => (
                      <Reveal as="article" key={item.slug} className={styles.card} style={{ "--i": i } as CSSProperties}>
                        <Link href={item.url} className={styles.cardLink}>
                          <span className={styles.cardMedia}>
                            <MediaImage media={item.media} sizes="(max-width: 700px) 100vw, 33vw" />
                          </span>
                          <span className={styles.cardBody}>
                            <SourceTags item={item} />
                            <h3 className={styles.cardTitle}>{item.title}</h3>
                            <span className={styles.cardDate}>{formatDateVi(item.publishedAt)}</span>
                          </span>
                        </Link>
                      </Reveal>
                    ))}
                  </div>
                )}

                {rows.length > 0 && (
                  <ol className={styles.rows}>
                    {rows.map((item) => (
                      <li key={item.slug}>
                        <Link href={item.url} className={styles.row}>
                          <span className={styles.rowMedia}>
                            <MediaImage media={item.media} sizes="120px" />
                          </span>
                          <span className={styles.rowBody}>
                            <SourceTags item={item} />
                            <span className={styles.rowTitle}>{item.title}</span>
                          </span>
                          <span className={styles.rowDate}>{formatDateVi(item.publishedAt)}</span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )}
          </section>

          <aside className={styles.aside}>
            <section className={styles.panel} aria-labelledby="locality-activity">
              <h2 id="locality-activity" className={styles.panelTitle}>Hoạt động gần đây</h2>
              {latestActivity ? (
                <Link href={latestActivity.url || eventHref(latestActivity.slug)} className={styles.activity}>
                  <span className={styles.activityMedia}>
                    <MediaImage media={latestActivity.cover ?? EVENT_PLACEHOLDER} sizes="340px" />
                  </span>
                  <span className={styles.activityTitle}>{latestActivity.title}</span>
                  <span className={styles.activityMeta}>
                    {latestActivity.place} · {formatDateTimeVi(latestActivity.startAt)}
                  </span>
                </Link>
              ) : (
                <p className={styles.panelEmpty}>Chưa có hoạt động nào được ghi nhận tại địa phương này.</p>
              )}
            </section>

            <section className={styles.panel} aria-labelledby="locality-orgs">
              <h2 id="locality-orgs" className={styles.panelTitle}>Đơn vị Hội tại địa phương</h2>
              {organizations.length > 0 ? (
                <ul className={styles.orgList}>
                  {organizations.map((org) => (
                    <li key={org.id}>
                      <Link href={org.url ?? "#"} className={styles.org}>
                        <span className={styles.orgName}>{org.name}</span>
                        <span className={styles.orgLevel}>{ORGANIZATION_LEVEL_LABEL[org.level]}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.panelEmpty}>Chưa có đơn vị Hội nào được ghi nhận.</p>
              )}
            </section>
          </aside>
        </div>

        {relatedMedia.length > 0 && (
          <section className={styles.gallery} aria-labelledby="locality-media">
            <h2 id="locality-media" className={styles.sectionTitle}>Ảnh hoạt động</h2>
            <div className={styles.mediaGrid}>
              {relatedMedia.map((m) => (
                <figure key={m.id} className={styles.mediaTile}>
                  <span className={styles.mediaFrame}>
                    <MediaImage media={m} sizes="(max-width: 700px) 50vw, 25vw" />
                  </span>
                  {m.caption && <figcaption className={styles.mediaCaption}>{m.caption}</figcaption>}
                </figure>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
