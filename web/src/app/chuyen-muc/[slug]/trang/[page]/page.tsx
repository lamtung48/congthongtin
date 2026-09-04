import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryPageView, getCategoryPageCount } from "../../CategoryPageView";
import { getCategories, getCategoryBySlug } from "@/services/contentService";
import { pageMetadata } from "@/lib/seo";
import { categoryHref, pagedHref } from "@/lib/routes";
import { ensureNonEmptyParams, staticPageParams } from "@/lib/pagination";

interface Props {
  params: Promise<{ slug: string; page: string }>;
}

/** Bottom-up generation (see Next.js `generateStaticParams` docs): computed
 *  directly here rather than composed from the sibling `[slug]/page.tsx`,
 *  since a `page.tsx` (not a `layout.tsx`) doesn't propagate params to a
 *  route nested below it. */
export async function generateStaticParams() {
  const categories = await getCategories();
  const params: { slug: string; page: string }[] = [];
  for (const c of categories) {
    const pageCount = await getCategoryPageCount(c.slug);
    for (const p of staticPageParams(pageCount)) params.push({ slug: c.slug, page: p.page });
  }
  return ensureNonEmptyParams(params, { slug: categories[0]?.slug ?? "khong-ton-tai", page: "1" });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, page } = await params;
  const pageNum = Number(page);
  const category = await getCategoryBySlug(slug);
  if (!category) {
    return pageMetadata({ title: "Không tìm thấy chuyên mục", description: "Chuyên mục không tồn tại.", path: categoryHref(slug), noIndex: true });
  }
  return pageMetadata({
    title: `${category.name} — Trang ${pageNum}`,
    description: `Tin tức thuộc chuyên mục ${category.name}.`,
    path: pagedHref(categoryHref(category.slug), pageNum),
  });
}

export default async function CategoryPagedPage({ params }: Props) {
  const { slug, page } = await params;
  const pageNum = Number(page);
  if (!Number.isInteger(pageNum) || pageNum <= 1) notFound();
  return <CategoryPageView slug={slug} page={pageNum} />;
}
