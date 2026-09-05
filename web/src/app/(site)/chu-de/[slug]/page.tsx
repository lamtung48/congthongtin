import type { Metadata } from "next";
import { TopicPageView } from "./TopicPageView";
import { getTopics, getTopicBySlug } from "@/services/contentService";
import { pageMetadata } from "@/lib/seo";
import { topicHref } from "@/lib/routes";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const topics = await getTopics();
  return topics.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const topic = await getTopicBySlug(slug);
  if (!topic) {
    return pageMetadata({ title: "Không tìm thấy chủ đề", description: "Chủ đề không tồn tại.", path: topicHref(slug), noIndex: true });
  }
  return pageMetadata({ title: topic.name, description: `Bài viết theo chủ đề ${topic.name}.`, path: topicHref(topic.slug) });
}

export default async function TopicPage({ params }: Props) {
  const { slug } = await params;
  return <TopicPageView slug={slug} page={1} />;
}
