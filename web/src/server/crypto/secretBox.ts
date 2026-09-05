import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Generic AES-256-GCM encryption-at-rest for one credential column —
 * `Source.encryptedCredential` (Social/External Content Collector task,
 * brief section 11: "Credential chỉ Admin/system... Không expose cho
 * Contributor"). Deliberately its own module with its own env var
 * (`SOURCE_CREDENTIAL_ENCRYPTION_KEY`), not a reuse of
 * `youtube.ts`'s `encryptToken`/`decryptToken` (which is keyed by
 * `YOUTUBE_TOKEN_ENCRYPTION_KEY`) — a Facebook Page access token and a
 * YouTube OAuth refresh token are unrelated secrets belonging to unrelated
 * integrations; rotating or leaking one key should never touch the other.
 * Same scheme as `youtube.ts`'s functions (see that file for the full
 * reasoning): a per-call random IV, `iv:authTag:ciphertext` hex-joined.
 */

function deriveEncryptionKey(): Buffer {
  return createHash("sha256").update(process.env.SOURCE_CREDENTIAL_ENCRYPTION_KEY ?? "").digest();
}

export function encryptSecret(plainText: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export class SecretDecryptionError extends Error {}

export function decryptSecret(encrypted: string): string {
  const [ivHex, authTagHex, ciphertextHex] = encrypted.split(":");
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new SecretDecryptionError("Dữ liệu credential lưu trữ không hợp lệ.");
  }
  const decipher = createDecipheriv("aes-256-gcm", deriveEncryptionKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextHex, "hex")), decipher.final()]).toString("utf8");
}
