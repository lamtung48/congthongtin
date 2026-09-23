import Link from "next/link";
import type { CSSProperties } from "react";
import styles from "./FeaturedNews.module.css";
import { MediaImage } from "@/components/ui/MediaImage";
import { Reveal } from "@/components/ui/Reveal";
import { ArticleCoverLink } from "@/components/content/ArticleCoverLink";
import { IconArrowRight } from "@/components/icons";
import type { FeaturedNewsResult } from "@/data-access/types";
import type { MediaAsset } from "@/domain/media";
import { formatDateVi } from "@/lib/formatDate";
import { articleCoverTransitionName } from "@/lib/viewTransition";

const GENERIC_ARTICLE_MEDIA: MediaAsset = { id: "featured-secondary", provider: "local-placeholder", type: "image", status: "missing", placeholder: "Ảnh bài viết" };

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * "Tin tiêu điểm" — a bento of the six featured stories: the lead story as a
 * full-bleed image card with its copy overlaid, the runner-up as a smaller
 * image card, and the rest as a numbered list.
 *
 * Still a Server Component: every effect here (zoom, light sweep, the
 * highlighter stroke under the title, the staggered entrance) is CSS, keyed
 * off `Reveal`'s `is-armed`/`is-in` classes. The one client-only need, the
 * lead cover's View Transition click, stays isolated in `ArticleCoverLink`
 * (the whole lead card is that link; the transition name sits on the image
 * inside it, which is what morphs into the article's cover). See
 * `docs/PERFORMANCE.md`.
 */
export function FeaturedNews({ featured }: { featured: FeaturedNewsResult }) {
  const { main, secondary } = featured;
  const [runnerUp, ...rest] = secondary;

  return (
    <section aria-labelledby="featured-title" className={styles.section}>
      <span aria-hidden className={styles.backdrop} />
      <div className={styles.inner}>
        <Reveal className={styles.head}>
          <div className={styles.headCopy}>
            <span className={styles.eyebrow}>
              <span className={styles.spark} />
              Tiêu điểm
            </span>
            <h2 id="featured-title" className={styles.title}>
              Tin{" "}
              <span className={styles.mark}>
                tiêu điểm
                <svg aria-hidden viewBox="0 0 300 24" preserveAspectRatio="none" className={styles.markSvg}>
                  <path d="M4 16 C 60 6, 120 20, 180 11 S 270 8, 296 13" pathLength={1} className={styles.markPath} />
                </svg>
              </span>
            </h2>
          </div>
          <Link href="/tin-tuc" className={styles.allLink}>
            Tất cả tin tức
            <span className={styles.allArrow}>
              <IconArrowRight size={15} />
            </span>
          </Link>
        </Reveal>

        <div className={styles.grid}>
          <Reveal as="article" className={styles.lead}>
            <ArticleCoverLink href={main.url} className={styles.leadLink}>
              <span className={styles.leadMedia} style={{ viewTransitionName: articleCoverTransitionName(main.url) }}>
                <MediaImage media={main.coverImage ?? GENERIC_ARTICLE_MEDIA} priority sizes="(max-width: 1100px) 100vw, 60vw" />
              </span>
              <span aria-hidden className={styles.leadScrim} />
              <span aria-hidden className={styles.shine} />
              <span className={styles.rank} aria-hidden>
                01
              </span>
              <span className={styles.leadBody}>
                <span className={styles.chips}>
                  <span className={styles.chipHot}>{main.category.name}</span>
                  <span className={styles.chipGlass}>{formatDateVi(main.publishedAt)}</span>
                </span>
                <h3 className={styles.leadTitle}>{main.title}</h3>
                {main.lead && <p className={styles.leadLead}>{main.lead}</p>}
                <span className={styles.readMore}>
                  Đọc ngay
                  <IconArrowRight size={15} />
                </span>
              </span>
            </ArticleCoverLink>
          </Reveal>

          <div className={styles.side}>
            {runnerUp && (
              <Reveal as="article" className={styles.runner}>
                <Link href={runnerUp.url} className={styles.runnerLink}>
                  <span className={styles.runnerMedia}>
                    <MediaImage media={runnerUp.coverImage ?? GENERIC_ARTICLE_MEDIA} sizes="(max-width: 1100px) 100vw, 40vw" />
                  </span>
                  <span aria-hidden className={styles.runnerScrim} />
                  <span aria-hidden className={styles.shine} />
                  <span className={styles.rankSmall} aria-hidden>
                    02
                  </span>
                  <span className={styles.runnerBody}>
                    <span className={styles.runnerMeta}>
                      {runnerUp.category.name} · {formatDateVi(runnerUp.publishedAt)}
                    </span>
                    <h3 className={styles.runnerTitle}>{runnerUp.title}</h3>
                  </span>
                </Link>
              </Reveal>
            )}

            {rest.length > 0 && (
              <ol className={styles.list}>
                {rest.map((a, i) => (
                  <Reveal as="li" key={a.slug} className={styles.item} style={{ "--i": i } as CSSProperties}>
                    <Link href={a.url} className={styles.itemLink}>
                      <span className={styles.itemIndex} aria-hidden>
                        {pad2(i + 3)}
                      </span>
                      <span className={styles.itemBody}>
                        <span className={styles.itemMeta}>
                          <span className={styles.itemCat}>{a.category.name}</span>
                          <span>{formatDateVi(a.publishedAt)}</span>
                        </span>
                        <span className={styles.itemTitle}>{a.title}</span>
                      </span>
                      <span className={styles.itemThumb}>
                        <MediaImage media={a.coverImage ?? GENERIC_ARTICLE_MEDIA} sizes="112px" />
                      </span>
                    </Link>
                  </Reveal>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
