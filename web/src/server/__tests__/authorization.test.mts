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

const { hasPermission, PERMISSIONS, ROLE_LABELS, ASSIGNABLE_ROLES } = await import("@/server/auth/permissions");
const { prisma } = await import("@/server/db/client");
const { articleService } = await import("@/server/services/articleService");
const { userService } = await import("@/server/services/userService");
const { mediaService, MediaInUseError } = await import("@/server/services/mediaService");
const { hashPassword } = await import("@/server/auth/password");

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
const testAuthorProfileIds: string[] = [];
const testMediaIds: string[] = [];
const testGalleryIds: string[] = [];
const testVideoIds: string[] = [];

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
  return article;
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
  await prisma.auditLog.deleteMany({ where: { actorId: { in: testUserIds } } });
  await prisma.articleSlugHistory.deleteMany({ where: { articleId: { in: testArticleIds } } });
  // Articles first — this clears any Article.coverMediaId/ogMediaId FK
  // pointing at a test MediaAsset before that asset is deleted below.
  await prisma.article.deleteMany({ where: { id: { in: testArticleIds } } });
  // Gallery (cascades its GalleryItem rows) and Video both hold a *required*
  // FK to MediaAsset — deleted before the assets themselves, same reasoning.
  await prisma.gallery.deleteMany({ where: { id: { in: testGalleryIds } } });
  await prisma.video.deleteMany({ where: { id: { in: testVideoIds } } });
  await prisma.mediaAsset.deleteMany({ where: { id: { in: testMediaIds } } });
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

  test("registerManualLink: chỉ Admin/Manager liên kết ảnh thủ công; liên kết video vẫn mở cho Contributor", async () => {
    await assert.rejects(() =>
      mediaService.registerManualLink(contributorA, { provider: "GOOGLE_DRIVE", type: "IMAGE", providerFileId: "manual-1" }),
    );
    const manualImage = await mediaService.registerManualLink(manager, { provider: "GOOGLE_DRIVE", type: "IMAGE", providerFileId: "manual-2" });
    testMediaIds.push(manualImage.id);
    assert.equal(manualImage.status, "READY");

    const manualVideo = await mediaService.registerManualLink(contributorA, { provider: "YOUTUBE", type: "VIDEO", providerFileId: "yt-1" });
    testMediaIds.push(manualVideo.id);
    assert.equal(manualVideo.provider, "YOUTUBE");
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
