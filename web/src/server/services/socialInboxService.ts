import { externalItemRepository, type ExternalItemWithRelations, type ExternalItemFilter } from "@/server/repositories/externalItemRepository";
import { userRepository } from "@/server/repositories/userRepository";
import { auditLogRepository } from "@/server/repositories/auditLogRepository";
import { notificationService } from "@/server/services/notificationService";
import { articleService } from "@/server/services/articleService";
import { slugify } from "@/lib/slug";
import { hasPermission } from "@/server/auth/permissions";
import { normalizedContentHash, extractHashtags } from "@/server/integrations/socialCollector/normalize";
import type { SessionUser } from "@/server/auth/session";

/** Brief section 2: every manually-pasted item shares this one seeded
 *  singleton `Source` row (`prisma/seed.ts`) — the same fixed-id-row
 *  pattern `YoutubeConnection` uses (`id: "default"`), since a manual
 *  paste has no real "source" of its own to register. */
const MANUAL_SOURCE_ID = "manual-external";

/**
 * Social/External Content Collector task, brief section 5: the Social
 * Inbox workflow — Ignore / Assign to Contributor / Convert to Article.
 * `canView`/permission split mirrors `articleService.canView`/`assertCanEdit`
 * exactly: `social_inbox.manage` (ADMIN + MANAGER) sees and acts on
 * anything; `social_inbox.convert_own` (CONTRIBUTOR) only ever sees or
 * converts an item already assigned to them (brief: "CONTRIBUTOR nếu
 * được assign → tạo Draft"). Converting **always** creates a `DRAFT`
 * Article — brief section 6: "Không auto publish external content" — from
 * that point on it's a completely ordinary Article going through the
 * existing Draft → Review → Approve → Publish pipeline
 * (`articleService.ts`), nothing here special-cases an Article that
 * happened to originate from an `ExternalItem`.
 */

function canViewItem(actor: SessionUser, item: Pick<ExternalItemWithRelations, "assignedToId">): boolean {
  if (hasPermission(actor.role, "social_inbox.manage")) return true;
  return hasPermission(actor.role, "social_inbox.convert_own") && item.assignedToId === actor.id;
}

function assertHasPermission(actor: SessionUser, permission: Parameters<typeof hasPermission>[1]) {
  if (!hasPermission(actor.role, permission)) {
    throw new Error(`Role ${actor.role} lacks permission "${permission}".`);
  }
}

/** First ~80 characters of the fetched text, used only when neither the
 *  post nor the converting editor supplies an explicit title (e.g. a
 *  Facebook post has no title field at all). */
function deriveTitleFromContent(contentText: string): string {
  const oneLine = contentText.replace(/\s+/g, " ").trim();
  return oneLine.length > 80 ? `${oneLine.slice(0, 80)}…` : oneLine;
}

