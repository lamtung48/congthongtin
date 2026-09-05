import "dotenv/config";
import { test, describe, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import type { ArticleBlockInput } from "@/server/services/articleService";

/**
 * Brief section 15 (mandatory): "Phải test truy cập trực tiếp vào API/server
 * action, không chỉ qua giao diện." This suite calls `articleService` and
 * `userService` directly — the same functions every Server Action in
 * `src/app/admin/**\/actions.ts` calls — against the real dev database, with
 * throwaway fixtures cleaned up in `after()`. It does not go through
 * `/admin/login` or any HTTP request; the Playwright checks run manually
 * during development covered that surface (see docs/AUTHENTICATION.md,
 * "Testing").
 *
 * `@/server/auth/session` is mocked below because it imports `next/headers`
 * and `next/navigation`, both of which require a live Next.js request scope
 * (`cookies()`/`redirect()` throw outside one) — real when this code runs as
 * part of a page/Server Action, meaningless in a plain Node test process.
 * `userService.setStatus` only needs one export from it
 * (`destroyAllSessionsForUser`, a thin wrapper over `sessionRepository`), so
 * that's the only thing mocked; every permission/ownership check under test
 * still runs for real.
 *
 * Run with: `npm test` (see package.json — the flags below are required,
 * not optional):
 *   node --conditions=react-server --experimental-test-module-mocks \
 *        --import tsx --test src/server/__tests__/**\/*.test.ts
 * `--conditions=react-server` makes the `server-only` package resolve to its
 * no-op build instead of throwing (the same package.json "exports" switch
 * Next's own bundler uses); `--experimental-test-module-mocks` enables
 * `mock.module` below.
 */

mock.module("@/server/auth/session", {
  namedExports: { destroyAllSessionsForUser: async () => {} },
});

/**
 * Production Data Policy task's own mock, same rationale as the session
 * mock above: `revalidatePath`/`revalidateTag` require a live Next.js
 * request/Server Action lifecycle (`articleService.ts`'s
 * `revalidatePublicSite()` calls these on publish/unpublish/edit-while-
 * published) — meaningless, and throwing ("Invariant: static generation
 * store missing"), outside one. Every permission/workflow rule under test
 * still runs for real; only this cache-invalidation side effect is faked.
 */
mock.module("next/cache", {
  namedExports: { revalidatePath: () => {}, revalidateTag: () => {} },
});

/**
 * The Google Drive media task's own mock, same rationale as the session mock
 * above: `googleDrive.ts` throws `GoogleDriveNotConfiguredError` unless real
 * service-account env vars are set (never true in this test run), which
 * would make every `mediaService.remove()` on a `GOOGLE_DRIVE` asset fail
 * before it even reached the permission/usage checks under test here. Per
 * the brief's own instruction for this task ("test toàn bộ logic còn lại
 * bằng cách mock riêng lớp gọi Google API ở tầng test — không giả lập trong
 * code production"), only this integration boundary is faked; every
 * permission/ownership/usage rule in `mediaService`/`mediaRepository` below
 * still runs for real against the dev database.
 */
mock.module("@/server/integrations/googleDrive", {
  namedExports: {
    uploadFileToDrive: async () => ({ fileId: `mock-drive-file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, size: 1024 }),
    deleteFileFromDrive: async () => {},
    getDriveFileStream: async () => {
      throw new Error("getDriveFileStream is not exercised by this test suite");
    },
    isGoogleDriveConfigured: () => true,
    GoogleDriveNotConfiguredError: class GoogleDriveNotConfiguredError extends Error {},
    GoogleDriveOperationError: class GoogleDriveOperationError extends Error {},
  },
});

/**
 * The YouTube integration task's own mock, same rationale as the Google
 * Drive one above — this environment has no real OAuth client/refresh
 * token, so every function `youtubeService.ts` calls through
 * `src/server/integrations/youtube.ts` is faked here; every permission/
 * policy/visibility rule *inside* `youtubeService` itself still runs for
 * real against the dev database. Video ids are fixed 11-character strings
 * (the real `parseYoutubeVideoId` format `youtubeUrl.ts` enforces) keyed
 * into `MOCK_VIDEO_STATUS` below, so `linkExistingVideo`/`importChannelVideo`
 * exercise the exact same "verify against the real API" path production
 * code takes — just against this in-memory fake instead of Google's.
 */
interface MockVideoStatus {
  uploadStatus: string;
  privacyStatus: "public" | "unlisted" | "private";
  embeddable: boolean;
  durationSeconds: number;
  title: string;
  description: string;
}
const MOCK_VIDEO_STATUS: Record<string, MockVideoStatus> = {
  AAAAAAAAAAA: { uploadStatus: "processed", privacyStatus: "public", embeddable: true, durationSeconds: 120, title: "Video công khai", description: "Mô tả công khai" },
  BBBBBBBBBBB: { uploadStatus: "processed", privacyStatus: "unlisted", embeddable: true, durationSeconds: 90, title: "Video không công khai", description: "" },
  CCCCCCCCCCC: { uploadStatus: "processed", privacyStatus: "private", embeddable: true, durationSeconds: 60, title: "Video riêng tư", description: "" },
  EEEEEEEEEEE: { uploadStatus: "processed", privacyStatus: "public", embeddable: false, durationSeconds: 30, title: "Video tắt nhúng", description: "" },
  // "DDDDDDDDDDD" is intentionally absent — getVideoStatus(...) === null,
  // simulating a removed/never-existed video.
};

mock.module("@/server/integrations/youtube", {
  namedExports: {
    isYoutubeConfigured: () => true,
    buildYoutubeAuthUrl: (state: string) => `https://mock-google-oauth.test/authorize?state=${state}`,
    exchangeCodeForTokens: async () => ({ refreshToken: "mock-refresh-token", channelId: "UC_mock_channel", channelTitle: "Kênh test HSV" }),
    encryptToken: (token: string) => `enc:${token}`,
    uploadVideoToYoutube: async (
      _buffer: Buffer,
      _mimeType: string,
      options: { title: string; description: string; privacyStatus: "public" | "unlisted" | "private" },
    ) => {
      const videoId = `up${Math.random().toString(36).slice(2, 11)}`.padEnd(11, "0").slice(0, 11);
      MOCK_VIDEO_STATUS[videoId] = {
        uploadStatus: "processed",
        privacyStatus: options.privacyStatus,
        embeddable: true,
        durationSeconds: 42,
        title: options.title,
        description: options.description,
      };
      return { videoId };
    },
    getVideoStatus: async (videoId: string) => MOCK_VIDEO_STATUS[videoId] ?? null,
    updateVideoMetadata: async (videoId: string, changes: { title?: string; description?: string; privacyStatus?: "public" | "unlisted" | "private" }) => {
      const existing = MOCK_VIDEO_STATUS[videoId];
      if (!existing) return;
      if (changes.title !== undefined) existing.title = changes.title;
      if (changes.description !== undefined) existing.description = changes.description;
      if (changes.privacyStatus !== undefined) existing.privacyStatus = changes.privacyStatus;
    },
    listChannelUploads: async (pageToken?: string) => {
      if (pageToken) return { items: [], nextPageToken: undefined };
      return {
        items: [
          { videoId: "AAAAAAAAAAA", title: "Video công khai", thumbnailUrl: "https://img.example.test/1.jpg", publishedAt: "2024-01-01T00:00:00Z" },
          { videoId: "BBBBBBBBBBB", title: "Video không công khai", thumbnailUrl: "https://img.example.test/2.jpg", publishedAt: "2024-01-02T00:00:00Z" },
        ],
        nextPageToken: "page-2",
      };
    },
  },
});

/**
 * Ecosystem integration task's own mock, same rationale as the Google
 * Drive/YouTube ones above and the brief's own instruction for this task
 * ("test bằng cách mock riêng lớp gọi API ở tầng test — không giả lập
 * trong code production"): `platformService.refreshActivity` is the only
 * caller of `getAdapterForCategory`, and this fakes just that lookup —
 * every permission/failure-handling rule *inside* `platformService` itself
 * still runs for real. `mockAdapterResult`/`mockAdapterCallCount` are
 * mutated per-test (see the "Ecosystem integration" describe block below)
 * to exercise both the success path and brief section 6's "timeout;
 * fallback; cached/default state" without a real network call.
 */
let mockAdapterResult: { ok: true; currentActivity: string; status?: string } | { ok: false; reason: string; message: string } = {
  ok: true,
  currentActivity: "Mock: 5 khoá đang mở",
};
let mockAdapterCallCount = 0;
mock.module("@/server/integrations/platformAdapters/registry", {
  namedExports: {
    getAdapterForCategory: (category: string) => {
      if (category === "DATA") return undefined;
      return {
        category,
        fetchActivity: async () => {
          mockAdapterCallCount += 1;
          return mockAdapterResult;
        },
      };
    },
  },
});

const { hasPermission, PERMISSIONS, ROLE_LABELS, ASSIGNABLE_ROLES } = await import("@/server/auth/permissions");
const { prisma } = await import("@/server/db/client");
const { articleService } = await import("@/server/services/articleService");
const { userService } = await import("@/server/services/userService");
const { mediaService, MediaInUseError } = await import("@/server/services/mediaService");
const { youtubeService } = await import("@/server/services/youtubeService");
const { platformService } = await import("@/server/services/platformService");
const { platformRepository } = await import("@/server/repositories/platformRepository");
const { hashPassword } = await import("@/server/auth/password");
const { articleRepository } = await import("@/server/repositories/articleRepository");
const { notificationService } = await import("@/server/services/notificationService");
const { DatabaseProvider } = await import("@/data-access/providers/databaseProvider");
const databaseProvider = new DatabaseProvider();

type Actor = { id: string; email: string; displayName: string; role: "ADMIN" | "MANAGER" | "CONTRIBUTOR"; status: "ACTIVE" | "DISABLED" };

let categoryId: string;
let admin: Actor;
let manager: Actor;
let contributorA: Actor;
let contributorB: Actor;
let contributorAAuthorProfileId: string;
let otherAuthorProfileId: string;
const testUserIds: string[] = [];
const testArticleIds: string[] = [];
/** Every article id this suite ever created, even ones later spliced out of
 *  `testArticleIds` after a test deletes them directly (see "Manager must
 *  unpublish... before deleting it" below). `Notification.entityId` is a
 *  loose reference with no FK/cascade back to `Article` — a deleted
 *  article's notifications would otherwise never be cleaned up, since by
 *  the time `after()` runs, its id is no longer in `testArticleIds` at all. */
const allArticleIdsEverCreated: string[] = [];
const testAuthorProfileIds: string[] = [];
const testMediaIds: string[] = [];
const testGalleryIds: string[] = [];
const testVideoIds: string[] = [];
const testPlatformIds: string[] = [];

async function makeUser(role: Actor["role"], label: string): Promise<Actor> {
  const passwordHash = await hashPassword(`throwaway-${label}-${Math.random()}`);
  const user = await prisma.user.create({
    data: {
      email: `test-authz-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`,
      displayName: `Test ${label}`,
      role,
      status: "ACTIVE",
      passwordHash,
    },
  });
  testUserIds.push(user.id);
  return { id: user.id, email: user.email, displayName: user.displayName, role: user.role, status: user.status };
}

/**
 * `articleService.publish`/`unpublish`/`schedule` return whatever
 * `articleRepository.updateStatus` gives back (no relation `include`, unlike
 * `findById`) — fine for the real Server Actions in `articles/actions.ts`,
 * which never chain that result into a second workflow call, but this test
 * chains several transitions in a row, so it re-fetches the full
 * `ArticleWithRelations` between steps the same way a fresh page load would.
 */
async function reload(id: string) {
  const article = await articleService.getById(id);
  if (!article) throw new Error(`Test article ${id} disappeared`);
  return article;
}

/** Includes one PARAGRAPH block by default — most tests below need a
 *  publish-ready article (`assertPublishReady` in `articleService.ts`
 *  requires at least one block), and only the test specifically about that
 *  validation constructs a body-less article itself. */
async function makeArticle(actor: Actor, title: string, blocks: ArticleBlockInput[] = [{ type: "PARAGRAPH", order: 0, data: { runs: [{ text: "Nội dung mẫu." }] } }]) {
  const article = await articleService.create(actor, {
    fields: { slug: `test-authz-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title, categoryId },
    blocks,
  });
  if (!article) throw new Error("articleService.create returned null unexpectedly");
  testArticleIds.push(article.id);
  allArticleIdsEverCreated.push(article.id);
  return article;
}

/** Bypasses `platformService`'s own permission gate — pure fixture setup,
 *  same reasoning as `makeUser` using `prisma.user.create` directly rather
 *  than going through a service. Tests exercising `platformService.create`
 *  itself call that directly instead. */
async function makePlatform(overrides: Partial<Parameters<typeof platformRepository.create>[0]> = {}) {
  const platform = await platformRepository.create({
    slug: `test-authz-platform-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: "Test Platform",
    description: "Nền tảng test cho authorization suite",
    url: "https://platform.example.test",
    category: "TRAINING",
    status: "ACTIVE",
    accessLevel: "Cần đăng nhập",
    ...overrides,
  });
  testPlatformIds.push(platform.id);
  return platform;
}

before(async () => {
  const category = await prisma.category.create({
    data: { slug: `test-authz-category-${Date.now()}`, name: "Test category (authorization suite)" },
  });
  categoryId = category.id;

  admin = await makeUser("ADMIN", "admin");
  manager = await makeUser("MANAGER", "manager");
  contributorA = await makeUser("CONTRIBUTOR", "contributor-a");
  contributorB = await makeUser("CONTRIBUTOR", "contributor-b");

  const ownProfile = await prisma.authorProfile.create({
    data: { userId: contributorA.id, displayName: "Bút danh của Contributor A" },
  });
  contributorAAuthorProfileId = ownProfile.id;
  testAuthorProfileIds.push(ownProfile.id);

  const otherProfile = await prisma.authorProfile.create({ data: { displayName: "Bút danh của người khác" } });
  otherAuthorProfileId = otherProfile.id;
  testAuthorProfileIds.push(otherProfile.id);
});

after(async () => {
  delete process.env.YOUTUBE_ALLOW_CONTRIBUTOR_UPLOAD;
  await prisma.youtubeConnection.deleteMany({ where: { id: "default" } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: testUserIds } } });
  // `Notification.userId` cascades on User delete, which covers the four
  // throwaway actors below — but `notifyRoles(["ADMIN","MANAGER"])`
  // (`notificationService.ts`, called from `articleService.submitForReview`)
  // fans out to *every* active Manager/Admin, including the real seeded
  // `manager@hoisinhvien.vn`/`admin@hoisinhvien.vn` accounts this suite never
  // deletes. Without this, every test run would permanently litter those
  // real accounts' Notification Center with throwaway test messages —
  // cleaned up here by `entityId` (every one of this suite's notifications
  // points at a `testArticleIds` row) rather than by recipient.
  await prisma.notification.deleteMany({ where: { entityType: "Article", entityId: { in: allArticleIdsEverCreated } } });
  await prisma.articleSlugHistory.deleteMany({ where: { articleId: { in: testArticleIds } } });
  // Articles first — this clears any Article.coverMediaId/ogMediaId FK
  // pointing at a test MediaAsset before that asset is deleted below.
  await prisma.article.deleteMany({ where: { id: { in: testArticleIds } } });
  // Gallery (cascades its GalleryItem rows) and Video both hold a *required*
  // FK to MediaAsset — deleted before the assets themselves, same reasoning.
  await prisma.gallery.deleteMany({ where: { id: { in: testGalleryIds } } });
  await prisma.video.deleteMany({ where: { id: { in: testVideoIds } } });
  await prisma.mediaAsset.deleteMany({ where: { id: { in: testMediaIds } } });
  await prisma.platform.deleteMany({ where: { id: { in: testPlatformIds } } });
  await prisma.authorProfile.deleteMany({ where: { id: { in: testAuthorProfileIds } } });
  await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });
  await prisma.category.delete({ where: { id: categoryId } });
  await prisma.$disconnect();
});

