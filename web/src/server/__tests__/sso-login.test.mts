/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- test doubles: loosely-typed fakes of hsv-id and the repositories */
import { test, describe, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

/**
 * SSO login + session mapping (docs/AUTHENTICATION.md, "SSO (hsv-id)").
 * Pure unit tests: `hsv-id`, the repositories and Next's request scope are
 * mocked, so no database or network is needed (unlike authorization.test.mts,
 * which uses the dev database). The security-relevant rules under test:
 *  - an unlinked local account (say ADMIN) is NEVER linked to an hsv-id account
 *    just because the e-mail matches — only with proof (its local password);
 *  - a refused login revokes only the session it just opened;
 *  - disabling a CMS account blocks it on the very next request;
 *  - wrong password / disabled / locked all return the one generic message.
 */

type Row = {
  id: string;
  email: string;
  username: string | null;
  displayName: string;
  role: "ADMIN" | "MANAGER" | "CONTRIBUTOR";
  status: "ACTIVE" | "DISABLED";
  identityUserId: string | null;
  passwordHash: string;
  lastLoginAt: Date | null;
};

const { hashPassword } = await import("@/server/auth/password");

// ---- controllable fakes -------------------------------------------------------------------------------------------------------------
const cookieJar = new Map<string, string>();
const db = { users: [] as Row[], audit: [] as unknown[], updates: [] as { id: string; data: Record<string, unknown> }[], created: [] as Row[] };
const hsv = {
  login: async (_i: unknown): Promise<any> => ({ ok: false, error: "INVALID_CREDENTIALS", message: "" }),
  validate: async (_t: string): Promise<any> => ({ ok: false, reason: "INVALID" }),
  calls: [] as string[],
  createUser: async (_i: unknown): Promise<string | null> => null,
  verifyAndGet: async (_a: string, _b: string): Promise<any> => null,
  link: async (_a: string, _b: string): Promise<boolean> => true,
  // Admin role grant (userService.lookupIdentity / grantRole)
  lookup: async (_identifier: string): Promise<any> => ({ ok: false, reason: "NOT_FOUND" }),
  getUser: async (_id: string): Promise<any> => ({ ok: false, reason: "NOT_FOUND" }),
  profile: async (_id: string): Promise<any> => null,
};

mock.module("next/headers", {
  namedExports: {
    cookies: async () => ({
      get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
      set: (name: string, value: string) => {
        if (value === "") cookieJar.delete(name);
        else cookieJar.set(name, value);
      },
      delete: (name: string) => cookieJar.delete(name),
    }),
    headers: async () => new Headers(),
  },
});
mock.module("next/navigation", {
  namedExports: {
    redirect: (to: string) => {
      throw new Error(`REDIRECT:${to}`);
    },
  },
});
mock.module("@/server/integrations/hsvId", {
  namedExports: {
    hsvIdSsoLogin: (i: unknown) => {
      hsv.calls.push("login");
      return hsv.login(i);
    },
    hsvIdSsoValidate: (t: string) => {
      hsv.calls.push("validate");
      return hsv.validate(t);
    },
    hsvIdSsoLogout: async (t: string) => {
      hsv.calls.push(`logout:${t}`);
      return true;
    },
    hsvIdSsoLogoutAll: async (t: unknown) => {
      hsv.calls.push(`logoutAll:${JSON.stringify(t)}`);
      return true;
    },
    hsvIdCreateUser: (i: unknown) => {
      hsv.calls.push("createUser");
      return hsv.createUser(i);
    },
    hsvIdVerifyAndGetUser: (a: string, b: string) => hsv.verifyAndGet(a, b),
    hsvIdLink: (a: string, b: string) => {
      hsv.calls.push(`link:${a}:${b}`);
      return hsv.link(a, b);
    },
    hsvIdChangePassword: async () => true,
    hsvIdConfigured: () => true,
    hsvIdLookupByIdentifier: (i: string) => hsv.lookup(i),
    hsvIdGetUser: (id: string) => hsv.getUser(id),
    hsvIdGetProfile: (id: string) => hsv.profile(id),
  },
});
mock.module("@/server/repositories/userRepository", {
  namedExports: {
    userRepository: {
      findByIdentityUserId: async (id: string) => db.users.find((u) => u.identityUserId === id) ?? null,
      findByEmailInsensitive: async (email: string) => db.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null,
      findByEmailOrUsernameWithHash: async (identifier: string) => db.users.find((u) => u.email === identifier || u.username === identifier) ?? null,
      findIdentitySyncFields: async (id: string) => db.users.find((u) => u.id === id) ?? null,
      setIdentityUserId: async (id: string, identityUserId: string) => {
        const u = db.users.find((x) => x.id === id)!;
        u.identityUserId = identityUserId;
        return u;
      },
      update: async (id: string, data: Record<string, unknown>) => {
        db.updates.push({ id, data });
        Object.assign(db.users.find((x) => x.id === id)!, data);
        return db.users.find((x) => x.id === id)!;
      },
      touchLastLogin: async (id: string) => {
        db.users.find((x) => x.id === id)!.lastLoginAt = new Date();
      },
      createFromIdentity: async ({ createdById: _by, ...i }: { email: string; displayName: string; identityUserId: string; role: Row["role"]; createdById: string }) => {
        const row: Row = { id: `local-${db.users.length + 1}`, username: null, status: "ACTIVE", passwordHash: "x", lastLoginAt: null, ...i };
        db.users.push(row);
        db.created.push(row);
        return row;
      },
      create: async (data: any) => {
        const row: Row = { id: `local-${db.users.length + 1}`, username: null, status: "ACTIVE", identityUserId: null, lastLoginAt: null, ...data };
        db.users.push(row);
        db.created.push(row);
        return row;
      },
    },
  },
});
mock.module("@/server/repositories/auditLogRepository", {
  namedExports: { auditLogRepository: { record: async (e: unknown) => void db.audit.push(e) } },
});

const { getSession, requireSession, SSO_COOKIE, destroySession } = await import("@/server/auth/session");
const { authService } = await import("@/server/services/authService");
const { userService, GrantRoleError } = await import("@/server/services/userService");

// ---- fixtures ----------------------------------------------------------------------------------------------------------------------
const COMPLETE = { complete: true, missing: [] };
const idUser = (over: Record<string, unknown> = {}) => ({ id: "hsv-1", email: "an@example.vn", phone: null, fullName: "Nguyen An", status: "ACTIVE", ...over });
const okLogin = (over: Record<string, unknown> = {}) => ({ ok: true, token: "tok-1", expiresAt: new Date(Date.now() + 3600_000).toISOString(), user: idUser(over), completeness: COMPLETE });

async function localRow(over: Partial<Row> = {}, password = "LocalPass#1"): Promise<Row> {
  const row: Row = {
    id: `u${db.users.length + 1}`,
    email: "an@example.vn",
    username: null,
    displayName: "Nguyen An",
    role: "MANAGER",
    status: "ACTIVE",
    identityUserId: "hsv-1",
    passwordHash: await hashPassword(password),
    lastLoginAt: null,
    ...over,
  };
  db.users.push(row);
  return row;
}

beforeEach(() => {
  cookieJar.clear();
  db.users.length = 0;
  db.audit.length = 0;
  db.updates.length = 0;
  db.created.length = 0;
  hsv.calls.length = 0;
  hsv.login = async () => ({ ok: false, error: "INVALID_CREDENTIALS", message: "" });
  hsv.validate = async () => ({ ok: false, reason: "INVALID" });
  hsv.createUser = async () => null;
  hsv.verifyAndGet = async () => null;
  hsv.link = async () => true;
  hsv.lookup = async () => ({ ok: false, reason: "NOT_FOUND" });
  hsv.getUser = async () => ({ ok: false, reason: "NOT_FOUND" });
  hsv.profile = async () => null;
  // The 30 s validation cache lives on globalThis: reset it so cases don't leak into each other.
  (globalThis as any).__cmsSsoValidationCache?.clear();
});

describe("getSession (cookie -> hsv-id -> local user)", () => {
  test("no cookie: null and hsv-id is never called", async () => {
    assert.equal(await getSession(), null);
    assert.deepEqual(hsv.calls, []);
  });

  test("valid session + linked ACTIVE account: returns the LOCAL role", async () => {
    await localRow({ role: "MANAGER" });
    cookieJar.set(SSO_COOKIE, "tok-1");
    hsv.validate = async () => ({ ok: true, user: idUser(), completeness: COMPLETE, expiresAt: "" });
    const session = await getSession();
    assert.equal(session?.role, "MANAGER");
    assert.equal(session?.email, "an@example.vn");
  });

  test("session revoked at hsv-id (logged out elsewhere): null", async () => {
    await localRow();
    cookieJar.set(SSO_COOKIE, "tok-1");
    hsv.validate = async () => ({ ok: false, reason: "INVALID" });
    assert.equal(await getSession(), null);
  });

  test("hsv-id unreachable: null (signed-out), never a stale grant", async () => {
    await localRow();
    cookieJar.set(SSO_COOKIE, "tok-1");
    hsv.validate = async () => ({ ok: false, reason: "UNAVAILABLE" });
    assert.equal(await getSession(), null);
  });

  test("local account DISABLED: blocked immediately even with a valid, cached SSO session", async () => {
    const row = await localRow();
    cookieJar.set(SSO_COOKIE, "tok-1");
    hsv.validate = async () => ({ ok: true, user: idUser(), completeness: COMPLETE, expiresAt: "" });
    assert.ok(await getSession());
    row.status = "DISABLED"; // the validation is cached (30 s) — the local status must not be
    assert.equal(await getSession(), null);
    assert.equal(hsv.calls.filter((c) => c === "validate").length, 1, "second call must come from the 30 s cache");
  });

  test("SECURITY: unlinked local ADMIN with the same e-mail is NOT linked by a bare cookie", async () => {
    const admin = await localRow({ role: "ADMIN", identityUserId: null });
    cookieJar.set(SSO_COOKIE, "stranger");
    hsv.validate = async () => ({ ok: true, user: idUser({ id: "hsv-STRANGER" }), completeness: COMPLETE, expiresAt: "" });
    assert.equal(await getSession(), null);
    assert.equal(admin.identityUserId, null, "must stay unlinked");
    assert.equal(db.updates.length, 0);
  });

  test("display name follows the shared profile", async () => {
    await localRow({ displayName: "Old Name" });
    cookieJar.set(SSO_COOKIE, "tok-1");
    hsv.validate = async () => ({ ok: true, user: idUser({ fullName: "Nguyen An (moi)" }), completeness: COMPLETE, expiresAt: "" });
    const session = await getSession();
    assert.equal(session?.displayName, "Nguyen An (moi)");
    await new Promise((r) => setImmediate(r));
    assert.equal(db.users[0].displayName, "Nguyen An (moi)");
  });
});

describe("requireSession", () => {
  // Editorial sign-in lives on the shared page's "Ban biên tập" tab (docs/AUTHENTICATION.md, "Hai luồng đăng nhập").
  const LOGIN = /REDIRECT:\/dang-nhap\?luong=bien-tap/;

  test("signed-out: redirects to the editorial sign-in", async () => {
    await assert.rejects(requireSession(), LOGIN);
  });

  test("linked, active CMS account: let through with its LOCAL role", async () => {
    await localRow({ role: "ADMIN" });
    cookieJar.set(SSO_COOKIE, "tok-1");
    hsv.validate = async () => ({ ok: true, user: idUser(), completeness: COMPLETE, expiresAt: "" });
    const session = await requireSession();
    assert.equal(session.role, "ADMIN");
  });

  test("personal account (SSO session, no CMS account): NOT provisioned by opening /admin -> editorial sign-in", async () => {
    cookieJar.set(SSO_COOKIE, "tok-1");
    hsv.validate = async () => ({ ok: true, user: idUser(), completeness: COMPLETE, expiresAt: "" });
    await assert.rejects(requireSession(), LOGIN);
    assert.equal(db.created.length, 0);
  });

  test("signed in at hsv-id, e-mail belongs to an unlinked local account: no provisioning, no link -> login page", async () => {
    await localRow({ role: "ADMIN", identityUserId: null });
    cookieJar.set(SSO_COOKIE, "stranger");
    hsv.validate = async () => ({ ok: true, user: idUser({ id: "hsv-STRANGER" }), completeness: COMPLETE, expiresAt: "" });
    await assert.rejects(requireSession(), LOGIN);
    assert.equal(db.created.length, 0);
  });

  test("disabled account does not get re-provisioned or through", async () => {
    await localRow({ status: "DISABLED" });
    cookieJar.set(SSO_COOKIE, "tok-1");
    hsv.validate = async () => ({ ok: true, user: idUser(), completeness: COMPLETE, expiresAt: "" });
    await assert.rejects(requireSession(), LOGIN);
    assert.equal(db.created.length, 0);
  });
});

describe("authService.personalLogin", () => {
  const GENERIC = "Thông tin đăng nhập không chính xác.";
  let ipCounter = 0;
  const personalLogin = (identifier: string, password: string) => authService.personalLogin(identifier, password, `10.1.0.${++ipCounter}`);

  test("any HSV-ID account: sets the shared SSO cookie, creates NO local CMS account", async () => {
    hsv.login = async () => okLogin();
    assert.deepEqual(await personalLogin("an@example.vn", "pw"), { ok: true });
    assert.equal(cookieJar.get(SSO_COOKIE), "tok-1");
    assert.equal(db.created.length, 0);
    assert.equal(db.users.length, 0);
  });

  test("an editor signing in on the personal tab keeps their CMS role (getSession finds the linked row)", async () => {
    await localRow({ role: "MANAGER" });
    hsv.login = async () => okLogin();
    hsv.validate = async () => ({ ok: true, user: idUser(), completeness: COMPLETE, expiresAt: "" });
    assert.deepEqual(await personalLogin("an@example.vn", "pw"), { ok: true });
    assert.equal((await getSession())?.role, "MANAGER");
  });

  test("wrong password / locked: the one generic error, no cookie", async () => {
    hsv.login = async () => ({ ok: false, error: "INVALID_CREDENTIALS", message: "" });
    assert.deepEqual(await personalLogin("an@example.vn", "bad"), { ok: false, error: GENERIC });
    hsv.login = async () => ({ ok: false, error: "BLOCKED", message: "" });
    assert.deepEqual(await personalLogin("an@example.vn", "pw"), { ok: false, error: GENERIC });
    assert.equal(cookieJar.has(SSO_COOKIE), false);
  });

  test("hsv-id down: says so, no cookie", async () => {
    hsv.login = async () => ({ ok: false, error: "UNAVAILABLE", message: "" });
    const result = await personalLogin("an@example.vn", "pw");
    assert.equal(result.ok, false);
    assert.match((result as { error: string }).error, /gián đoạn/);
    assert.equal(cookieJar.has(SSO_COOKIE), false);
  });
});

describe("authService.login", () => {
  const GENERIC = "Thông tin đăng nhập không chính xác.";
  let ipCounter = 0;
  const login = (identifier: string, password: string) => authService.login(identifier, password, `10.0.0.${++ipCounter}`);

  test("correct credentials + linked account: sets the SSO cookie, audits, touches lastLogin", async () => {
    await localRow();
    hsv.login = async () => okLogin();
    assert.deepEqual(await login("an@example.vn", "pw"), { ok: true });
    assert.equal(cookieJar.get(SSO_COOKIE), "tok-1");
    assert.ok(db.users[0].lastLoginAt);
    assert.equal(db.audit.length, 1);
  });

  test("wrong password: generic error, no cookie", async () => {
    await localRow();
    assert.deepEqual(await login("an@example.vn", "bad"), { ok: false, error: GENERIC });
    assert.equal(cookieJar.size, 0);
  });

  test("locked at hsv-id: the SAME generic error (no enumeration)", async () => {
    await localRow();
    hsv.login = async () => ({ ok: false, error: "BLOCKED", message: "" });
    assert.deepEqual(await login("an@example.vn", "pw"), { ok: false, error: GENERIC });
  });

  test("hsv-id down: says so (reveals nothing about the account) and does not count as a failed attempt", async () => {
    await localRow();
    hsv.login = async () => ({ ok: false, error: "UNAVAILABLE", message: "" });
    const result = await login("an@example.vn", "pw");
    assert.equal(result.ok, false);
    assert.notEqual((result as any).error, GENERIC);
  });

  test("local account DISABLED: generic error, and ONLY the session just opened is revoked", async () => {
    await localRow({ status: "DISABLED" });
    hsv.login = async () => okLogin();
    assert.deepEqual(await login("an@example.vn", "pw"), { ok: false, error: GENERIC });
    assert.equal(cookieJar.size, 0);
    assert.ok(hsv.calls.includes("logout:tok-1"));
    assert.ok(!hsv.calls.some((c) => c.startsWith("logoutAll")), "must not sign the person out of other platforms");
  });

  test("username login is resolved to the account's e-mail before asking hsv-id", async () => {
    await localRow({ username: "an.nguyen" });
    let asked = "";
    hsv.login = async (i: any) => {
      asked = i.identifier;
      return okLogin();
    };
    assert.deepEqual(await login("an.nguyen", "pw"), { ok: true });
    assert.equal(asked, "an@example.vn");
  });

  test("SECURITY: hsv-id accepts a stranger's password for an unlinked ADMIN's e-mail -> refused, not linked", async () => {
    const admin = await localRow({ role: "ADMIN", identityUserId: null }, "RealAdminPass#1");
    hsv.login = async () => okLogin({ id: "hsv-STRANGER" });
    assert.deepEqual(await login("an@example.vn", "stranger-password"), { ok: false, error: GENERIC });
    assert.equal(admin.identityUserId, null);
    assert.equal(cookieJar.size, 0);
    assert.ok(hsv.calls.includes("logout:tok-1"));
  });

  test("unlinked local account + local password proves ownership: linked and signed in", async () => {
    const row = await localRow({ identityUserId: null }, "SamePass#1");
    hsv.login = async () => okLogin({ id: "hsv-9" });
    assert.deepEqual(await login("an@example.vn", "SamePass#1"), { ok: true });
    assert.equal(row.identityUserId, "hsv-9");
  });

  test("e-mail already linked to a DIFFERENT hsv-id account: refused (conflict)", async () => {
    await localRow({ identityUserId: "hsv-OTHER" });
    hsv.login = async () => okLogin({ id: "hsv-1" });
    assert.deepEqual(await login("an@example.vn", "pw"), { ok: false, error: GENERIC });
  });

  test("valid HSV-ID account with NO CMS role: refused with the 'not granted' message, nothing created, only that session revoked", async () => {
    hsv.login = async () => okLogin();
    const result = await login("an@example.vn", "pw");
    assert.equal(result.ok, false);
    assert.match((result as { error: string }).error, /chưa được cấp quyền Ban biên tập/);
    assert.equal(db.created.length, 0);
    assert.equal(cookieJar.has(SSO_COOKIE), false);
    assert.ok(hsv.calls.includes("logout:tok-1"));
    assert.ok(!hsv.calls.some((c) => c.startsWith("logoutAll")));
  });

  test("legacy account (never synced) with the right LOCAL password: created + linked in hsv-id, then signed in", async () => {
    const row = await localRow({ identityUserId: null }, "LegacyPass#1");
    let attempt = 0;
    hsv.login = async () => (++attempt === 1 ? { ok: false, error: "INVALID_CREDENTIALS", message: "" } : okLogin({ id: "hsv-NEW" }));
    hsv.createUser = async () => "hsv-NEW";
    assert.deepEqual(await login("an@example.vn", "LegacyPass#1"), { ok: true });
    assert.equal(row.identityUserId, "hsv-NEW");
    assert.equal(attempt, 2);
  });

  test("legacy account with a WRONG local password: nothing is created in hsv-id", async () => {
    await localRow({ identityUserId: null }, "LegacyPass#1");
    assert.deepEqual(await login("an@example.vn", "guess"), { ok: false, error: GENERIC });
    assert.ok(!hsv.calls.includes("createUser"));
  });

  test("legacy account whose e-mail already exists in hsv-id under another password: not linked, generic error", async () => {
    const row = await localRow({ identityUserId: null }, "LegacyPass#1");
    hsv.createUser = async () => null; // 409
    hsv.verifyAndGet = async () => null; // the local password does not open the hsv-id account
    assert.deepEqual(await login("an@example.vn", "LegacyPass#1"), { ok: false, error: GENERIC });
    assert.equal(row.identityUserId, null);
  });

  test("rate limit: too many wrong attempts for one identifier+IP -> blocked with the distinct message", async () => {
    await localRow();
    let last: any;
    for (let i = 0; i < 7; i++) last = await authService.login("victim@example.vn", "bad", "9.9.9.9");
    assert.equal(last.ok, false);
    assert.match(last.error, /quá nhiều lần/);
  });
});

describe("logout", () => {
  test("signs out of EVERY platform (logout-all) and clears the cookie", async () => {
    await localRow();
    cookieJar.set(SSO_COOKIE, "tok-1");
    await destroySession();
    assert.ok(hsv.calls.includes('logoutAll:{"token":"tok-1"}'));
    assert.equal(cookieJar.has(SSO_COOKIE), false);
  });
});

describe("userService.grantRole / lookupIdentity (Admin is the only way to a CMS role)", () => {
  const ADMIN = { id: "admin-1", email: "admin@x.vn", displayName: "Admin", role: "ADMIN" as const, status: "ACTIVE" as const };
  const MANAGER = { ...ADMIN, id: "mgr-1", role: "MANAGER" as const };
  const hsvUser = (over: Record<string, unknown> = {}) => ({ id: "hsv-9", email: "binh@example.vn", phone: "0912345678", fullName: "Tran Binh", status: "ACTIVE", ...over });

  test("only an ADMIN may look up or grant", async () => {
    await assert.rejects(userService.lookupIdentity(MANAGER, "binh@example.vn"));
    await assert.rejects(userService.grantRole(MANAGER, "hsv-9", "CONTRIBUTOR"));
  });

  test("lookup: exact e-mail -> preview with masked phone and the unit, grantable", async () => {
    hsv.lookup = async () => ({ ok: true, user: hsvUser() });
    hsv.profile = async () => ({ fullName: "Tran Binh", phone: "0912345678", organization: { name: "DH Bach khoa" }, organizationOther: null, locality: { name: "Ha Noi" }, membership: { isMember: true } });
    const p = await userService.lookupIdentity(ADMIN, "binh@example.vn");
    assert.equal(p?.hsvId, "hsv-9");
    assert.equal(p?.organizationName, "DH Bach khoa");
    assert.equal(p?.phoneMasked?.includes("345"), false);
    assert.equal(p?.blocker, null);
    assert.equal(p?.existing, null);
  });

  test("lookup: no such account -> null; hsv-id down -> a clear error", async () => {
    assert.equal(await userService.lookupIdentity(ADMIN, "nobody@example.vn"), null);
    hsv.lookup = async () => ({ ok: false, reason: "UNAVAILABLE" });
    await assert.rejects(userService.lookupIdentity(ADMIN, "binh@example.vn"), GrantRoleError);
  });

  test("grant: creates a linked row with the chosen role from hsv-id's data (not the browser's), audits, links", async () => {
    hsv.getUser = async () => ({ ok: true, user: hsvUser({ email: "Binh@Example.vn" }) });
    const user = await userService.grantRole(ADMIN, "hsv-9", "MANAGER");
    assert.equal(user.role, "MANAGER");
    assert.equal(db.created[0]?.identityUserId, "hsv-9");
    assert.equal(db.created[0]?.email, "binh@example.vn");
    assert.ok(hsv.calls.includes(`link:hsv-9:${user.id}`));
    assert.deepEqual((db.audit[0] as any).metadata, { via: "admin-grant", role: "MANAGER", identityUserId: "hsv-9" });
  });

  test("grant refused: already a CMS user / locked / phone-only / e-mail held by an unlinked legacy row", async () => {
    hsv.getUser = async () => ({ ok: true, user: hsvUser() });
    await localRow({ identityUserId: "hsv-9", email: "binh@example.vn" });
    await assert.rejects(userService.grantRole(ADMIN, "hsv-9", "CONTRIBUTOR"), /đã có quyền/);
    db.users.length = 0;

    hsv.getUser = async () => ({ ok: true, user: hsvUser({ status: "LOCKED" }) });
    await assert.rejects(userService.grantRole(ADMIN, "hsv-9", "CONTRIBUTOR"), /khoá/);

    hsv.getUser = async () => ({ ok: true, user: hsvUser({ email: null }) });
    await assert.rejects(userService.grantRole(ADMIN, "hsv-9", "CONTRIBUTOR"), /email/);

    hsv.getUser = async () => ({ ok: true, user: hsvUser() });
    await localRow({ role: "ADMIN", identityUserId: null, email: "binh@example.vn" });
    await assert.rejects(userService.grantRole(ADMIN, "hsv-9", "CONTRIBUTOR"), /chưa liên kết/);
    assert.equal(db.created.length, 0);
  });

  test("create (with password) refuses an e-mail that already has an HSV-ID account", async () => {
    hsv.lookup = async () => ({ ok: true, user: hsvUser() });
    await assert.rejects(
      userService.create(ADMIN, { email: "binh@example.vn", displayName: "Binh", role: "CONTRIBUTOR", password: "Temp#12345" }),
      /đã có tài khoản HSV-ID/,
    );
    assert.equal(db.created.length, 0);
  });
});
