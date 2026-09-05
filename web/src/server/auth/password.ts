import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Password hashing via Node's built-in `crypto.scrypt` — OWASP-approved
 * alongside bcrypt/argon2, and, unlike either, ships in Node itself. No new
 * native dependency (no binary to compile, no version-compatibility check
 * against this project's Node/Next versions to worry about — see
 * docs/AUTHENTICATION.md, "Password hashing").
 *
 * Stored format: `scrypt$<salt-hex>$<hash-hex>` — self-describing so a
 * future algorithm change can coexist with old hashes during a migration
 * rather than invalidating every password at once.
 */

const scrypt = promisify(scryptCallback);

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export async function hashPassword(plainPassword: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = (await scrypt(plainPassword, salt, KEY_LENGTH)) as Buffer;
  return `scrypt$${salt.toString("hex")}$${derivedKey.toString("hex")}`;
}

export async function verifyPassword(plainPassword: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, saltHex, hashHex] = parts;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = (await scrypt(plainPassword, salt, expected.length)) as Buffer;
  // `timingSafeEqual` throws on length mismatch instead of returning false —
  // guard explicitly so a malformed stored hash can't leak timing info or crash.
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
