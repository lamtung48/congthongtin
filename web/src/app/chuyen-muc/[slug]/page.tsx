import type { Metadata } from "next";
import { CategoryPageView } from "./CategoryPageView";
import { getCategories, getCategoryBySlug } from "@/services/contentService";
import { pageMetadata } from "@/lib/seo";
import { categoryHref } from "@/lib/routes";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) {
    return pageMetadata({ title: "Không tìm thấy chuyên mục", description: "Chuyên mục không tồn tại.", path: categoryHref(slug), noIndex: true });
  }
  return pageMetadata({ title: category.name, description: `Tin tức thuộc chuyên mục ${category.name}.`, path: categoryHref(category.slug) });
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  return <CategoryPageView slug={slug} page={1} />;
}
