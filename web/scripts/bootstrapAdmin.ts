/**
 * Production readiness task, brief section 3: "Initial Admin account phải
 * tạo qua seed/setup script an toàn; hoặc documented CLI/bootstrap process.
 * Không hard-code admin password trong repository."
 *
 * `prisma/seed.ts` is NOT that script — it's an explicitly dev-only
 * fixture loader (its own header comment: "never used outside a local/dev
 * database") that hardcodes three well-known passwords on purpose, so a
 * fresh `npm run dev` clone always has something to log in with. Running
 * it against a real production database would create those same
 * publicly-known accounts there — this script exists so production never
 * needs to run `prisma db seed` at all.
 *
 * What this script does, and does not, do:
 *   - Reads `ADMIN_EMAIL` (required) and optionally `ADMIN_USERNAME`,
 *     `ADMIN_DISPLAY_NAME` from the environment — never from a CLI
 *     argument (arguments end up in shell history and `ps` output; env
 *     vars passed via a deploy tool's secret injection do not).
 *   - Reads `ADMIN_PASSWORD` from the environment if the operator wants to
 *     set a specific one (e.g. from their own password manager); otherwise
 *     generates a cryptographically random 24-character password and
 *     prints it to stdout exactly once. Nothing here ever writes a
 *     password to a file, a log, or anywhere but that one-time console
 *     line — the operator is expected to copy it immediately and change it
 *     after first login (`/admin/profile`).
 *   - Refuses to run if ANY ADMIN account already exists, unless
 *     `ADMIN_BOOTSTRAP_FORCE=true` is also set — a fresh production
 *     database bootstraps exactly once; re-running by accident (a second
 *     deploy, a CI misfire) must never silently create a second Admin or
 *     reset an existing one. Setting the force flag is a deliberate,
 *     explicit human decision (e.g. "we lost access to every Admin
 *     account"), not something a script should default to.
 *
 * Run in production (see docs/DEPLOYMENT.md, "First deploy"):
 *   ADMIN_EMAIL="admin@your-domain.vn" npx tsx scripts/bootstrapAdmin.ts
 * Or via the npm script:
 *   ADMIN_EMAIL="admin@your-domain.vn" npm run db:bootstrap-admin
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/server/auth/password";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/** Base64url, no padding — safe to paste into a URL or a terminal without
 *  quoting, unlike base64's `+`/`/`/`=`. 18 random bytes -> 24 characters. */
function generateRandomPassword(): string {
  return randomBytes(18).toString("base64url");
}

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) {
    throw new Error("ADMIN_EMAIL is required (e.g. ADMIN_EMAIL=\"admin@your-domain.vn\" npm run db:bootstrap-admin).");
  }

  const force = process.env.ADMIN_BOOTSTRAP_FORCE === "true";
  const existingAdmin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (existingAdmin && !force) {
    throw new Error(
      `An ADMIN account already exists (${existingAdmin.email}). Refusing to bootstrap another one. ` +
        "Set ADMIN_BOOTSTRAP_FORCE=true only if you deliberately intend to create an additional Admin account.",
    );
  }

  const existingByEmail = await prisma.user.findUnique({ where: { email } });
  if (existingByEmail) {
    throw new Error(`A user with email "${email}" already exists (role: ${existingByEmail.role}). Choose a different ADMIN_EMAIL.`);
  }

  const generatedPassword = process.env.ADMIN_PASSWORD ? null : generateRandomPassword();
  const password = process.env.ADMIN_PASSWORD ?? generatedPassword!;
  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters — omit it entirely to have a strong one generated for you.");
  }

  const displayName = process.env.ADMIN_DISPLAY_NAME?.trim() || "Quản trị hệ thống";
  const username = process.env.ADMIN_USERNAME?.trim() || undefined;

  const admin = await prisma.user.create({
    data: {
      email,
      username,
      displayName,
      role: "ADMIN",
      status: "ACTIVE",
      passwordHash: await hashPassword(password),
    },
  });

  console.log("Đã tạo tài khoản ADMIN đầu tiên cho production.");
  console.log(`  Email: ${admin.email}`);
  if (generatedPassword) {
    console.log(`  Mật khẩu (chỉ hiển thị MỘT LẦN — hãy lưu lại ngay và đổi mật khẩu sau khi đăng nhập lần đầu):`);
    console.log(`  ${generatedPassword}`);
  } else {
    console.log("  Mật khẩu: giá trị bạn đã đặt qua ADMIN_PASSWORD.");
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
