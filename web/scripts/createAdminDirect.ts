/**
 * Deploy helper — create/reset one account with a chosen email + password
 * and role, bypassing scripts/bootstrapAdmin.ts's "no existing ADMIN" and
 * ">= 12 char password" guards. Used at first deploy because the operator
 * wants a specific short shared password (`hsv09011950`) and the dev seed
 * has already created an ADMIN row.
 *
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... [ADMIN_ROLE=ADMIN] \
 *     [ADMIN_DISPLAY_NAME=...] npx tsx scripts/createAdminDirect.ts
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/server/auth/password";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are both required.");
  }
  const role = (process.env.ADMIN_ROLE?.trim() || "ADMIN") as "ADMIN" | "MANAGER" | "CONTRIBUTOR";
  const displayName = process.env.ADMIN_DISPLAY_NAME?.trim() || "Văn phòng Hội Sinh viên Việt Nam";
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role, status: "ACTIVE" },
    create: { email, displayName, role, status: "ACTIVE", passwordHash },
  });

  console.log(`OK: ${user.email} (role ${user.role}, status ${user.status})`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
