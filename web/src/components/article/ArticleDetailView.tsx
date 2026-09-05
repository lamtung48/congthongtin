import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./ArticleDetailView.module.css";
import { EmptyState } from "@/components/ui/EmptyState";
import { MediaImage } from "@/components/ui/MediaImage";
import { ArticleMeta } from "@/components/article/ArticleMeta";
import { TagList, type TagListItem } from "@/components/content/TagList";
import { ArticleBody } from "@/components/article/blocks/ArticleBody";
import type { ArticleBlock } from "@/domain/articleContent";
import type { Author } from "@/domain/people";
import type { MediaAsset } from "@/domain/media";

/**
 * The one place an article's headline/meta/cover/body/tags get turned into
 * markup — shared by the public `/tin-tuc/[slug]` route and the CMS's
 * `/admin/articles/[id]/preview`, so "preview" can never drift from what a
 * reader actually sees (the exact risk a from-scratch CMS preview renderer
 * would carry). Everything specific to the *public* page (breadcrumb, share
 * actions, related/adjacent nav, JSON-LD) is an optional prop the preview
 * route simply omits, rather than a second copy of this component.
 */
export interface ArticleDetailViewProps {
  categoryName: string;
  categoryHref: string;
  title: string;
  lead?: string;
  author?: Author;
  publishedAt: string;
  updatedAt?: string;
  readingTimeMinutes?: number;
  coverImage?: MediaAsset;
  body?: ArticleBlock[];
  tags?: TagListItem[];
  /** Rendered above the byline/cover — the CMS preview's "Đang xem trước"
   *  banner; the public page never passes this. */
  banner?: ReactNode;
  /** Rendered right after the body, before the tags row — the public
   *  page's `ShareActions`; the CMS preview never passes this (nothing to
   *  share yet). */
  afterBody?: ReactNode;
  /** Rendered below the whole content section — the public page's
   *  `RelatedArticles`/`AdjacentArticleNav`; the CMS preview never passes
   *  this (neither makes sense for an unpublished article). */
  bottom?: ReactNode;
  /** The public page's cross-fade from the Hero/FeaturedNews card it was
   *  navigated from (`articleCoverTransitionName`) — the CMS preview isn't
   *  reached by that navigation, so it never sets this. */
  coverViewTransitionName?: string;
  emptyBodyDescription?: string;
}

export function ArticleDetailView({
  categoryName,
  categoryHref,
  title,
  lead,
  author,
  publishedAt,
  updatedAt,
  readingTimeMinutes,
  coverImage,
  body,
  tags,
  banner,
  afterBody,
  bottom,
  coverViewTransitionName,
  emptyBodyDescription,
}: ArticleDetailViewProps) {
  const hasBody = !!body && body.length > 0;
  const hasTags = !!tags && tags.length > 0;

  return (
    <article className={styles.wrap}>
      {banner}
      <header className={styles.head}>
        <Link href={categoryHref} className={styles.category}>
          {categoryName}
        </Link>
        <h1 className={styles.headline}>{title}</h1>
        {lead && <p className={styles.sapo}>{lead}</p>}
        <ArticleMeta author={author} publishedAt={publishedAt} updatedAt={updatedAt} readingTimeMinutes={readingTimeMinutes} />
      </header>

      {coverImage && (
        <figure className={styles.coverWrap}>
          <div className={styles.cover} style={coverViewTransitionName ? { viewTransitionName: coverViewTransitionName } : undefined}>
            <MediaImage media={coverImage} />
          </div>
          {coverImage.caption && <figcaption className={styles.coverCaption}>{coverImage.caption}</figcaption>}
        </figure>
      )}

      <div className={styles.section}>
        {hasBody ? (
          <ArticleBody blocks={body!} />
        ) : (
          <EmptyState
            title="Nội dung bài viết đang được biên tập"
            description={emptyBodyDescription ?? "Bản đầy đủ của bài viết chưa có trong dữ liệu mẫu — trang này sẽ hiển thị nội dung thật khi kết nối với hệ thống quản trị nội dung."}
            action={{ label: "Xem tất cả tin tức", href: "/tin-tuc" }}
          />
        )}

        {afterBody}

        {hasTags && (
          <div className={styles.tagsRow}>
            <TagList ariaLabel="Từ khoá liên quan" items={tags!} />
          </div>
        )}
      </div>

      {bottom && <div className={styles.bottomSection}>{bottom}</div>}
    </article>
  );
}
