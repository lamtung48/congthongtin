import "dotenv/config";
import { test, describe, before, after, mock } from "node:test";
import assert from "node:assert/strict";

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

const { hasPermission, PERMISSIONS, ROLE_LABELS, ASSIGNABLE_ROLES } = await import("@/server/auth/permissions");
const { prisma } = await import("@/server/db/client");
const { articleService } = await import("@/server/services/articleService");
const { userService } = await import("@/server/services/userService");
const { hashPassword } = await import("@/server/auth/password");

type Actor = { id: string; email: string; displayName: string; role: "ADMIN" | "MANAGER" | "CONTRIBUTOR"; status: "ACTIVE" | "DISABLED" };

let categoryId: string;
let admin: Actor;
let manager: Actor;
let contributorA: Actor;
let contributorB: Actor;
const testUserIds: string[] = [];
const testArticleIds: string[] = [];

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

async function makeArticle(actor: Actor, title: string) {
  const article = await articleService.create(actor, {
    data: { slug: `test-authz-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title, category: { connect: { id: categoryId } } },
    blocks: [],
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
});

after(async () => {
  await prisma.auditLog.deleteMany({ where: { actorId: { in: testUserIds } } });
  await prisma.article.deleteMany({ where: { id: { in: testArticleIds } } });
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
      articleService.update(contributorA, articleOfB!, { data: { title: "Hijacked" } }),
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
