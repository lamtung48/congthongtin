import { sourceRepository, type PublicSource, type SourceAdminFilter } from "@/server/repositories/sourceRepository";
import { externalItemRepository } from "@/server/repositories/externalItemRepository";
import { auditLogRepository } from "@/server/repositories/auditLogRepository";
import { encryptSecret, decryptSecret } from "@/server/crypto/secretBox";
import { getFetcherForSourceType } from "@/server/integrations/socialCollector/registry";
import { normalizedContentHash, passesHashtagRules } from "@/server/integrations/socialCollector/normalize";
import type { NormalizedExternalPost } from "@/server/integrations/socialCollector/types";
import { hasPermission } from "@/server/auth/permissions";
import type { SessionUser } from "@/server/auth/session";
import type { SourceType } from "@/generated/prisma/client";

/**
 * Social/External Content Collector task. `source.manage` (ADMIN only —
 * brief section 1: "cấu hình source; token/integration; enable/disable
 * source; quản lý collector") gates every write here; `source.view`
 * (ADMIN + MANAGER) gates reads. Every read already excludes
 * `encryptedCredential` at the repository layer
 * (`sourceRepository`'s `publicSelect`) — this file only ever decrypts
 * it inside `sync()`, right before handing it to the matching adapter,
 * and never returns it from any exported function.
 */

function assertHasPermission(actor: SessionUser, permission: Parameters<typeof hasPermission>[1]) {
  if (!hasPermission(actor.role, permission)) {
    throw new Error(`Role ${actor.role} lacks permission "${permission}".`);
  }
}

function assertCanView(actor: SessionUser) {
  if (!hasPermission(actor.role, "source.manage") && !hasPermission(actor.role, "source.view")) {
    throw new Error(`Role ${actor.role} cannot view sources.`);
  }
}

/** Trims/lower-cases/strips a leading `#` so `passesHashtagRules`'s
 *  case-insensitive comparison behaves the same regardless of how an
 *  Admin typed a rule ("#TinhNguyen", "tinhnguyen", " TinhNguyen "). */
