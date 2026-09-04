import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/ui/PageShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { getTopicBySlug, getTopics } from "@/services/contentService";
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
  const topic = await getTopicBySlug(slug);
  if (!topic) notFound();

  return (
    <PageShell
      breadcrumb={[{ label: "Trang chủ", href: "/" }, { label: "Chủ đề" }, { label: topic.name }]}
      eyebrow={`Chủ đề · ${topic.articleCount} bài viết`}
      title={topic.name}
      description={`Toàn bộ tin, bài liên quan tới chủ đề ${topic.name}.`}
    >
      <EmptyState
        title="Chưa có danh sách bài viết cho chủ đề này"
        description="Dữ liệu mẫu hiện chưa gắn bài viết cụ thể vào từng chủ đề — trang này sẽ hiển thị danh sách thật khi chủ đề được liên kết với nội dung trong hệ thống quản trị."
        action={{ label: "Xem tất cả tin tức", href: "/tin-tuc" }}
      />
    </PageShell>
  );
}
