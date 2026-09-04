import Link from "next/link";
import type { ArticleSummary } from "@/domain/article";
import { formatDateVi } from "@/lib/formatDate";
import { categoryHref } from "@/lib/routes";
import styles from "./ArticleList.module.css";

/** One compact row — the building block of `ArticleList`, also usable
 *  standalone wherever a page needs a plain list without the `<ul>`
 *  wrapper (e.g. mixed in among other content). */
export function NewsListItem({ article: a }: { article: ArticleSummary }) {
  return (
    <li className={styles.item}>
      <div className={styles.meta}>
        <Link href={categoryHref(a.category.slug)} className={styles.cat}>{a.category.name}</Link>
        <span className={styles.date}>{formatDateVi(a.publishedAt)}</span>
        {a.place && <span className={styles.place}>{a.place}</span>}
      </div>
      <h3 className={styles.title}>
        <Link href={a.url}>{a.title}</Link>
      </h3>
      {a.lead && <p className={styles.lead}>{a.lead}</p>}
    </li>
  );
}

/** Shared listing row used by every article-list route (`/tin-tuc`,
 *  `/chuyen-muc/[slug]`, `/dia-phuong/[slug]`) so they stay visually
 *  consistent instead of each reinventing a card layout. */
export function ArticleList({ articles }: { articles: ArticleSummary[] }) {
  return (
    <ul className={styles.list}>
      {articles.map((a) => (
        <NewsListItem key={a.slug} article={a} />
      ))}
    </ul>
  );
}
