/**
 * One-off: sync a single existing CMS account to hsv-id now, instead of
 * waiting for its first post-integration login to lazy-sync it. Verifies
 * the given password against the local hash first (so we only ever push a
 * password we've confirmed), then does exactly what `authService.login`'s
 * lazy-sync branch does — but calls hsv-id inline here rather than through
 * `src/server/integrations/hsvId.ts`, which is `import "server-only"` and
 * can't be loaded outside a Next.js server context.
 *
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/syncOneToHsvId.ts
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { verifyPassword } from "../src/server/auth/password";

const HSV_ID_URL = process.env.HSV_ID_URL;
const HSV_ID_INTERNAL_KEY = process.env.HSV_ID_INTERNAL_KEY;

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function hsv(path: string, body: unknown) {
  const res = await fetch(`${HSV_ID_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Internal-Key": HSV_ID_INTERNAL_KEY! },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function main() {
  if (!HSV_ID_URL || !HSV_ID_INTERNAL_KEY) throw new Error("HSV_ID_URL / HSV_ID_INTERNAL_KEY not set.");
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required.");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`No CMS user with email ${email}.`);
  if (!(await verifyPassword(password, user.passwordHash))) {
    throw new Error("Password does not match the local hash — refusing to sync.");
  }

  if (user.identityUserId) {
    const r = await hsv(`/internal/users/${user.identityUserId}/change-password`, { newPassword: password });
    console.log(`Already linked (${user.identityUserId}); change-password -> HTTP ${r.status}`);
    return;
  }

  const created = await hsv("/internal/users", {
    email: user.email,
    password,
    fullName: user.displayName,
    platform: "congthongtin",
    platformUserId: user.id,
  });

  let identityUserId: string;
  if (created.status === 201) {
    identityUserId = created.body.user.id as string;
    console.log(`Created new hsv-id account ${identityUserId} for ${email}`);
  } else if (created.status === 409) {
    // Email already in hsv-id (from hoinghi/daotaohsv). Link only if the
    // same password authenticates there too.
    const v = await hsv("/internal/verify-credentials", { identifier: email, password });
    if (v.status !== 200) {
      throw new Error(`Email is taken in hsv-id but the password differs there (verify -> HTTP ${v.status}). Not linking.`);
    }
    identityUserId = v.body.user.id as string;
    const link = await hsv(`/internal/users/${identityUserId}/link`, { platform: "congthongtin", platformUserId: user.id });
    if (link.status !== 201 && link.status !== 409) {
      throw new Error(`hsv-id /link -> HTTP ${link.status}: ${JSON.stringify(link.body)}`);
    }
    console.log(`Linked to existing hsv-id account ${identityUserId} (${JSON.stringify(v.body.user.fullName)}) — same password confirmed on both sides`);
  } else {
    throw new Error(`hsv-id /internal/users -> HTTP ${created.status}: ${JSON.stringify(created.body)}`);
  }

  await prisma.user.update({ where: { id: user.id }, data: { identityUserId } });
  const verify = await hsv("/internal/verify-credentials", { identifier: email, password });
  console.log(`Round-trip verify-credentials -> HTTP ${verify.status} (200 = shared login works)`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
