import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "./page.module.css";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { EmptyState } from "@/components/ui/EmptyState";
import { MediaImage } from "@/components/ui/MediaImage";
import { ArticleMeta } from "@/components/article/ArticleMeta";
import { ShareActions } from "@/components/article/ShareActions";
import { TagList } from "@/components/content/TagList";
import { RelatedArticles } from "@/components/article/RelatedArticles";
import { AdjacentArticleNav } from "@/components/article/AdjacentArticleNav";
import { ArticleBody } from "@/components/article/blocks/ArticleBody";
import { getAdjacentArticles, getArticleBySlug, getArticleSlugs, getRelatedArticles } from "@/services/contentService";
import { getHomepage } from "@/services/homepageService";
import { pageMetadata } from "@/lib/seo";
import { categoryHref, articleHref, searchHref } from "@/lib/routes";
import { resolveImageUrl } from "@/lib/media/resolveMedia";
import { articleCoverTransitionName } from "@/lib/viewTransition";
import { absoluteAssetUrl, absoluteUrl } from "@/lib/siteConfig";
import { publisherRef } from "@/lib/structuredData";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await getArticleSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) {
    return pageMetadata({ title: "Không tìm thấy bài viết", description: "Bài viết không tồn tại hoặc đã bị gỡ.", path: articleHref(slug), noIndex: true });
  }
  const imageUrl = article.coverImage ? resolveImageUrl(article.coverImage) : undefined;
  return pageMetadata({
    title: article.title,
    description: article.lead ?? article.title,
    path: article.url,
    image: imageUrl ? { url: imageUrl, alt: article.coverImage?.alt ?? article.title } : undefined,
    article: {
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      authorName: article.author?.name,
    },
  });
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) notFound();

  const [related, adjacent] = await Promise.all([
    getRelatedArticles(article.slug, 4),
    getAdjacentArticles(article.slug),
  ]);

  const hasBody = !!article.body && article.body.length > 0;
  const hasTags = !!article.tags && article.tags.length > 0;
  const imageUrl = article.coverImage ? resolveImageUrl(article.coverImage) : undefined;

  // `getHomepage()` is `cache()`-wrapped (`services/homepageService.ts`) and
  // already called once for this request by the root layout — this doesn't
  // re-fetch, just reads the org name for `publisher` from the same real
  // source the site's `Organization` schema uses, instead of a second
  // hard-coded copy of it.
  const homepage = await getHomepage();
  const articleUrl = absoluteUrl(article.url);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.lead,
    url: articleUrl,
    mainEntityOfPage: { "@type": "WebPage", "@id": articleUrl },
    datePublished: article.publishedAt,
    dateModified: article.updatedAt ?? article.publishedAt,
    publisher: publisherRef(homepage.footer.orgName),
    ...(article.author ? { author: { "@type": "Person", name: article.author.name } } : {}),
    ...(imageUrl ? { image: [absoluteAssetUrl(imageUrl)] } : {}),
  };

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Trang chủ", href: "/" },
          { label: "Tin tức", href: "/tin-tuc" },
          { label: article.category.name, href: categoryHref(article.category.slug) },
          { label: article.title },
        ]}
      />
      <article className={styles.wrap}>
        <header className={styles.head}>
          <Link href={categoryHref(article.category.slug)} className={styles.category}>
            {article.category.name}
          </Link>
          <h1 className={styles.headline}>{article.title}</h1>
          {article.lead && <p className={styles.sapo}>{article.lead}</p>}
          <ArticleMeta
            author={article.author}
            publishedAt={article.publishedAt}
            updatedAt={article.updatedAt}
            readingTimeMinutes={article.readingTimeMinutes}
          />
        </header>

        {article.coverImage && (
          <figure className={styles.coverWrap}>
            <div className={styles.cover} style={{ viewTransitionName: articleCoverTransitionName(article.url) }}>
              <MediaImage media={article.coverImage} />
            </div>
            {article.coverImage.caption && <figcaption className={styles.coverCaption}>{article.coverImage.caption}</figcaption>}
          </figure>
        )}

        <div className={styles.section}>
          {hasBody ? (
            <ArticleBody blocks={article.body!} />
          ) : (
            <EmptyState
              title="Nội dung bài viết đang được biên tập"
              description="Bản đầy đủ của bài viết chưa có trong dữ liệu mẫu — trang này sẽ hiển thị nội dung thật khi kết nối với hệ thống quản trị nội dung."
              action={{ label: "Xem tất cả tin tức", href: "/tin-tuc" }}
            />
          )}

          <ShareActions title={article.title} />

          {hasTags && (
            <div className={styles.tagsRow}>
              <TagList
                ariaLabel="Từ khoá liên quan"
                items={article.tags!.map((t) => ({ key: t.slug, href: searchHref(t.name), label: `#${t.name}` }))}
              />
            </div>
          )}
        </div>

        <div className={styles.bottomSection}>
          <RelatedArticles articles={related} />
          <AdjacentArticleNav previous={adjacent.previous} next={adjacent.next} />
        </div>
      </article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