describe("Permission matrix (brief sections 2 & 16)", () => {
  test("ADMIN holds every permission", () => {
    for (const permission of PERMISSIONS) {
      assert.equal(hasPermission("ADMIN", permission), true, `ADMIN should hold "${permission}"`);
    }
  });

  test("MANAGER cannot manage accounts, change roles, or configure the system", () => {
    for (const permission of ["user.manage", "user.changeRole", "system.configure", "auditlog.view.full"] as const) {
      assert.equal(hasPermission("MANAGER", permission), false, `MANAGER should NOT hold "${permission}"`);
    }
  });

  test("MANAGER can run the content workflow end to end", () => {
    for (const permission of [
      "article.edit.any",
      "article.approve",
      "article.return",
      "article.publish",
      "article.schedule",
      "article.unpublish",
      "taxonomy.manage",
      "organization.manage",
      "event.manage",
      "homepage.manage",
    ] as const) {
      assert.equal(hasPermission("MANAGER", permission), true, `MANAGER should hold "${permission}"`);
    }
  });

  test("CONTRIBUTOR can only draft, edit own, and submit their own work", () => {
    for (const permission of ["article.create", "article.edit.own", "article.submit", "media.manage.own"] as const) {
      assert.equal(hasPermission("CONTRIBUTOR", permission), true, `CONTRIBUTOR should hold "${permission}"`);
    }
    for (const permission of [
      "article.edit.any",
      "article.approve",
      "article.publish",
      "article.delete",
      "user.manage",
      "taxonomy.manage",
    ] as const) {
      assert.equal(hasPermission("CONTRIBUTOR", permission), false, `CONTRIBUTOR should NOT hold "${permission}"`);
    }
  });

  test("exactly three assignable roles with the brief's exact display labels", () => {
    assert.deepEqual([...ASSIGNABLE_ROLES].sort(), ["ADMIN", "CONTRIBUTOR", "MANAGER"]);
    assert.deepEqual(ROLE_LABELS, { ADMIN: "Admin", MANAGER: "Quản trị viên", CONTRIBUTOR: "Cộng tác viên" });
  });
});

