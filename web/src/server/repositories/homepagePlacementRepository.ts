import { prisma } from "@/server/db/client";
import type { HomepageContentType, HomepageSectionKey } from "@/generated/prisma/client";

/**
 * The article editor's "Hiển thị tại trang chủ" tick-boxes, backed by
 * `HomepagePlacement`. One article can be pinned into several sections at
 * once (the brief's "có thể 1 bài hiển thị ở nhiều nơi"), which is exactly
 * what the placement table already models — this repository is only the
 * per-article view of it.
 *
 * The other four `HomepageSectionKey` values hold Videos, Platforms, Events
 * and Galleries rather than Articles, so they are deliberately not offered
 * here; `homepageService` still resolves them from their own content types.
 */
export const ARTICLE_SECTION_KEYS = ["HERO", "FEATURED_ARTICLES", "STORY_RAIL", "LOCAL_NEWS"] as const;

export type ArticleSectionKey = (typeof ARTICLE_SECTION_KEYS)[number];

/** Labels are the headings a visitor actually reads on the homepage — the
 *  whole point of the tick-boxes is that an editor picks the place they can
 *  see, not an internal enum name. */
export const ARTICLE_SECTION_LABELS: Record<ArticleSectionKey, string> = {
  HERO: "Ảnh bìa lớn đầu trang",
  FEATURED_ARTICLES: "Tin tiêu điểm",
  STORY_RAIL: "Dòng chảy sinh viên",
  LOCAL_NEWS: "Tin từ cơ sở",
};

function isArticleSectionKey(key: HomepageSectionKey): key is ArticleSectionKey {
  return (ARTICLE_SECTION_KEYS as readonly HomepageSectionKey[]).includes(key);
}

