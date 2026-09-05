import "server-only";
import { Readable } from "node:stream";
import { auth, drive as driveClient, type drive_v3 } from "@googleapis/drive";

/**
 * The one module in this codebase allowed to hold a Google service-account
 * credential or talk to the Drive API directly — brief section 9: "Credential
 * chỉ server-side." `import "server-only"` makes an accidental import from a
 * Client Component a build error, not just a code-review mistake.
 *
 * Auth: a service account (JWT), not user-delegated OAuth — this is a CMS
 * uploading on behalf of the *application*, not a human's own Drive, so
 * there's no user consent screen to run per editor and no refresh-token
 * lifecycle to manage. Scope is the full `drive` scope (not the narrower
 * `drive.file`) because `drive.file` only grants access to files the app
 * itself created *through that exact OAuth client* — a service account
 * shared across environments, or a Shared Drive multiple things write into,
 * doesn't fit that narrower scope cleanly.
 *
 * Storage target: "Ưu tiên Google Shared Drive nếu có Google Workspace"
 * (brief section 2) — `GOOGLE_DRIVE_SHARED_DRIVE_ID` wins when set;
 * `GOOGLE_DRIVE_FOLDER_ID` (a plain My Drive folder, works without a
 * Workspace/Shared Drive) is the fallback. Every Drive call passes
 * `supportsAllDrives: true` unconditionally — harmless when the target is a
 * plain folder, required when it's a Shared Drive.
 */

const REQUIRED_ENV = ["GOOGLE_DRIVE_CLIENT_EMAIL", "GOOGLE_DRIVE_PRIVATE_KEY"] as const;

export class GoogleDriveNotConfiguredError extends Error {
  constructor() {
    super("Google Drive chưa được cấu hình — thiếu biến môi trường. Liên hệ Admin để cấu hình credentials.");
    this.name = "GoogleDriveNotConfiguredError";
  }
}

/** Google Drive itself failed (quota, network, invalid file, revoked
 *  credential, ...) — distinct from "not configured at all" so callers (and
 *  the UI) can tell "nobody set this up" apart from "it's set up but Google
 *  rejected the call right now" (brief section 10: "CMS báo lỗi rõ"). Never
 *  wraps a raw googleapis error message that might echo request headers —
 *  see `describeDriveError`. */
export class GoogleDriveOperationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "GoogleDriveOperationError";
  }
}

export function isGoogleDriveConfigured(): boolean {
  return REQUIRED_ENV.every((key) => !!process.env[key]);
}

function getRootFolderId(): string | undefined {
  return process.env.GOOGLE_DRIVE_FOLDER_ID || undefined;
}

function getSharedDriveId(): string | undefined {
  return process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID || undefined;
}

let cachedClient: drive_v3.Drive | null = null;

/**
 * `.env` files can't hold a literal multi-line PEM key without escaping —
 * the private key is stored with literal `\n` sequences and unescaped here,
 * the standard workaround for every "PEM key in an env var" integration.
 */