describe("Article workflow — server-side enforcement (brief sections 9 & 15)", () => {
  test("Contributor can create their own article and submit it for review", async () => {
    const article = await makeArticle(contributorA, "Contributor draft");
    assert.equal(article!.status, "DRAFT");
    assert.equal(article!.createdById, contributorA.id);

    const submitted = await articleService.submitForReview(contributorA, article!);
    assert.equal(submitted.status, "IN_REVIEW");
  });

  test("Contributor cannot approve, publish, schedule, unpublish, or delete", async () => {
    const article = await makeArticle(contributorA, "Contributor cannot escalate");
    await articleService.submitForReview(contributorA, article!);

    await assert.rejects(() => articleService.approve(contributorA, article!));
    await assert.rejects(() => articleService.publish(contributorA, article!));
    await assert.rejects(() => articleService.schedule(contributorA, article!, new Date()));
    await assert.rejects(() => articleService.unpublish(contributorA, article!));
    await assert.rejects(() => articleService.remove(contributorA, article!));
  });

  test("Contributor cannot edit another Contributor's article", async () => {
    const articleOfB = await makeArticle(contributorB, "Belongs to contributor B");
    await assert.rejects(() =>
      articleService.update(contributorA, articleOfB!, { fields: { title: "Hijacked" } }),
    );
  });

  test("Manager can approve, publish, and return an article for revision", async () => {
    const toApprove = await makeArticle(contributorA, "Manager approves this");
    await articleService.submitForReview(contributorA, toApprove!);
    const approved = await articleService.approve(manager, await reload(toApprove!.id));
    assert.equal(approved.status, "APPROVED");
    const published = await articleService.publish(manager, await reload(approved.id));
    assert.equal(published.status, "PUBLISHED");

    const toReturn = await makeArticle(contributorA, "Manager returns this");
    await articleService.submitForReview(contributorA, toReturn!);
    const returned = await articleService.returnForRevision(manager, await reload(toReturn!.id), "Cần bổ sung nguồn.");
    assert.equal(returned.status, "DRAFT");
    assert.equal(returned.returnNote, "Cần bổ sung nguồn.");
  });

  test("Manager must unpublish a published article before deleting it; Admin does not", async () => {
    const article = await makeArticle(contributorA, "Published, Manager tries to delete");
    await articleService.submitForReview(contributorA, article!);
    const approved = await articleService.approve(manager, await reload(article!.id));
    const published = await articleService.publish(manager, await reload(approved.id));

    const stillPublished = await reload(published.id);
    await assert.rejects(() => articleService.remove(manager, stillPublished));

    const unpublished = await articleService.unpublish(manager, await reload(published.id));
    await articleService.remove(manager, await reload(unpublished.id));
    testArticleIds.splice(testArticleIds.indexOf(article!.id), 1);

    const article2 = await makeArticle(contributorA, "Published, Admin deletes directly");
    await articleService.submitForReview(contributorA, article2!);
    const approved2 = await articleService.approve(manager, await reload(article2!.id));
    const published2 = await articleService.publish(manager, await reload(approved2.id));
    await articleService.remove(admin, await reload(published2.id));
    testArticleIds.splice(testArticleIds.indexOf(article2!.id), 1);
  });
});

describe("User management — Admin only (brief sections 7 & 15)", () => {
  test("Manager cannot create, change roles, disable, or reset passwords for any account", async () => {
    await assert.rejects(() =>
      userService.create(manager, { email: "should-not-exist@example.test", displayName: "X", role: "CONTRIBUTOR", password: "irrelevant" }),
    );
    await assert.rejects(() => userService.changeRole(manager, contributorA.id, "ADMIN"));
    await assert.rejects(() => userService.setStatus(manager, contributorA.id, "DISABLED"));
    await assert.rejects(() => userService.resetPassword(manager, contributorA.id));
  });

  test("Contributor cannot manage accounts either", async () => {
    await assert.rejects(() =>
      userService.create(contributorA, { email: "should-not-exist-2@example.test", displayName: "X", role: "CONTRIBUTOR", password: "irrelevant" }),
    );
    await assert.rejects(() => userService.changeRole(contributorA, manager.id, "ADMIN"));
  });

  test("Admin cannot change their own role or disable their own account", async () => {
    await assert.rejects(() => userService.changeRole(admin, admin.id, "MANAGER"));
    await assert.rejects(() => userService.setStatus(admin, admin.id, "DISABLED"));
  });

  test("Admin can create a user, change another user's role, and disable/enable another account", async () => {
    const created = await userService.create(admin, {
      email: `test-authz-created-${Date.now()}@example.test`,
      displayName: "Created by Admin test",
      role: "CONTRIBUTOR",
      password: "Some-Temp-Pass-1",
    });
    testUserIds.push(created.id);
    assert.equal(created.role, "CONTRIBUTOR");
    assert.equal((created as unknown as { passwordHash?: unknown }).passwordHash, undefined);

    const promoted = await userService.changeRole(admin, created.id, "MANAGER");
    assert.equal(promoted.role, "MANAGER");

    const disabled = await userService.setStatus(admin, created.id, "DISABLED");
    assert.equal(disabled.status, "DISABLED");

    const reEnabled = await userService.setStatus(admin, created.id, "ACTIVE");
    assert.equal(reEnabled.status, "ACTIVE");
  });
});

