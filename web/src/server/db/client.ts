import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Prisma 7 has no built-in query engine binary for SQL databases anymore —
 * a driver adapter (`@prisma/adapter-pg`, wrapping the `pg` driver) is
 * mandatory, not an optimization. See docs/BACKEND_ARCHITECTURE.md,
 * "Prisma 7 driver adapter".
 *
 * Cached on `globalThis` in development only, the standard Next.js/Prisma
 * pattern for surviving hot-reload: every module re-evaluation in dev would
 * otherwise open a fresh `pg` pool on top of the last one until the
 * database refuses new connections. Production has one long-lived module
 * instance per server process already, so no caching is needed there.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — see .env.example / docs/ENVIRONMENT.md");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