export const socialInboxService = {
  canView: canViewItem,

  getById: externalItemRepository.findById,

  /** Brief section 5: CONTRIBUTOR's queue is scoped to their own
   *  assignments, never the full inbox — enforced here, not left to the
   *  caller to remember. */
  listForActor(actor: SessionUser, filter: Omit<ExternalItemFilter, "assignedToId"> = {}) {
    if (hasPermission(actor.role, "social_inbox.manage")) {
      return externalItemRepository.listForAdmin(filter);
    }
    if (hasPermission(actor.role, "social_inbox.convert_own")) {
      return externalItemRepository.listForAdmin({ ...filter, assignedToId: actor.id });
    }
    throw new Error(`Role ${actor.role} cannot view the Social Inbox.`);
  },

  /** Brief section 2/5: a Manager/Admin spots something outside a
   *  whitelisted source and pastes it in by hand — no fetch, no adapter,
   *  goes straight into the inbox as `PENDING_REVIEW` under the shared
   *  `MANUAL_EXTERNAL` singleton source. Still runs through the same
   *  dedup checks (brief section 7) a fetched post would, so pasting the
   *  same URL twice doesn't create two inbox rows. */
  async createManual(actor: SessionUser, fields: { url: string; title?: string; contentText: string }) {
    assertHasPermission(actor, "social_inbox.manage");
    const contentText = fields.contentText.trim();
    if (!contentText) throw new Error("Nội dung không được để trống.");
    const hash = normalizedContentHash(contentText);
    const now = new Date();
    const existingByUrl = await externalItemRepository.findByUrl(fields.url);
    if (existingByUrl) throw new Error("Đường dẫn này đã có trong Social Inbox.");
    const existingByHash = await externalItemRepository.findByNormalizedHashNearTime(MANUAL_SOURCE_ID, hash, now, 48 * 60 * 60 * 1000);
    if (existingByHash) throw new Error("Nội dung tương tự đã có trong Social Inbox.");

    return externalItemRepository.create({
      sourceId: MANUAL_SOURCE_ID,
      url: fields.url,
      title: fields.title?.trim() || undefined,
      contentText,
      normalizedContentHash: hash,
      hashtags: extractHashtags(contentText),
      publishedAt: now,
      createdById: actor.id,
    });
  },

  async ignore(actor: SessionUser, item: ExternalItemWithRelations) {
    assertHasPermission(actor, "social_inbox.manage");
    if (item.status !== "PENDING_REVIEW" && item.status !== "ASSIGNED") {
      throw new Error("Chỉ có thể bỏ qua nội dung đang chờ xử lý hoặc đã giao.");
    }
    const updated = await externalItemRepository.ignore(item.id, actor.id);
    await auditLogRepository.record({ actorId: actor.id, action: "IGNORE_EXTERNAL", entityType: "ExternalItem", entityId: item.id });
    return updated;
  },

  /** Brief section 8: "Manager có thể Assign to Contributor. Tạo
   *  notification." */
  async assign(actor: SessionUser, item: ExternalItemWithRelations, contributorId: string) {
    assertHasPermission(actor, "social_inbox.manage");
    if (item.status !== "PENDING_REVIEW" && item.status !== "ASSIGNED") {
      throw new Error("Chỉ có thể giao nội dung đang chờ xử lý hoặc đã giao trước đó.");
    }
    const contributor = await userRepository.findById(contributorId);
    if (!contributor || contributor.role !== "CONTRIBUTOR" || contributor.status !== "ACTIVE") {
      throw new Error("Chỉ có thể giao cho một Cộng tác viên đang hoạt động.");
    }
    const updated = await externalItemRepository.assign(item.id, contributorId);
    await auditLogRepository.record({ actorId: actor.id, action: "ASSIGN_EXTERNAL", entityType: "ExternalItem", entityId: item.id, metadata: { contributorId } });
    await notificationService.notifyUser(
      contributorId,
      "EXTERNAL_ITEM_ASSIGNED",
      "ExternalItem",
      item.id,
      `Bạn được giao xử lý nội dung từ "${item.source.name}": "${item.title ?? deriveTitleFromContent(item.contentText)}".`,
    );
    return updated;
  },

  /**
   * Brief section 5: Manager/Admin can convert any active item directly;
   * a Contributor can only convert an item already assigned to them.
   * Always produces a `DRAFT` (brief section 6) — `articleService.create`
   * never defaults to anything else.
   */
  async convertToArticle(actor: SessionUser, item: ExternalItemWithRelations, fields: { categoryId: string; title?: string }) {
    if (item.status === "CONVERTED") throw new Error("Nội dung này đã được chuyển thành bài viết.");
    if (item.status === "IGNORED") throw new Error("Không thể chuyển một nội dung đã bị bỏ qua.");

    if (hasPermission(actor.role, "social_inbox.manage")) {
      // Any PENDING_REVIEW or ASSIGNED item — no ownership check.
    } else if (hasPermission(actor.role, "social_inbox.convert_own")) {
      if (item.status !== "ASSIGNED" || item.assignedToId !== actor.id) {
        throw new Error("Bạn chỉ có thể chuyển nội dung đã được giao cho chính mình.");
      }
    } else {
      throw new Error(`Role ${actor.role} cannot convert Social Inbox items.`);
    }

    const title = fields.title?.trim() || item.title || deriveTitleFromContent(item.contentText);
    const article = await articleService.create(actor, {
      fields: {
        slug: `${slugify(title)}-${Math.random().toString(36).slice(2, 7)}`,
        title,
        categoryId: fields.categoryId,
        excerpt: item.excerpt ?? undefined,
      },
      blocks: [
        { type: "PARAGRAPH", order: 0, data: { runs: [{ text: item.contentText }] } },
        {
          type: "QUOTE",
          order: 1,
          data: { text: "Nội dung được tổng hợp từ nguồn bên ngoài — vui lòng biên tập lại trước khi xuất bản.", cite: item.url },
        },
      ],
    });
    if (!article) throw new Error("Không thể tạo bài viết từ nội dung này.");

    await externalItemRepository.markConverted(item.id, article.id);
    await auditLogRepository.record({ actorId: actor.id, action: "CONVERT_EXTERNAL", entityType: "ExternalItem", entityId: item.id, metadata: { articleId: article.id } });
    return article;
  },
};
