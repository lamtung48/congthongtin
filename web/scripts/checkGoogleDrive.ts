/**
 * Deploy check: does the configured Google Drive service account actually
 * authenticate and can it reach Drive? Uses the same env vars + key
 * unescaping as src/server/integrations/googleDrive.ts, but calls the Drive
 * API directly so it can run as a plain script.
 *
 *   docker compose exec app npx tsx scripts/checkGoogleDrive.ts
 */
import "dotenv/config";
import { auth, drive as driveClient } from "@googleapis/drive";

const jwt = new auth.JWT({
  email: process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
  key: process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/drive"],
});
const drive = driveClient({ version: "v3", auth: jwt });

async function main() {
  if (!process.env.GOOGLE_DRIVE_CLIENT_EMAIL || !process.env.GOOGLE_DRIVE_PRIVATE_KEY) {
    throw new Error("GOOGLE_DRIVE_CLIENT_EMAIL / GOOGLE_DRIVE_PRIVATE_KEY not set");
  }
  await jwt.authorize();
  console.log("✔ JWT authorize OK — key parsed, token endpoint reachable");

  const about = await drive.about.get({ fields: "user(emailAddress),storageQuota" });
  console.log(`  service account: ${about.data.user?.emailAddress}`);
  console.log(`  storageQuota: ${JSON.stringify(about.data.storageQuota)}`);

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID || "";
  if (folderId) {
    const f = await drive.files.get({ fileId: folderId, fields: "id,name,mimeType,driveId", supportsAllDrives: true });
    console.log(`✔ target folder reachable: "${f.data.name}" (${f.data.mimeType})`);
  } else {
    console.log("… no GOOGLE_DRIVE_FOLDER_ID / GOOGLE_DRIVE_SHARED_DRIVE_ID — uploads land in the service account's own Drive root");
  }

  // Prove a write works: create a tiny file, then delete it.
  const created = await drive.files.create({
    requestBody: { name: `hsv-portal-drive-check-${Date.now()}.txt`, ...(folderId ? { parents: [folderId] } : {}) },
    media: { mimeType: "text/plain", body: "ok" },
    fields: "id",
    supportsAllDrives: true,
  });
  console.log(`✔ test upload OK (file id ${created.data.id})`);
  // Same call the app now uses — trash, not permanent delete (a Shared
  // Drive only lets a Manager hard-delete; the service account can trash).
  await drive.files.update({ fileId: created.data.id!, requestBody: { trashed: true }, supportsAllDrives: true });
  console.log("✔ test file trashed — Drive integration is working end to end");
}

main().catch((e) => {
  const detail = e?.response?.data?.error ?? e?.errors ?? e?.message ?? e;
  console.error("�’ FAIL:", typeof detail === "string" ? detail : JSON.stringify(detail, null, 2));
  process.exitCode = 1;
});