function getClient(): drive_v3.Drive {
  if (cachedClient) return cachedClient;
  if (!isGoogleDriveConfigured()) {
    throw new GoogleDriveNotConfiguredError();
  }
  // `auth.JWT` (re-exported by `@googleapis/drive` itself, not the standalone
  // `google-auth-library` package) — that package pins its own copy of
  // `google-auth-library` as a transitive dependency, and TypeScript treats
  // a same-named class from two separately-installed copies as structurally
  // incompatible (private-field identity), which a second top-level
  // `google-auth-library` dependency triggered here. Using the client's own
  // re-export guarantees there's exactly one `JWT` class in play.
  const jwtClient = new auth.JWT({
    email: process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
    key: process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  cachedClient = driveClient({ version: "v3", auth: jwtClient });
  return cachedClient;
}

/**
 * Never includes the raw error from `googleapis`/`gaxios` in what reaches a
 * user — that object can carry request config (occasionally including
 * auth-adjacent details in its `config`/`response` fields depending on the
 * failure). Logs the real error server-side (stdout, not a place a
 * Contributor's browser ever sees) and returns a short, safe message.
 */
function describeDriveError(err: unknown): string {
  console.error("[googleDrive] operation failed:", err);
  if (err instanceof Error) {
    // Common, safe-to-surface cases a CMS editor should be able to
    // recognize and act on (or report) without a stack trace.
    if (/invalid_grant|invalid_rapt|unauthorized/i.test(err.message)) {
      return "Google Drive từ chối xác thực — credential có thể đã hết hạn hoặc bị thu hồi.";
    }
    if (/quota|rateLimitExceeded|userRateLimitExceeded/i.test(err.message)) {
      return "Google Drive tạm thời vượt hạn mức — vui lòng thử lại sau ít phút.";
    }
    if (/notFound/i.test(err.message)) {
      return "Không tìm thấy tệp trên Google Drive (có thể đã bị xoá thủ công).";
    }
  }
  return "Không thể kết nối tới Google Drive. Vui lòng thử lại sau.";
}

export interface UploadedDriveFile {
  fileId: string;
  size: number;
}

/** Uploads a buffer already fully read into memory by the caller (the
 *  Route Handler — see `docs/GOOGLE_DRIVE_MEDIA.md`, "Upload flow" for why
 *  this app reads the whole file before calling here rather than piping the
 *  incoming request stream straight through: `Request.formData()` doesn't
 *  expose the underlying part as a stream in the Web Request API Next.js
 *  Route Handlers use). Wraps the buffer in a `Readable` for the one Drive
 *  API call that does stream — no temp file is ever written to disk. */
export async function uploadFileToDrive(buffer: Buffer, filename: string, mimeType: string): Promise<UploadedDriveFile> {
  const drive = getClient();
  const sharedDriveId = getSharedDriveId();
  const folderId = getRootFolderId();
  try {
    const res = await drive.files.create({
      requestBody: {
        name: filename,
        parents: folderId ? [folderId] : sharedDriveId ? [sharedDriveId] : undefined,
      },
      media: {
        mimeType,
        body: Readable.from(buffer),
      },
      fields: "id, size",
      supportsAllDrives: true,
    });
    const fileId = res.data.id;
    if (!fileId) {
      throw new GoogleDriveOperationError("Google Drive không trả về id tệp sau khi tải lên.");
    }
    return { fileId, size: Number(res.data.size ?? buffer.byteLength) };
  } catch (err) {
    if (err instanceof GoogleDriveNotConfiguredError || err instanceof GoogleDriveOperationError) throw err;
    throw new GoogleDriveOperationError(describeDriveError(err), { cause: err });
  }
}

export async function deleteFileFromDrive(fileId: string): Promise<void> {
  const drive = getClient();
  try {
    await drive.files.delete({ fileId, supportsAllDrives: true });
  } catch (err) {
    if (err instanceof GoogleDriveNotConfiguredError) throw err;
    throw new GoogleDriveOperationError(describeDriveError(err), { cause: err });
  }
}

export interface DriveFileStream {
  stream: NodeJS.ReadableStream;
  mimeType: string;
  size?: number;
}

/** Streams a file's bytes straight through this server to the browser —
 *  this is the only place a Drive file's actual content is ever read; the
 *  public-facing route calling this never hands the browser a Drive URL
 *  directly (brief section 8). */
export async function getDriveFileStream(fileId: string): Promise<DriveFileStream> {
  const drive = getClient();
  try {
    const [metaRes, contentRes] = await Promise.all([
      drive.files.get({ fileId, fields: "mimeType, size", supportsAllDrives: true }),
      drive.files.get({ fileId, alt: "media", supportsAllDrives: true }, { responseType: "stream" }),
    ]);
    return {
      stream: contentRes.data,
      mimeType: metaRes.data.mimeType ?? "application/octet-stream",
      size: metaRes.data.size ? Number(metaRes.data.size) : undefined,
    };
  } catch (err) {
    if (err instanceof GoogleDriveNotConfiguredError) throw err;
    throw new GoogleDriveOperationError(describeDriveError(err), { cause: err });
  }
}
