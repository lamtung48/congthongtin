import type { Metadata } from "next";
import { notFound, forbidden } from "next/navigation";
import { requireSession } from "@/server/auth/session";
import { articleService } from "@/server/services/articleService";
import { taxonomyService } from "@/server/services/taxonomyService";
import { mediaService } from "@/server/services/mediaService";
import { organizationRepository } from "@/server/repositories/organizationRepository";
import { provinceRepository } from "@/server/repositories/provinceRepository";
import { authorProfileRepository } from "@/server/repositories/authorProfileRepository";
import { hasPermission } from "@/server/auth/permissions";
import { ArticleEditor } from "./ArticleEditor";
import type { EditorBlock } from "./BlockEditor";

export const metadata: Metadata = { title: "Chỉnh sửa bài viết" };

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const article = await articleService.getById(id);
  if (!article) notFound();
  if (!articleService.canView(session, article)) forbidden();

  const canViewAnyMedia = hasPermission(session.role, "media.manage.any");
  const [categories, topics, tags, organizations, provinces, authors, mediaRows, ownAuthor, revisions] = await Promise.all([
    taxonomyService.listCategories(),
    taxonomyService.listTopics(),
    taxonomyService.listTags(),
    organizationRepository.list(),
    provinceRepository.list(),
    authorProfileRepository.list(),
    mediaService.listForAdmin(session, { take: 200 }),
    authorProfileRepository.findByUserId(session.id),
    articleService.listRevisions(session, article),
  ]);

  const blocks: EditorBlock[] = article.blocks.map((b) => ({ key: b.id, type: b.type, data: b.data as Record<string, unknown> }));

  return (
    <ArticleEditor
      articleId={article.id}
      initial={{
        slug: article.slug,
        title: article.title,
        subtitle: article.subtitle ?? "",
        excerpt: article.excerpt ?? "",
        categoryId: article.categoryId,
        authorId: article.authorId,
        organizationId: article.organizationId,
        provinceId: article.provinceId,
        coverMediaId: article.coverMediaId,
        ogMediaId: article.ogMediaId,
        seoTitle: article.seoTitle ?? "",
        seoDescription: article.seoDescription ?? "",
        canonicalUrl: article.canonicalUrl ?? "",
        topicIds: article.topics.map((t) => t.topicId),
        tagIds: article.tags.map((t) => t.tagId),
        blocks,
        status: article.status,
        returnNote: article.returnNote,
        publishedAt: article.publishedAt ? article.publishedAt.toISOString() : null,
      }}
      options={{
        categories: categories.map((c) => ({ id: c.id, name: c.name })),
        topics: topics.map((t) => ({ id: t.id, name: t.name })),
        tags: tags.map((t) => ({ id: t.id, name: t.name })),
        organizations: organizations.map((o) => ({ id: o.id, name: o.name })),
        provinces: provinces.map((p) => ({ id: p.id, name: p.name })),
        authors: authors.map((a) => ({ id: a.id, name: a.displayName })),
        media: mediaRows.map((m) => ({ id: m.id, label: m.alt || m.caption || m.providerFileId || m.id, type: m.type })),
      }}
      permissions={{
        canEditNow: articleService.canEdit(session, article),
        canSubmit: hasPermission(session.role, "article.submit"),
        canApprove: hasPermission(session.role, "article.approve"),
        canReturn: hasPermission(session.role, "article.return"),
        canPublish: hasPermission(session.role, "article.publish"),
        canSchedule: hasPermission(session.role, "article.schedule"),
        canUnpublish: hasPermission(session.role, "article.unpublish"),
        canDelete: hasPermission(session.role, "article.delete") && !(session.role === "MANAGER" && article.status === "PUBLISHED"),
        canRestoreRevision: hasPermission(session.role, "article.edit.any"),
        authorRestricted: !hasPermission(session.role, "article.edit.any"),
        ownAuthorId: ownAuthor?.id ?? null,
        canManageMediaAny: canViewAnyMedia,
      }}
      revisions={revisions.map((r) => ({
        version: r.version,
        changedByName: r.changedBy?.displayName ?? "Hệ thống",
        createdAt: r.createdAt.toISOString(),
        note: r.note,
      }))}
    />
  );
}