describe("CMS bài viết — workflow nâng cao (nhiệm vụ CMS)", () => {
  test("Contributor bị khoá không thể sửa bài đã gửi duyệt, nhưng sửa được sau khi bị trả lại", async () => {
    const article = await makeArticle(contributorA, "Khoá bài khi đang duyệt");
    await articleService.submitForReview(contributorA, article!);
    const inReview = await reload(article!.id);

    await assert.rejects(() => articleService.update(contributorA, inReview, { fields: { title: "Sửa lén" } }));
    await assert.rejects(() => articleService.autosaveDraft(contributorA, inReview, { fields: { title: "Autosave lén" } }));

    const returned = await articleService.returnForRevision(manager, inReview, "Cần chỉnh sửa thêm.");
    assert.equal(returned.status, "DRAFT");
    const editedAfterReturn = await articleService.update(contributorA, await reload(article!.id), { fields: { title: "Đã sửa sau khi bị trả lại" } });
    assert.equal(editedAfterReturn?.title, "Đã sửa sau khi bị trả lại");
  });

  test("autosaveDraft chỉ hoạt động khi bài đang DRAFT", async () => {
    const article = await makeArticle(contributorA, "Autosave hợp lệ khi DRAFT");
    const saved = await articleService.autosaveDraft(contributorA, article!, { fields: { subtitle: "Sapo tự động lưu" } });
    assert.equal(saved?.subtitle, "Sapo tự động lưu");

    await articleService.submitForReview(contributorA, await reload(article!.id));
    const inReview = await reload(article!.id);
    await assert.rejects(() => articleService.autosaveDraft(contributorA, inReview, { fields: { subtitle: "Không được nữa" } }));
  });

  test("Không thể xuất bản hoặc hẹn giờ bài thiếu nội dung", async () => {
    const article = await makeArticle(contributorA, "Bài rỗng không có block", []);
    await articleService.submitForReview(contributorA, article!);
    const approved = await articleService.approve(manager, await reload(article!.id));

    await assert.rejects(() => articleService.publish(manager, approved));
    await assert.rejects(() => articleService.schedule(manager, approved, new Date(Date.now() + 3600_000)));
  });

  test("Slug trùng bị từ chối; đổi slug của bài đã từng xuất bản lưu lại lịch sử", async () => {
    const articleA = await makeArticle(contributorA, "Bài A giữ slug gốc");
    const articleB = await makeArticle(contributorA, "Bài B thử đổi slug trùng");

    const reloadedB = await reload(articleB!.id);
    await assert.rejects(() => articleService.update(contributorA, reloadedB, { fields: { slug: articleA!.slug } }));

    // Publish articleA first so its next rename must be tracked in history.
    await articleService.submitForReview(contributorA, await reload(articleA!.id));
    const approvedA = await articleService.approve(manager, await reload(articleA!.id));
    await articleService.publish(manager, approvedA);

    const oldSlug = articleA!.slug;
    const newSlug = `${oldSlug}-renamed`;
    await articleService.update(manager, await reload(articleA!.id), { fields: { slug: newSlug } });

    const historyEntry = await prisma.articleSlugHistory.findUnique({ where: { slug: oldSlug } });
    assert.ok(historyEntry, "expected the old slug to be recorded in ArticleSlugHistory");
    assert.equal(historyEntry?.articleId, articleA!.id);
  });

  test("archive() và unpublish() là hai hành động khác nhau", async () => {
    const draftArticle = await makeArticle(contributorA, "Lưu trữ một bản nháp cũ");
    await assert.rejects(() => articleService.unpublish(manager, draftArticle!), "unpublish must refuse a non-PUBLISHED article");

    const archived = await articleService.archive(manager, draftArticle!);
    assert.equal(archived.status, "ARCHIVED");

    const restored = await articleService.restoreFromArchive(manager, await reload(archived.id));
    assert.equal(restored.status, "DRAFT");

    const publishedArticle = await makeArticle(contributorA, "Xuất bản rồi gỡ bài");
    await articleService.submitForReview(contributorA, publishedArticle!);
    const approvedPub = await articleService.approve(manager, await reload(publishedArticle!.id));
    await articleService.publish(manager, approvedPub);
    const published = await reload(publishedArticle!.id);
    await assert.rejects(() => articleService.archive(manager, published), "archive must refuse a PUBLISHED article");
    const unpublished = await articleService.unpublish(manager, published);
    assert.equal(unpublished.status, "ARCHIVED");
  });

  test("Chỉ Manager/Admin được khôi phục phiên bản; Contributor bị từ chối", async () => {
    const article = await makeArticle(contributorA, "Bản gốc trước khi sửa");
    const v1Title = article!.title;
    const updated = await articleService.update(contributorA, article!, { fields: { title: "Đã đổi tiêu đề" } });
    assert.equal(updated?.title, "Đã đổi tiêu đề");

    await assert.rejects(() => articleService.restoreRevision(contributorA, updated!, 1));

    const restored = await articleService.restoreRevision(manager, updated!, 1);
    assert.equal(restored?.title, v1Title);
  });

  test("Contributor chỉ được chọn chính mình làm tác giả; Manager chọn tự do", async () => {
    await assert.rejects(() =>
      articleService.create(contributorA, {
        fields: { slug: `test-authz-${Date.now()}-badauthor`, title: "Mạo danh tác giả khác", categoryId, authorId: otherAuthorProfileId },
      }),
    );

    const ownAuthorArticle = await articleService.create(contributorA, {
      fields: { slug: `test-authz-${Date.now()}-ownauthor`, title: "Tự nhận đúng bút danh của mình", categoryId, authorId: contributorAAuthorProfileId },
    });
    testArticleIds.push(ownAuthorArticle!.id);
    assert.equal(ownAuthorArticle?.authorId, contributorAAuthorProfileId);

    const managerCreated = await articleService.create(manager, {
      fields: { slug: `test-authz-${Date.now()}-managerpicks`, title: "Manager chọn tác giả bất kỳ", categoryId, authorId: otherAuthorProfileId },
    });
    testArticleIds.push(managerCreated!.id);
    assert.equal(managerCreated?.authorId, otherAuthorProfileId);
  });

  test("listForAdmin luôn ép createdById theo Contributor, bỏ qua giá trị truyền vào", async () => {
    const ownArticle = await makeArticle(contributorA, "Bài của Contributor A cho test listForAdmin");
    const results = await articleService.listForAdmin(contributorA, { createdById: manager.id });
    assert.ok(results.every((a) => a.createdById === contributorA.id), "Contributor's list must never include another user's articles");
    assert.ok(results.some((a) => a.id === ownArticle!.id));
  });
});

