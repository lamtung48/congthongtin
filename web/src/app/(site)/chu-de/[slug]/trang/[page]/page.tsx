import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TopicPageView, getTopicPageCount } from "../../TopicPageView";
import { getTopics, getTopicBySlug } from "@/services/contentService";
import { pageMetadata } from "@/lib/seo";
import { topicHref, pagedHref } from "@/lib/routes";
import { ensureNonEmptyParams, staticPageParams } from "@/lib/pagination";

interface Props {
  params: Promise<{ slug: string; page: string }>;
}

export async function generateStaticParams() {
  const topics = await getTopics();
  const params: { slug: string; page: string }[] = [];
  for (const t of topics) {
    const pageCount = await getTopicPageCount(t.slug);
    for (const p of staticPageParams(pageCount)) params.push({ slug: t.slug, page: p.page });
  }
  return ensureNonEmptyParams(params, { slug: topics[0]?.slug ?? "khong-ton-tai", page: "1" });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, page } = await params;
  const pageNum = Number(page);
  const topic = await getTopicBySlug(slug);
  if (!topic) {
    return pageMetadata({ title: "Không tìm thấy chủ đề", description: "Chủ đề không tồn tại.", path: topicHref(slug), noIndex: true });
  }
  return pageMetadata({
    title: `${topic.name} — Trang ${pageNum}`,
    description: `Bài viết theo chủ đề ${topic.name}.`,
    path: pagedHref(topicHref(topic.slug), pageNum),
  });
}

export default async function TopicPagedPage({ params }: Props) {
  const { slug, page } = await params;
  const pageNum = Number(page);
  if (!Number.isInteger(pageNum) || pageNum <= 1) notFound();
  return <TopicPageView slug={slug} page={pageNum} />;
}
