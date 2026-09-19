import { randomBytes } from "node:crypto";
import { prisma } from "@/server/db/client";
import { hashPassword } from "@/server/auth/password";
import type { AdminRole, Prisma, UserStatus } from "@/generated/prisma/client";

const publicUserSelect = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  role: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  createdById: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

/**
 * `passwordHash` never appears in `publicUserSelect` — every read path in
 * this repository (and everything above it) gets a `PublicUser`, the same
 * Data Transfer Object discipline Next's own auth guide recommends
 * ("Using Data Transfer Objects (DTO)"). Only `findByEmailOrUsernameWithHash`
 * (used exactly once, by the login check) ever touches the hash column.
 */
export const userRepository = {
  findByEmailOrUsernameWithHash(identifier: string) {
    return prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { username: identifier }] },
    });
  },

  /** Just the fields the shared-identity (`hsv-id`) sync needs — used by
   *  the login lazy-sync and the Admin password-reset path. `identityUserId`
   *  is deliberately kept out of `publicUserSelect` (it has no place in any
   *  list/detail view). */
  findIdentitySyncFields(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, displayName: true, identityUserId: true },
    });
  },

  setIdentityUserId(id: string, identityUserId: string) {
    return prisma.user.update({ where: { id }, data: { identityUserId } });
  },

  findByIdentityUserId(identityUserId: string) {
    return prisma.user.findUnique({ where: { identityUserId } });
  },

  /** Case-insensitive: `hsv-id` normalises emails to lower case, this CMS historically did not. */
  findByEmailInsensitive(email: string) {
    return prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  },

  /** Auto-provision path (`authService.login`): a person who authenticates
   *  against `hsv-id` but has no CMS account gets a CONTRIBUTOR row linked
   *  to their `hsv-id` id. There is no local password — `hsv-id` is the
   *  only credential authority for these accounts — so `passwordHash` is a
   *  throwaway random value that can never verify anything (if `hsv-id` is
   *  ever unreachable, such an account simply can't sign in until it's
   *  back; documented in docs/AUTHENTICATION.md). */
  async createFromIdentityAsContributor(input: { email: string; displayName: string; identityUserId: string }): Promise<PublicUser> {
    const passwordHash = await hashPassword(`hsv-id:${randomBytes(24).toString("hex")}`);
    return prisma.user.create({
      data: {
        email: input.email,
        displayName: input.displayName,
        role: "CONTRIBUTOR",
        status: "ACTIVE",
        identityUserId: input.identityUserId,
        passwordHash,
      },
      select: publicUserSelect,
    });
  },

  findById(id: string): Promise<PublicUser | null> {
    return prisma.user.findUnique({ where: { id }, select: publicUserSelect });
  },

  list(params: { search?: string; role?: AdminRole; status?: UserStatus; skip?: number; take?: number }) {
    const where: Prisma.UserWhereInput = {
      role: params.role,
      status: params.status,
      ...(params.search
        ? {
            OR: [
              { displayName: { contains: params.search, mode: "insensitive" } },
              { email: { contains: params.search, mode: "insensitive" } },
              { username: { contains: params.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    return prisma.user.findMany({
      where,
      select: publicUserSelect,
      orderBy: { createdAt: "desc" },
      skip: params.skip,
      take: params.take,
    });
  },

  count(params: { search?: string; role?: AdminRole; status?: UserStatus }) {
    const where: Prisma.UserWhereInput = {
      role: params.role,
      status: params.status,
      ...(params.search
        ? {
            OR: [
              { displayName: { contains: params.search, mode: "insensitive" } },
              { email: { contains: params.search, mode: "insensitive" } },
              { username: { contains: params.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    return prisma.user.count({ where });
  },

  create(data: Prisma.UserCreateInput): Promise<PublicUser> {
    return prisma.user.create({ data, select: publicUserSelect });
  },

  update(id: string, data: Prisma.UserUpdateInput): Promise<PublicUser> {
    return prisma.user.update({ where: { id }, data, select: publicUserSelect });
  },

  updatePasswordHash(id: string, passwordHash: string) {
    return prisma.user.update({ where: { id }, data: { passwordHash } });
  },

  touchLastLogin(id: string) {
    return prisma.user.update({ where: { id }, data: { lastLoginAt: new Date() } });
  },

  /** Editorial workflow task, brief section 9: "Cộng tác viên → gửi duyệt:
   *  notify Manager/Admin phù hợp" — every active Manager and Admin, not a
   *  single assignee (this CMS has no per-article reviewer assignment). */
  listActiveByRoles(roles: AdminRole[]) {
    return prisma.user.findMany({
      where: { role: { in: roles }, status: "ACTIVE" },
      select: publicUserSelect,
    });
  },
};