describe("Media library — tích hợp Google Drive (nhiệm vụ Google Drive media, brief mục 1/5/7/9)", () => {
  test("registerUpload: bất kỳ role nào giữ media.manage.own/any đều đăng ký được upload của chính mình", async () => {
    const asset = await mediaService.registerUpload(contributorA, {
      providerFileId: "drive-file-1",
      type: "IMAGE",
      filename: "a.jpg",
      mimeType: "image/jpeg",
      size: 1024,
      width: 100,
      height: 100,
    });
    testMediaIds.push(asset.id);
    assert.equal(asset.createdById, contributorA.id);
    assert.equal(asset.status, "READY");
    assert.equal(asset.provider, "GOOGLE_DRIVE");
  });

  test("updateMetadata: Contributor chỉ sửa được media của chính mình; Manager sửa được của người khác", async () => {
    const ownAsset = await mediaService.registerUpload(contributorA, { providerFileId: "d-2", type: "IMAGE", filename: "b.jpg", mimeType: "image/jpeg", size: 10 });
    testMediaIds.push(ownAsset.id);
    const updated = await mediaService.updateMetadata(contributorA, ownAsset.id, { alt: "Mô tả mới" });
    assert.equal(updated.alt, "Mô tả mới");

    const othersAsset = await mediaService.registerUpload(contributorB, { providerFileId: "d-3", type: "IMAGE", filename: "c.jpg", mimeType: "image/jpeg", size: 10 });
    testMediaIds.push(othersAsset.id);
    await assert.rejects(() => mediaService.updateMetadata(contributorA, othersAsset.id, { alt: "Hack" }));

    const managerEdited = await mediaService.updateMetadata(manager, othersAsset.id, { caption: "Manager sửa được của người khác" });
    assert.equal(managerEdited.caption, "Manager sửa được của người khác");
  });

  test("registerManualLink: chỉ Admin/Manager liên kết ảnh thủ công — Contributor luôn bị từ chối, kể cả trước đây từng có nhánh riêng cho video", async () => {
    await assert.rejects(() =>
      mediaService.registerManualLink(contributorA, { provider: "GOOGLE_DRIVE", type: "IMAGE", providerFileId: "manual-1" }),
    );
    const manualImage = await mediaService.registerManualLink(manager, { provider: "GOOGLE_DRIVE", type: "IMAGE", providerFileId: "manual-2" });
    testMediaIds.push(manualImage.id);
    assert.equal(manualImage.status, "READY");

    // The YouTube integration task replaced the old "trust a hand-typed
    // video id" carve-out with `youtubeService.linkExistingVideo` (verified
    // against the real API — see the "Video library" suite below), so this
    // now requires `media.manage.any` like every other manual link.
    await assert.rejects(() =>
      mediaService.registerManualLink(contributorA, { provider: "YOUTUBE", type: "VIDEO", providerFileId: "yt-1" }),
    );
  });

  test("remove(): Contributor không thể xoá media của người khác, và không thể xoá media đang được dùng làm cover", async () => {
    const asset = await mediaService.registerUpload(contributorA, { providerFileId: "d-remove-1", type: "IMAGE", filename: "d.jpg", mimeType: "image/jpeg", size: 10 });
    testMediaIds.push(asset.id);

    const other = await mediaService.registerUpload(contributorB, { providerFileId: "d-remove-2", type: "IMAGE", filename: "e.jpg", mimeType: "image/jpeg", size: 10 });
    testMediaIds.push(other.id);
    await assert.rejects(() => mediaService.remove(contributorA, other.id));

    const article = await makeArticle(contributorA, "Bài dùng ảnh cover test remove");
    await articleService.update(contributorA, article!, { fields: { coverMediaId: asset.id } });
    await assert.rejects(() => mediaService.remove(contributorA, asset.id));

    await articleService.update(contributorA, await reload(article!.id), { fields: { coverMediaId: null } });
    await mediaService.remove(contributorA, asset.id);
    testMediaIds.splice(testMediaIds.indexOf(asset.id), 1);
  });

  test("remove(): Manager luôn bị chặn nếu media đang được dùng, kể cả không phải chủ sở hữu", async () => {
    const asset = await mediaService.registerUpload(contributorA, { providerFileId: "d-mgr-1", type: "IMAGE", filename: "f.jpg", mimeType: "image/jpeg", size: 10 });
    testMediaIds.push(asset.id);
    const article = await makeArticle(contributorA, "Bài dùng ảnh test manager remove");
    await articleService.update(contributorA, article!, { fields: { coverMediaId: asset.id } });

    await assert.rejects(() => mediaService.remove(manager, asset.id));

    await articleService.update(contributorA, await reload(article!.id), { fields: { coverMediaId: null } });
    await mediaService.remove(manager, asset.id);
    testMediaIds.splice(testMediaIds.indexOf(asset.id), 1);
  });

  test("remove(): Admin cần force để xoá media có usage tuỳ chọn (soft), nhưng luôn bị chặn nếu có usage bắt buộc (hard)", async () => {
    const softAsset = await mediaService.registerUpload(admin, { providerFileId: "d-admin-soft", type: "IMAGE", filename: "g.jpg", mimeType: "image/jpeg", size: 10 });
    testMediaIds.push(softAsset.id);
    const article = await makeArticle(contributorA, "Bài test admin force delete");
    await articleService.update(contributorA, article!, { fields: { coverMediaId: softAsset.id } });

    let caught: unknown;
    try {
      await mediaService.remove(admin, softAsset.id);
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof MediaInUseError, "Admin without force must be refused via MediaInUseError, carrying the usage list");
    assert.ok((caught as InstanceType<typeof MediaInUseError>).usage.length > 0);

    await mediaService.remove(admin, softAsset.id, { force: true });
    testMediaIds.splice(testMediaIds.indexOf(softAsset.id), 1);
    const refreshedArticle = await reload(article!.id);
    assert.equal(refreshedArticle.coverMediaId, null, "force-delete must null out the optional FK it just deleted the target of");

    const hardAsset = await mediaService.registerUpload(admin, { providerFileId: "d-admin-hard", type: "IMAGE", filename: "h.jpg", mimeType: "image/jpeg", size: 10 });
    testMediaIds.push(hardAsset.id);
    const gallery = await prisma.gallery.create({ data: { title: "Test gallery hard block" } });
    testGalleryIds.push(gallery.id);
    await prisma.galleryItem.create({ data: { galleryId: gallery.id, mediaId: hardAsset.id, order: 0 } });

    await assert.rejects(() => mediaService.remove(admin, hardAsset.id, { force: true }), "a hardBlock usage (GalleryItem's required FK) must refuse even with force: true");
  });

  test("Block ảnh trong nội dung bài viết đồng bộ MediaUsage — xoá bị chặn cho tới khi gỡ khỏi nội dung", async () => {
    const image1 = await mediaService.registerUpload(contributorA, { providerFileId: "d-block-1", type: "IMAGE", filename: "i.jpg", mimeType: "image/jpeg", size: 10 });
    testMediaIds.push(image1.id);

    const article = await makeArticle(contributorA, "Bài có block ảnh test usage", [
      { type: "PARAGRAPH", order: 0, data: { runs: [{ text: "Nội dung." }] } },
      { type: "IMAGE", order: 1, data: { mediaId: image1.id } },
    ]);

    const usage = await mediaService.getUsageDetail(image1.id);
    assert.ok(usage.some((u) => u.usageType === "ARTICLE_BLOCK"), "an IMAGE block's mediaId must show up as ARTICLE_BLOCK usage");
    await assert.rejects(() => mediaService.remove(contributorA, image1.id));

    await articleService.update(contributorA, await reload(article!.id), {
      fields: {},
      blocks: [{ type: "PARAGRAPH", order: 0, data: { runs: [{ text: "Đã bỏ ảnh." }] } }],
    });
    const usageAfter = await mediaService.getUsageDetail(image1.id);
    assert.equal(usageAfter.length, 0, "removing the IMAGE block must also remove its MediaUsage row");
    await mediaService.remove(contributorA, image1.id);
    testMediaIds.splice(testMediaIds.indexOf(image1.id), 1);
  });
});