function normalizeHashtagList(tags: string[] | undefined): string[] {
  if (!tags) return [];
  return tags.map((t) => t.trim().replace(/^#/, "").toLowerCase()).filter((t) => t.length > 0);
}

export interface SourceFieldsInput {
  name?: string;
  type?: SourceType;
  externalUrl?: string | null;
  externalId?: string | null;
  /** `undefined` = leave the stored credential untouched; `null` = clear
   *  it; a string = encrypt and replace it. Never re-read back — see
   *  this file's header comment. */
  credential?: string | null;
  includeHashtags?: string[];
  excludeHashtags?: string[];
  categoryId?: string | null;
}

export const sourceService = {
  list(actor: SessionUser, params: SourceAdminFilter = {}): Promise<PublicSource[]> {
    assertCanView(actor);
    return sourceRepository.list(params);
  },

  getById(actor: SessionUser, id: string): Promise<PublicSource | null> {
    assertCanView(actor);
    return sourceRepository.findById(id);
  },

  async create(actor: SessionUser, fields: SourceFieldsInput & { name: string; type: SourceType }): Promise<PublicSource> {
    assertHasPermission(actor, "source.manage");
    const source = await sourceRepository.create({
      name: fields.name,
      type: fields.type,
      externalUrl: fields.externalUrl ?? null,
      externalId: fields.externalId ?? null,
      encryptedCredential: fields.credential ? encryptSecret(fields.credential) : null,
      includeHashtags: normalizeHashtagList(fields.includeHashtags),
      excludeHashtags: normalizeHashtagList(fields.excludeHashtags),
      categoryId: fields.categoryId ?? null,
      createdById: actor.id,
    });
    await auditLogRepository.record({ actorId: actor.id, action: "CREATE_SOURCE", entityType: "Source", entityId: source.id });
    return source;
  },

  async update(actor: SessionUser, source: PublicSource, fields: SourceFieldsInput): Promise<PublicSource> {
    assertHasPermission(actor, "source.manage");
    const data: Record<string, unknown> = {};
    if (fields.name !== undefined) data.name = fields.name;
    if (fields.type !== undefined) data.type = fields.type;
    if (fields.externalUrl !== undefined) data.externalUrl = fields.externalUrl;
    if (fields.externalId !== undefined) data.externalId = fields.externalId;
    if (fields.credential !== undefined) data.encryptedCredential = fields.credential === null ? null : encryptSecret(fields.credential);
    if (fields.includeHashtags !== undefined) data.includeHashtags = normalizeHashtagList(fields.includeHashtags);
    if (fields.excludeHashtags !== undefined) data.excludeHashtags = normalizeHashtagList(fields.excludeHashtags);
    if (fields.categoryId !== undefined) data.categoryId = fields.categoryId;

    const updated = await sourceRepository.update(source.id, data);
    await auditLogRepository.record({
      actorId: actor.id,
      action: "UPDATE_SOURCE",
      entityType: "Source",
      entityId: source.id,
      metadata: { fields: Object.keys(data).filter((k) => k !== "encryptedCredential") },
    });
    return updated;
  },

  /** Brief section 1: "enable/disable source" — ADMIN only, same as every
   *  other `Source` write (unlike `Platform`'s equivalent toggle, which
   *  Manager also holds — Manager's role here is read-only, brief section
   *  1 & 3). */
  async setEnabled(actor: SessionUser, source: PublicSource, isEnabled: boolean): Promise<PublicSource> {
    assertHasPermission(actor, "source.manage");
    const updated = await sourceRepository.update(source.id, { isEnabled });
    await auditLogRepository.record({ actorId: actor.id, action: "UPDATE_SOURCE", entityType: "Source", entityId: source.id, metadata: { isEnabled } });
    return updated;
  },

  async remove(actor: SessionUser, source: PublicSource): Promise<void> {
    assertHasPermission(actor, "source.manage");
    if (source.type === "MANUAL_EXTERNAL") {
      throw new Error("Không thể xoá nguồn nhập thủ công mặc định.");
    }
    await sourceRepository.remove(source.id);
    await auditLogRepository.record({ actorId: actor.id, action: "DELETE", entityType: "Source", entityId: source.id });
  },

  /**
   * Brief sections 4-7, 9-10: fetch (real adapter) → normalize (already
   * done by the adapter) → filter hashtag/category (only on data the
   * adapter actually returned) → dedup → insert `PENDING_REVIEW`. Always
   * writes `SYNC_SOURCE`, success or failure (brief section 12) — a sync
   * attempt is worth a trail either way, unlike a routine read.
   */
  async sync(actor: SessionUser, source: PublicSource): Promise<{ ok: true; fetched: number; stored: number } | { ok: false; reason: string; message: string }> {
    assertHasPermission(actor, "source.manage");

    const fetcher = getFetcherForSourceType(source.type);
    if (!fetcher) {
      const message = "Nguồn này không có adapter đồng bộ tự động (chỉ nhập thủ công).";
      await sourceRepository.recordSyncFailure(source.id, message);
      await auditLogRepository.record({ actorId: actor.id, action: "SYNC_SOURCE", entityType: "Source", entityId: source.id, metadata: { ok: false, reason: "invalid_source" } });
      return { ok: false, reason: "invalid_source", message };
    }

    const withCredential = await sourceRepository.findByIdWithCredential(source.id);
    const credential = withCredential?.encryptedCredential ? decryptSecret(withCredential.encryptedCredential) : null;

    const result = await fetcher.fetchPosts({ externalUrl: source.externalUrl, externalId: source.externalId, credential });
    if (!result.ok) {
      await sourceRepository.recordSyncFailure(source.id, result.message);
      await auditLogRepository.record({
        actorId: actor.id,
        action: "SYNC_SOURCE",
        entityType: "Source",
        entityId: source.id,
        metadata: { ok: false, reason: result.reason, message: result.message },
      });
      return { ok: false, reason: result.reason, message: result.message };
    }

    const filtered = result.posts.filter((p) => passesHashtagRules(p.hashtags, source.includeHashtags, source.excludeHashtags));

    let stored = 0;
    for (const post of filtered) {
      const hash = normalizedContentHash(post.contentText);
      const duplicate = await findDuplicate(source.id, post, hash);
      if (duplicate) continue;
      await externalItemRepository.create({
        sourceId: source.id,
        externalId: post.externalId,
        url: post.url,
        title: post.title,
        excerpt: post.excerpt,
        contentText: post.contentText,
        normalizedContentHash: hash,
        hashtags: post.hashtags,
        publishedAt: post.publishedAt,
      });
      stored += 1;
    }

    await sourceRepository.recordSyncSuccess(source.id, stored);
    await auditLogRepository.record({
      actorId: actor.id,
      action: "SYNC_SOURCE",
      entityType: "Source",
      entityId: source.id,
      metadata: { ok: true, fetched: result.posts.length, filteredOut: result.posts.length - filtered.length, stored },
    });
    return { ok: true, fetched: result.posts.length, stored };
  },
};

/** Dedup (brief section 7), checked in the order the brief lists:
 *  externalId -> URL -> source+normalized content within a time window
 *  around the candidate's own `publishedAt` (falls back to "now" for a
 *  post with no publish date, e.g. some WEBSITE unfurls). 48h window: wide
 *  enough to catch a same-day repost/edit, narrow enough that a genuine
 *  unrelated post from the same page months later with coincidentally
 *  similar wording is never falsely merged. */
async function findDuplicate(sourceId: string, post: NormalizedExternalPost, hash: string) {
  if (post.externalId) {
    const byExternalId = await externalItemRepository.findBySourceAndExternalId(sourceId, post.externalId);
    if (byExternalId) return byExternalId;
  }
  const byUrl = await externalItemRepository.findByUrl(post.url);
  if (byUrl) return byUrl;
  const around = post.publishedAt ?? new Date();
  return externalItemRepository.findByNormalizedHashNearTime(sourceId, hash, around, 48 * 60 * 60 * 1000);
}
