import { prisma } from "@/server/db/client";
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
};