describe("Video library — tích hợp YouTube (nhiệm vụ tích hợp YouTube, brief mục 1/3/9)", () => {
  test("canUploadVideo/isContributorUploadAllowed phản ánh đúng biến môi trường YOUTUBE_ALLOW_CONTRIBUTOR_UPLOAD", () => {
    delete process.env.YOUTUBE_ALLOW_CONTRIBUTOR_UPLOAD;
    assert.equal(youtubeService.isContributorUploadAllowed(), false);
    assert.equal(youtubeService.canUploadVideo(contributorA), false);
    assert.equal(youtubeService.canUploadVideo(manager), true);
    assert.equal(youtubeService.canUploadVideo(admin), true);

    process.env.YOUTUBE_ALLOW_CONTRIBUTOR_UPLOAD = "true";
    assert.equal(youtubeService.isContributorUploadAllowed(), true);
    assert.equal(youtubeService.canUploadVideo(contributorA), true);
    delete process.env.YOUTUBE_ALLOW_CONTRIBUTOR_UPLOAD;
  });

  test("uploadVideo: CONTRIBUTOR bị chặn khi chính sách tắt; khi bật, luôn bị ép về UNLISTED bất kể yêu cầu", async () => {
    delete process.env.YOUTUBE_ALLOW_CONTRIBUTOR_UPLOAD;
    await assert.rejects(() =>
      youtubeService.uploadVideo(contributorA, { buffer: Buffer.from("x"), mimeType: "video/mp4", title: "Contributor bị chặn", description: "", visibility: "public" }),
    );

    process.env.YOUTUBE_ALLOW_CONTRIBUTOR_UPLOAD = "true";
    const asset = await youtubeService.uploadVideo(contributorA, {
      buffer: Buffer.from("x"),
      mimeType: "video/mp4",
      title: "Contributor upload khi được bật",
      description: "Mô tả",
      visibility: "public",
    });
    testMediaIds.push(asset.id);
    assert.equal(asset.visibility, "UNLISTED", "một Contributor không bao giờ tự public được, kể cả khi yêu cầu public");
    assert.equal(asset.createdById, contributorA.id);
    assert.equal(asset.provider, "YOUTUBE");
    delete process.env.YOUTUBE_ALLOW_CONTRIBUTOR_UPLOAD;
  });

  test("uploadVideo: MANAGER/ADMIN chọn visibility tự do, kể cả PRIVATE", async () => {
    const asset = await youtubeService.uploadVideo(manager, {
      buffer: Buffer.from("x"),
      mimeType: "video/mp4",
      title: "Manager upload private",
      description: "",
      visibility: "private",
    });
    testMediaIds.push(asset.id);
    assert.equal(asset.visibility, "PRIVATE");
  });

  test("linkExistingVideo: parse URL/ID thật qua API, từ chối video không tồn tại hoặc chuỗi không hợp lệ", async () => {
    const asset = await youtubeService.linkExistingVideo(contributorA, "https://youtu.be/AAAAAAAAAAA");
    testMediaIds.push(asset.id);
    assert.equal(asset.provider, "YOUTUBE");
    assert.equal(asset.providerFileId, "AAAAAAAAAAA");
    assert.equal(asset.visibility, "PUBLIC");
    assert.equal(asset.durationSeconds, 120);

    await assert.rejects(() => youtubeService.linkExistingVideo(contributorA, "DDDDDDDDDDD"), "video hợp lệ về hình thức nhưng không có thật trên YouTube phải bị từ chối");
    await assert.rejects(() => youtubeService.linkExistingVideo(contributorA, "khong phai url hop le"));
  });

  test("listChannelUploadsForPicker/importChannelVideo: chỉ Admin/Manager duyệt được kênh, Contributor bị từ chối", async () => {
    await assert.rejects(() => youtubeService.listChannelUploadsForPicker(contributorA));
    const page = await youtubeService.listChannelUploadsForPicker(manager);
    assert.equal(page.items.length, 2);

    await assert.rejects(() => youtubeService.importChannelVideo(contributorA, "BBBBBBBBBBB"));
    const imported = await youtubeService.importChannelVideo(admin, "BBBBBBBBBBB");
    testMediaIds.push(imported.id);
    assert.equal(imported.visibility, "UNLISTED");
  });

  test("updateVideoMetadata: CONTRIBUTOR chỉ sửa video của chính mình và không thể tự đặt PUBLIC/PRIVATE; MANAGER sửa tự do kể cả của người khác", async () => {
    const ownAsset = await youtubeService.linkExistingVideo(contributorA, "BBBBBBBBBBB");
    testMediaIds.push(ownAsset.id);

    const updatedOwn = await youtubeService.updateVideoMetadata(contributorA, ownAsset.id, { title: "Tiêu đề mới", visibility: "unlisted" });
    assert.equal(updatedOwn.filename, "Tiêu đề mới");
    await assert.rejects(() => youtubeService.updateVideoMetadata(contributorA, ownAsset.id, { visibility: "public" }), "Contributor không được tự chuyển video của mình sang public");

    const othersAsset = await youtubeService.linkExistingVideo(contributorB, "AAAAAAAAAAA");
    testMediaIds.push(othersAsset.id);
    await assert.rejects(() => youtubeService.updateVideoMetadata(contributorA, othersAsset.id, { title: "Chiếm quyền" }), "Contributor không được sửa video không phải của mình");

    const managerEdited = await youtubeService.updateVideoMetadata(manager, othersAsset.id, { visibility: "private" });
    assert.equal(managerEdited.visibility, "PRIVATE");
  });

  test("refreshStatus: đồng bộ lại trạng thái thật từ YouTube, kể cả khi video đã bị gỡ khỏi kênh", async () => {
    const asset = await youtubeService.linkExistingVideo(manager, "CCCCCCCCCCC");
    testMediaIds.push(asset.id);
    assert.equal(asset.visibility, "PRIVATE");

    delete MOCK_VIDEO_STATUS.CCCCCCCCCCC;
    const refreshed = await youtubeService.refreshStatus(manager, asset.id);
    assert.equal(refreshed.status, "REMOVED");
    assert.equal(refreshed.errorReason, "removed");
  });

  test("listForAdmin: lọc thư viện video theo visibility hoạt động đúng", async () => {
    // Freshly-uploaded videos only (not the shared fixed ids like
    // "AAAAAAAAAAA" other tests above already linked and some also mutate
    // via `updateVideoMetadata` — reusing one here would make this test's
    // outcome depend on suite ordering).
    const pub = await youtubeService.uploadVideo(manager, { buffer: Buffer.from("x"), mimeType: "video/mp4", title: "Video lọc public", description: "", visibility: "public" });
    testMediaIds.push(pub.id);
    const priv = await youtubeService.uploadVideo(manager, { buffer: Buffer.from("x"), mimeType: "video/mp4", title: "Video lọc private", description: "", visibility: "private" });
    testMediaIds.push(priv.id);

    const onlyPrivate = await mediaService.listForAdmin(manager, { type: "VIDEO", visibility: "PRIVATE" });
    assert.ok(onlyPrivate.some((v) => v.id === priv.id));
    assert.ok(!onlyPrivate.some((v) => v.id === pub.id));
  });

  test("Kết nối kênh YouTube (OAuth) chỉ Admin mới được thực hiện; connect/disconnect đọc/ghi đúng trạng thái", async () => {
    await assert.rejects(() => youtubeService.getConnectionStatus(manager));
    assert.throws(() => youtubeService.beginConnect(contributorA));

    const { url, state } = youtubeService.beginConnect(admin);
    assert.ok(url.includes(state));

    const connection = await youtubeService.completeConnect(admin, "mock-auth-code");
    assert.equal(connection.channelId, "UC_mock_channel");

    const status = await youtubeService.getConnectionStatus(admin);
    assert.equal(status.connected, true);
    if (status.connected) assert.equal(status.channelTitle, "Kênh test HSV");

    await assert.rejects(() => youtubeService.disconnect(contributorA));
    await youtubeService.disconnect(admin);

    const afterDisconnect = await youtubeService.getConnectionStatus(admin);
    assert.equal(afterDisconnect.connected, false);
  });
});