export const homepagePlacementRepository = {
  async listSectionKeysForArticle(articleId: string): Promise<ArticleSectionKey[]> {
    const rows = await prisma.homepagePlacement.findMany({
      where: { contentType: "ARTICLE", contentId: articleId, isEnabled: true },
      select: { section: { select: { key: true } } },
    });
    return rows.map((r) => r.section.key).filter(isArticleSectionKey);
  },

  /**
   * Replaces the whole set of sections this article is pinned into — the
   * same "whole list, not a diff" contract `replaceBlocks`/`replaceTopics`
   * use, so an editor un-ticking a box actually removes the placement.
   * New pins go to the front of their section (`order` below the current
   * minimum): a freshly ticked article is the one the editor wants seen.
   */
  async setArticleSections(articleId: string, keys: ArticleSectionKey[]): Promise<void> {
    const wanted = new Set(keys.filter(isArticleSectionKey));

    const config = await prisma.homepageConfiguration.findFirst({
      where: { isActive: true },
      select: { sections: { select: { id: true, key: true } } },
    });
    if (!config) return;

    const existing = await prisma.homepagePlacement.findMany({
      where: { contentType: "ARTICLE", contentId: articleId },
      select: { id: true, section: { select: { key: true } } },
    });

    const stale = existing.filter((p) => !isArticleSectionKey(p.section.key) || !wanted.has(p.section.key)).map((p) => p.id);
    if (stale.length > 0) {
      await prisma.homepagePlacement.deleteMany({ where: { id: { in: stale } } });
    }

    const alreadyPinned = new Set(
      existing.filter((p) => isArticleSectionKey(p.section.key) && wanted.has(p.section.key)).map((p) => p.section.key),
    );

    for (const key of wanted) {
      if (alreadyPinned.has(key)) continue;
      const section = config.sections.find((s) => s.key === key);
      if (!section) continue;
      const lowest = await prisma.homepagePlacement.aggregate({
        where: { sectionId: section.id },
        _min: { order: true },
      });
      await prisma.homepagePlacement.create({
        data: {
          sectionId: section.id,
          contentType: "ARTICLE",
          contentId: articleId,
          order: (lowest._min.order ?? 0) - 1,
          isEnabled: true,
        },
      });
    }
  },

  /** Ids of every article currently pinned into one section — the article
   *  list uses this to render its per-row Hero toggle in the right state
   *  without one query per row. */
  async listPinnedArticleIds(key: ArticleSectionKey): Promise<Set<string>> {
    const rows = await prisma.homepagePlacement.findMany({
      where: { contentType: "ARTICLE", isEnabled: true, section: { key } },
      select: { contentId: true },
    });
    return new Set(rows.map((r) => r.contentId));
  },

  /** Pin/unpin one article in one section, leaving its other sections
   *  alone — the single-section counterpart to `setArticleSections`, for the
   *  article list's "Đưa lên Hero / Gỡ khỏi Hero" toggle. */
  async setArticleSection(articleId: string, key: ArticleSectionKey, pinned: boolean): Promise<void> {
    if (!pinned) {
      await prisma.homepagePlacement.deleteMany({
        where: { contentType: "ARTICLE", contentId: articleId, section: { key } },
      });
      return;
    }
    const section = await prisma.homepageSection.findFirst({
      where: { key, configuration: { isActive: true } },
      select: { id: true },
    });
    if (!section) return;
    const existing = await prisma.homepagePlacement.findFirst({
      where: { contentType: "ARTICLE", contentId: articleId, sectionId: section.id },
      select: { id: true },
    });
    if (existing) {
      await prisma.homepagePlacement.update({ where: { id: existing.id }, data: { isEnabled: true } });
      return;
    }
    const lowest = await prisma.homepagePlacement.aggregate({
      where: { sectionId: section.id },
      _min: { order: true },
    });
    await prisma.homepagePlacement.create({
      data: {
        sectionId: section.id,
        contentType: "ARTICLE",
        contentId: articleId,
        order: (lowest._min.order ?? 0) - 1,
        isEnabled: true,
      },
    });
  },

  /**
   * Every pinned content id in one section, **in the order the homepage will
   * show them** (`order` ascending). Unlike `listPinnedArticleIds` this
   * returns an array, not a Set, because for videos the order *is* the
   * feature: the first pinned video becomes the one in the player, and the
   * rest lead the playlist.
   */
  async listPinnedContentIds(key: HomepageSectionKey, contentType: HomepageContentType): Promise<string[]> {
    const rows = await prisma.homepagePlacement.findMany({
      where: { contentType, isEnabled: true, section: { key } },
      orderBy: { order: "asc" },
      select: { contentId: true },
    });
    return rows.map((r) => r.contentId);
  },

  /**
   * Pin/unpin one item in a section that holds many, leaving the others in
   * place. A new pin goes to `min(order) - 1`, i.e. the front — pinning a
   * video means "show this one first", so it must outrank the pins already
   * there rather than queue behind them.
   */
  async setContentPinned(
    key: HomepageSectionKey,
    contentType: HomepageContentType,
    contentId: string,
    pinned: boolean,
  ): Promise<void> {
    if (!pinned) {
      await prisma.homepagePlacement.deleteMany({ where: { contentType, contentId, section: { key } } });
      return;
    }
    const section = await prisma.homepageSection.findFirst({
      where: { key, configuration: { isActive: true } },
      select: { id: true },
    });
    if (!section) return;
    const existing = await prisma.homepagePlacement.findFirst({
      where: { contentType, contentId, sectionId: section.id },
      select: { id: true },
    });
    if (existing) {
      await prisma.homepagePlacement.update({ where: { id: existing.id }, data: { isEnabled: true } });
      return;
    }
    const lowest = await prisma.homepagePlacement.aggregate({ where: { sectionId: section.id }, _min: { order: true } });
    await prisma.homepagePlacement.create({
      data: { sectionId: section.id, contentType, contentId, order: (lowest._min.order ?? 0) - 1, isEnabled: true },
    });
  },

  /** The single pinned content id for a one-slot section (GALLERY), or
   *  `null` when nothing is pinned. */
  async findPinnedContentId(key: HomepageSectionKey, contentType: HomepageContentType): Promise<string | null> {
    const row = await prisma.homepagePlacement.findFirst({
      where: { contentType, isEnabled: true, section: { key } },
      orderBy: { order: "asc" },
      select: { contentId: true },
    });
    return row?.contentId ?? null;
  },

  /** Replaces a one-slot section's pin outright — `null` clears it, dropping
   *  the section back to its automatic fallback. */
  async setSingleContent(key: HomepageSectionKey, contentType: HomepageContentType, contentId: string | null): Promise<void> {
    const section = await prisma.homepageSection.findFirst({
      where: { key, configuration: { isActive: true } },
      select: { id: true },
    });
    if (!section) return;
    await prisma.homepagePlacement.deleteMany({ where: { sectionId: section.id, contentType } });
    if (!contentId) return;
    await prisma.homepagePlacement.create({
      data: { sectionId: section.id, contentType, contentId, order: 0, isEnabled: true },
    });
  },

  /** Called when an article is deleted — a placement pointing at a gone
   *  article is silently dropped by `homepageService` anyway, but leaving
   *  the row behind would keep occupying a slot's `order`. */
  deleteForArticle(articleId: string): Promise<unknown> {
    return prisma.homepagePlacement.deleteMany({ where: { contentType: "ARTICLE", contentId: articleId } });
  },
};
