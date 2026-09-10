import { galleryRepository } from "@/server/repositories/galleryRepository";
import { auditLogRepository } from "@/server/repositories/auditLogRepository";
import { hasPermission } from "@/server/auth/permissions";
import { slugify } from "@/lib/slug";
import type { SessionUser } from "@/server/auth/session";

/**
 * `gallery.manage` (ADMIN + MANAGER) gates every write here, re-checked
 * independently of whatever the Server Action already checked — same
 * discipline as `articleService`/`mediaService`. Reads are open to any
 * signed-in admin user, since a gallery is public content anyway.
 */
function assertCanManage(actor: SessionUser) {
  if (!hasPermission(actor.role, "gallery.manage")) {
    throw new Error(`Role ${actor.role} lacks permission "gallery.manage".`);
  }
}

export const galleryService = {
  list: galleryRepository.list,
  getById: galleryRepository.findById,

  async create(actor: SessionUser, fields: { title: string; description?: string }) {
    assertCanManage(actor);
    const title = fields.title.trim();
    if (!title) throw new Error("Tên nhóm ảnh không được để trống.");
    // A slug collision would be a hard failure on an otherwise valid create,
    // so it carries a short random suffix rather than asking the editor to
    // invent a unique one.
    const slug = `${slugify(title).slice(0, 70) || "nhom-anh"}-${Math.random().toString(36).slice(2, 6)}`;
    const gallery = await galleryRepository.create({
      title,
      slug,
      description: fields.description?.trim() || null,
    });
    await auditLogRepository.record({ actorId: actor.id, action: "CREATE", entityType: "Gallery", entityId: gallery.id });
    return gallery;
  },

  async update(actor: SessionUser, id: string, fields: { title: string; description?: string }) {
    assertCanManage(actor);
    const title = fields.title.trim();
    if (!title) throw new Error("Tên nhóm ảnh không được để trống.");
    const gallery = await galleryRepository.update(id, { title, description: fields.description?.trim() || null });
    await auditLogRepository.record({ actorId: actor.id, action: "UPDATE", entityType: "Gallery", entityId: id });
    return gallery;
  },

  async remove(actor: SessionUser, id: string) {
    assertCanManage(actor);
    await galleryRepository.remove(id);
    await auditLogRepository.record({ actorId: actor.id, action: "DELETE", entityType: "Gallery", entityId: id });
  },

  async addMedia(actor: SessionUser, galleryId: string, mediaIds: string[]) {
    assertCanManage(actor);
    const added = await galleryRepository.addMedia(galleryId, mediaIds);
    if (added > 0) {
      await auditLogRepository.record({
        actorId: actor.id,
        action: "UPDATE",
        entityType: "Gallery",
        entityId: galleryId,
        metadata: { addedPhotos: added },
      });
    }
    return added;
  },

  async removeItem(actor: SessionUser, itemId: string) {
    assertCanManage(actor);
    await galleryRepository.removeItem(itemId);
  },

  async setItemCaption(actor: SessionUser, itemId: string, caption: string) {
    assertCanManage(actor);
    return galleryRepository.setItemCaption(itemId, caption.trim() || null);
  },

  async moveItem(actor: SessionUser, itemId: string, direction: -1 | 1) {
    assertCanManage(actor);
    await galleryRepository.moveItem(itemId, direction);
  },
};