describe("Production Data Policy — chỉ public bài PUBLISHED có publishedAt hợp lệ (nhiệm vụ kết nối database, brief mục 2)", () => {
  test("DRAFT/IN_REVIEW/APPROVED/SCHEDULED không xuất hiện trên DatabaseProvider công khai", async () => {
    const draft = await makeArticle(contributorA, "Bài DRAFT không được public");

    const inReview = await makeArticle(contributorA, "Bài IN_REVIEW không được public");
    await articleService.submitForReview(contributorA, await reload(inReview!.id));

    const approved = await makeArticle(contributorA, "Bài APPROVED không được public");
    await articleService.submitForReview(contributorA, await reload(approved!.id));
    await articleService.approve(manager, await reload(approved!.id));

    const scheduled = await makeArticle(contributorA, "Bài SCHEDULED không được public");
    await articleService.submitForReview(contributorA, await reload(scheduled!.id));
    await articleService.approve(manager, await reload(scheduled!.id));
    await articleService.schedule(manager, await reload(scheduled!.id), new Date(Date.now() + 3600_000));

    const nonPublicArticles = [draft!, inReview!, approved!, scheduled!];
    for (const a of nonPublicArticles) {
      assert.equal(await databaseProvider.getArticleBySlug(a.slug), null, `getArticleBySlug("${a.slug}") phải ẩn khỏi public (status hiện tại: ${(await reload(a.id)).status})`);
    }

    const publicSlugs = await databaseProvider.getArticleSlugs();
    const allPublic = await databaseProvider.getAllArticles();
    const draftCategorySlug = (await reload(draft!.id)).category.slug;
    const byCategory = await databaseProvider.getArticlesByCategory(draftCategorySlug);
    for (const a of nonPublicArticles) {
      assert.ok(!publicSlugs.includes(a.slug), `getArticleSlugs() không được liệt kê "${a.slug}"`);
      assert.ok(!allPublic.some((p) => p.slug === a.slug), `getAllArticles() không được trả "${a.slug}"`);
      assert.ok(!byCategory.some((p) => p.slug === a.slug), `getArticlesByCategory() không được trả "${a.slug}"`);
    }
  });

  test("PUBLISHED với publishedAt hợp lệ thì public đầy đủ; PUBLISHED nhưng publishedAt ở tương lai vẫn bị ẩn (phòng thủ)", async () => {
    const article = await makeArticle(contributorA, "Bài xuất bản hợp lệ cho test policy");
    await articleService.submitForReview(contributorA, await reload(article!.id));
    await articleService.approve(manager, await reload(article!.id));
    const published = await articleService.publish(manager, await reload(article!.id));
    assert.equal(published.status, "PUBLISHED");

    const publicArticle = await databaseProvider.getArticleBySlug(article!.slug);
    assert.ok(publicArticle, "bài PUBLISHED với publishedAt quá khứ phải public");
    assert.equal(publicArticle?.status, "published");
    assert.ok((await databaseProvider.getArticleSlugs()).includes(article!.slug));

    // A hand-set future `publishedAt` directly via the repository, bypassing
    // `articleService`'s own workflow rules entirely — the production data
    // policy must catch this on its own even if some future write path
    // forgets to guard against it (brief mục 2's explicit "publishedAt hợp
    // lệ" requirement, not just "status = PUBLISHED").
    await articleRepository.update(article!.id, { publishedAt: new Date(Date.now() + 3600_000) });
    assert.equal(await databaseProvider.getArticleBySlug(article!.slug), null, "PUBLISHED với publishedAt tương lai vẫn phải bị ẩn");
    assert.ok(!(await databaseProvider.getArticleSlugs()).includes(article!.slug));
  });

  test("ARCHIVED (bài đã gỡ) không còn public", async () => {
    const article = await makeArticle(contributorA, "Bài sẽ bị gỡ cho test policy");
    await articleService.submitForReview(contributorA, await reload(article!.id));
    await articleService.approve(manager, await reload(article!.id));
    await articleService.publish(manager, await reload(article!.id));
    assert.ok(await databaseProvider.getArticleBySlug(article!.slug), "phải public ngay sau khi xuất bản");

    await articleService.unpublish(manager, await reload(article!.id));
    assert.equal(await databaseProvider.getArticleBySlug(article!.slug), null, "bài đã gỡ (ARCHIVED) không được public");
  });

  test("searchContent() không lộ bài chưa PUBLISHED", async () => {
    const uniqueTitle = `Chuoi tim kiem doc nhat ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const draft = await makeArticle(contributorA, uniqueTitle);
    const results = await databaseProvider.searchContent(uniqueTitle, 10);
    assert.ok(!results.some((r) => r.id === `article:${draft!.slug}`), "searchContent không được trả bài DRAFT");
  });
});

describe("Preview CMS — 3 role (nhiệm vụ kết nối database, brief mục 8)", () => {
  test("ADMIN và MANAGER xem được preview của bất kỳ bài nào, kể cả DRAFT của một Contributor", async () => {
    const draft = await makeArticle(contributorA, "Bài DRAFT của Contributor A để test preview");
    assert.equal(articleService.canView(admin, draft!), true);
    assert.equal(articleService.canView(manager, draft!), true);
  });

  test("CONTRIBUTOR chỉ xem được preview bài của chính mình, không xem được bài của Contributor khác", async () => {
    const ownDraft = await makeArticle(contributorA, "Bài của Contributor A cho test preview");
    const othersDraft = await makeArticle(contributorB, "Bài của Contributor B cho test preview");
    assert.equal(articleService.canView(contributorA, ownDraft!), true);
    assert.equal(articleService.canView(contributorA, othersDraft!), false);
  });

  test("Quyền preview áp dụng như nhau bất kể trạng thái bài (DRAFT, IN_REVIEW, PUBLISHED, ...)", async () => {
    const article = await makeArticle(contributorA, "Bài nhiều trạng thái cho test preview");
    await articleService.submitForReview(contributorA, await reload(article!.id));
    const inReview = await reload(article!.id);
    // A Contributor can still preview their own submitted (no longer
    // editable, per `assertCanEdit`) article — viewing and editing are
    // different permissions, and `/preview/articles/[id]` only ever checks
    // the former.
    assert.equal(articleService.canView(contributorA, inReview), true);
    assert.equal(articleService.canEdit(contributorA, inReview), false);
    assert.equal(articleService.canView(contributorB, inReview), false);
    assert.equal(articleService.canView(manager, inReview), true);
    assert.equal(articleService.canView(admin, inReview), true);
  });
});

describe("Review Queue /admin/review — chỉ ADMIN/MANAGER (nhiệm vụ workflow biên tập, brief mục 6 & 12)", () => {
  test('route guard dùng permission "article.approve" — đúng ranh giới 2 role, không vô tình cấp cho Contributor', () => {
    assert.equal(hasPermission("ADMIN", "article.approve"), true);
    assert.equal(hasPermission("MANAGER", "article.approve"), true);
    assert.equal(hasPermission("CONTRIBUTOR", "article.approve"), false);
  });

  test("listForAdmin({ statusIn }) trả đúng bài IN_REVIEW + APPROVED, không lẫn DRAFT/PUBLISHED", async () => {
    const draft = await makeArticle(contributorA, "Review queue: DRAFT không được liệt kê");
    const inReview = await makeArticle(contributorA, "Review queue: IN_REVIEW");
    await articleService.submitForReview(contributorA, await reload(inReview!.id));
    const approved = await makeArticle(contributorA, "Review queue: APPROVED");
    await articleService.submitForReview(contributorA, await reload(approved!.id));
    await articleService.approve(manager, await reload(approved!.id));

    const queue = await articleService.listForAdmin(manager, { statusIn: ["IN_REVIEW", "APPROVED"] });
    const ids = queue.map((a) => a.id);
    assert.ok(ids.includes(inReview!.id), "phải chứa bài IN_REVIEW");
    assert.ok(ids.includes(approved!.id), "phải chứa bài APPROVED");
    assert.ok(!ids.includes(draft!.id), "không được chứa bài DRAFT");
  });
});

describe("Notification — thông báo nội bộ theo workflow (nhiệm vụ workflow biên tập, brief mục 9 & 10)", () => {
  test("Gửi duyệt: notify mọi Manager/Admin đang hoạt động, không tự notify Contributor vừa gửi", async () => {
    const article = await makeArticle(contributorA, "Notify khi gửi duyệt");
    await articleService.submitForReview(contributorA, article!);

    const managerNotifs = await notificationService.listForUser(manager, { take: 20 });
    const adminNotifs = await notificationService.listForUser(admin, { take: 20 });
    const contributorNotifs = await notificationService.listForUser(contributorA, { take: 20 });

    assert.ok(managerNotifs.some((n) => n.entityId === article!.id && n.type === "ARTICLE_SUBMITTED"));
    assert.ok(adminNotifs.some((n) => n.entityId === article!.id && n.type === "ARTICLE_SUBMITTED"));
    assert.ok(!contributorNotifs.some((n) => n.entityId === article!.id && n.type === "ARTICLE_SUBMITTED"));
  });

  test("Trả bài: notify đúng Contributor là tác giả, kèm nội dung ghi chú — không lộ cho Contributor khác", async () => {
    const article = await makeArticle(contributorA, "Notify khi bị trả");
    await articleService.submitForReview(contributorA, await reload(article!.id));
    await articleService.returnForRevision(manager, await reload(article!.id), "Thiếu ảnh minh hoạ.");

    const notifs = await notificationService.listForUser(contributorA, { take: 20 });
    const match = notifs.find((n) => n.entityId === article!.id && n.type === "ARTICLE_RETURNED");
    assert.ok(match, "Contributor phải nhận thông báo khi bài bị trả");
    assert.ok(match!.message.includes("Thiếu ảnh minh hoạ."));

    const otherNotifs = await notificationService.listForUser(contributorB, { take: 20 });
    assert.ok(!otherNotifs.some((n) => n.entityId === article!.id));
  });

  test("Duyệt và xuất bản: notify đúng Contributor là tác giả", async () => {
    const article = await makeArticle(contributorA, "Notify khi duyệt và xuất bản");
    await articleService.submitForReview(contributorA, await reload(article!.id));
    await articleService.approve(manager, await reload(article!.id));
    const afterApprove = await notificationService.listForUser(contributorA, { take: 20 });
    assert.ok(afterApprove.some((n) => n.entityId === article!.id && n.type === "ARTICLE_APPROVED"));

    await articleService.publish(admin, await reload(article!.id));
    const afterPublish = await notificationService.listForUser(contributorA, { take: 20 });
    assert.ok(afterPublish.some((n) => n.entityId === article!.id && n.type === "ARTICLE_PUBLISHED"));
  });

  test("markRead chỉ cho phép người nhận đánh dấu thông báo của chính mình", async () => {
    const article = await makeArticle(contributorA, "Notify markRead ownership");
    await articleService.submitForReview(contributorA, await reload(article!.id));
    const target = (await notificationService.listForUser(manager, { take: 20 })).find((n) => n.entityId === article!.id);
    assert.ok(target);

    // Admin (không phải người nhận của thông báo này) cố đánh dấu đã đọc —
    // `notificationRepository.markRead` where theo cả id lẫn userId nên phải
    // là no-op, không throw nhưng cũng không đổi trạng thái của Manager.
    await notificationService.markRead(admin, target!.id);
    const stillUnread = (await notificationService.listForUser(manager, { take: 20 })).find((n) => n.id === target!.id);
    assert.equal(stillUnread?.isRead, false, "markRead của người khác không được phép đổi trạng thái đọc");

    await notificationService.markRead(manager, target!.id);
    const nowRead = (await notificationService.listForUser(manager, { take: 20 })).find((n) => n.id === target!.id);
    assert.equal(nowRead?.isRead, true);
  });
});

describe("Ghi chú nội bộ (ArticleNote) — không public, theo quyền canView (nhiệm vụ workflow biên tập, brief mục 8)", () => {
  test("Contributor ghi chú và xem được ghi chú trên bài của chính mình", async () => {
    const article = await makeArticle(contributorA, "Ghi chú nội bộ trên bài của Contributor A");
    await articleService.addNote(contributorA, article!, "Đã bổ sung số liệu theo yêu cầu.");
    const notes = await articleService.listNotes(contributorA, article!);
    assert.equal(notes.length, 1);
    assert.equal(notes[0].body, "Đã bổ sung số liệu theo yêu cầu.");
    assert.equal(notes[0].authorId, contributorA.id);
  });

  test("Contributor khác không được ghi chú hay xem ghi chú trên bài không phải của mình", async () => {
    const article = await makeArticle(contributorA, "Ghi chú nội bộ — chặn Contributor khác");
    await assert.rejects(() => articleService.addNote(contributorB, article!, "Cố ghi chú trái phép"));
    await assert.rejects(() => articleService.listNotes(contributorB, article!));
  });

  test("Manager/Admin ghi chú được trên bất kỳ bài nào; ghi chú không làm đổi trạng thái workflow", async () => {
    const article = await makeArticle(contributorA, "Ghi chú nội bộ từ Manager/Admin");
    await articleService.addNote(manager, article!, "Kiểm tra lại nguồn trích dẫn.");
    await articleService.addNote(admin, await reload(article!.id), "Đã kiểm tra, ổn.");
    const notes = await articleService.listNotes(contributorA, await reload(article!.id));
    assert.equal(notes.length, 2);
    assert.equal((await reload(article!.id)).status, "DRAFT", "ghi chú nội bộ không được làm đổi trạng thái bài viết");
  });

  test("Ghi chú trống bị từ chối", async () => {
    const article = await makeArticle(contributorA, "Ghi chú nội bộ rỗng bị từ chối");
    await assert.rejects(() => articleService.addNote(contributorA, article!, "   "));
  });
});

describe("Ecosystem integration — Platform (nhiệm vụ tích hợp hệ sinh thái, brief mục 1, 5, 6, 7, 8)", () => {
  test("CONTRIBUTOR không quản lý được platform configuration ở bất kỳ mức nào", async () => {
    const platform = await makePlatform();
    await assert.rejects(() => platformService.update(contributorA, platform, { display: { name: "Hijack" } }));
    await assert.rejects(() => platformService.update(contributorA, platform, { integration: { apiBaseUrl: "https://evil.test" } }));
    await assert.rejects(() => platformService.setEnabled(contributorA, platform, false));
    await assert.rejects(() => platformService.refreshActivity(contributorA, platform));
    await assert.rejects(() =>
      platformService.create(contributorA, {
        slug: `should-not-exist-${Date.now()}`,
        name: "X",
        description: "X",
        url: "https://x.test",
        category: "TRAINING",
        status: "ACTIVE",
        accessLevel: "X",
      }),
    );
    await assert.rejects(() => platformService.remove(contributorA, platform));
  });

  test("MANAGER quản lý được nội dung/hiển thị nhưng không đụng được cấu hình tích hợp kỹ thuật", async () => {
    const platform = await makePlatform();

    const updated = await platformService.update(manager, platform, {
      display: { name: "Tên mới do Manager sửa", status: "MAINTENANCE" },
    });
    assert.equal(updated.name, "Tên mới do Manager sửa");
    assert.equal(updated.status, "MAINTENANCE");

    await assert.rejects(() =>
      platformService.update(manager, platform, { integration: { apiBaseUrl: "https://manager-should-not-set.test" } }),
    );
    await assert.rejects(() => platformService.create(manager, { slug: "x", name: "X", description: "X", url: "https://x.test", category: "TRAINING", status: "ACTIVE", accessLevel: "X" }));
    await assert.rejects(() => platformService.remove(manager, platform));
  });

  test("ADMIN toàn quyền: sửa cả nội dung/hiển thị lẫn tích hợp kỹ thuật, tạo và xoá được", async () => {
    const platform = await makePlatform();

    const updated = await platformService.update(admin, platform, {
      display: { name: "Tên do Admin sửa" },
      integration: { apiBaseUrl: "https://admin-can-set.test", integrationType: "API" },
    });
    assert.equal(updated.name, "Tên do Admin sửa");
    assert.equal(updated.apiBaseUrl, "https://admin-can-set.test");
    assert.equal(updated.integrationType, "API");

    const created = await platformService.create(admin, {
      slug: `test-authz-created-platform-${Date.now()}`,
      name: "Nền tảng do Admin tạo",
      description: "X",
      url: "https://x.test",
      category: "VOLUNTEER",
      status: "OPEN",
      accessLevel: "X",
    });
    testPlatformIds.push(created.id);
    assert.equal(created.name, "Nền tảng do Admin tạo");

    await platformService.remove(admin, created);
    testPlatformIds.splice(testPlatformIds.indexOf(created.id), 1);
  });

  test("ENABLE_PLATFORM/DISABLE_PLATFORM: MANAGER bật/tắt được (display state), ghi audit đúng action", async () => {
    const platform = await makePlatform({ isEnabled: true } as never);
    const disabled = await platformService.setEnabled(manager, platform, false);
    assert.equal(disabled.isEnabled, false);
    const enabled = await platformService.setEnabled(manager, disabled, true);
    assert.equal(enabled.isEnabled, true);

    const logs = await prisma.auditLog.findMany({ where: { entityType: "Platform", entityId: platform.id }, orderBy: { createdAt: "asc" } });
    assert.ok(logs.some((l) => l.action === "DISABLE_PLATFORM"));
    assert.ok(logs.some((l) => l.action === "ENABLE_PLATFORM"));
  });

  test("refreshActivity: thành công thì cập nhật currentActivity + ghi audit UPDATE_PLATFORM", async () => {
    const platform = await makePlatform({ integrationType: "API", apiBaseUrl: "https://mock-training.test" } as never);
    mockAdapterResult = { ok: true, currentActivity: "12 khoá đang mở (mock)" };

    const result = await platformService.refreshActivity(manager, platform);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.currentActivity, "12 khoá đang mở (mock)");

    const reloaded = await platformRepository.findById(platform.id);
    assert.equal(reloaded?.currentActivity, "12 khoá đang mở (mock)");
    assert.ok(reloaded?.currentActivityUpdatedAt);

    const logs = await prisma.auditLog.findMany({ where: { entityType: "Platform", entityId: platform.id, action: "UPDATE_PLATFORM" } });
    assert.ok(logs.some((l) => (l.metadata as { source?: string } | null)?.source === "adapter-refresh"));
  });

  test("refreshActivity: brief mục 6 — timeout/lỗi mạng không xoá currentActivity cũ, portal vẫn có dữ liệu cached", async () => {
    const platform = await makePlatform({
      integrationType: "API",
      apiBaseUrl: "https://mock-training-down.test",
      currentActivity: "Dữ liệu cũ trước khi lỗi",
    } as never);

    mockAdapterResult = { ok: false, reason: "timeout", message: "Không nhận được phản hồi sau 5000ms." };
    const result = await platformService.refreshActivity(manager, platform);
    assert.equal(result.ok, false);

    const reloaded = await platformRepository.findById(platform.id);
    assert.equal(reloaded?.currentActivity, "Dữ liệu cũ trước khi lỗi", "currentActivity phải giữ nguyên giá trị cũ khi adapter lỗi");
  });

  test("refreshActivity: từ chối khi integrationType không phải API, hoặc danh mục chưa có adapter (DATA) — không hề gọi adapter", async () => {
    const callsBefore = mockAdapterCallCount;

    const externalLinkPlatform = await makePlatform({ integrationType: "EXTERNAL_LINK" } as never);
    const externalResult = await platformService.refreshActivity(admin, externalLinkPlatform);
    assert.equal(externalResult.ok, false);

    const dataPlatform = await makePlatform({ category: "DATA", integrationType: "API", apiBaseUrl: "https://mock-data.test" } as never);
    const dataResult = await platformService.refreshActivity(admin, dataPlatform);
    assert.equal(dataResult.ok, false, "DATA không có adapter (brief mục 5: chỉ 4 adapter được liệt kê)");

    assert.equal(mockAdapterCallCount, callsBefore, "cả hai trường hợp phải bị chặn trước khi gọi tới adapter");
  });

  test("Homepage vẫn hoạt động khi một platform bị tắt: DatabaseProvider không trả platform đã isEnabled=false", async () => {
    const platform = await makePlatform({ category: "SV5TOT", isEnabled: false } as never);
    const enabledOnly = await platformRepository.listEnabled();
    assert.ok(!enabledOnly.some((p) => p.id === platform.id), "platform bị tắt không được xuất hiện trong danh sách công khai");
  });
});
