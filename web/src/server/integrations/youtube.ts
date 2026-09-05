import "server-only";
import { Readable } from "node:stream";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { auth, youtube as youtubeClient, type youtube_v3 } from "@googleapis/youtube";
import { youtubeConnectionRepository } from "@/server/repositories/youtubeConnectionRepository";

/**
 * The one module allowed to hold the YouTube OAuth client secret or a
 * channel's refresh token, or to talk to the YouTube Data API directly —
 * YouTube integration task, brief section 9: "OAuth token server-side."
 * `import "server-only"` makes an accidental import from a Client Component
 * a build error, the same discipline `googleDrive.ts` uses.
 *
 * Auth here is fundamentally different from Drive's: uploading to *a
 * specific YouTube channel* requires that channel owner's own consent
 * (OAuth2 authorization-code flow) — there is no service-account equivalent
 * for "upload video to someone's channel." An Admin completes the consent
 * screen once (`youtubeService.beginConnect`/`completeConnect`); the
 * resulting refresh token is encrypted (`encryptToken`/`decryptToken`,
 * AES-256-GCM keyed by `YOUTUBE_TOKEN_ENCRYPTION_KEY`) and stored in the
 * single `YoutubeConnection` row. Every other role only ever sees whether a
 * channel is connected (`isYoutubeConnected`) and its display name — never
 * the token itself, and no client-facing code path returns it.
 */

const OAUTH_ENV = ["YOUTUBE_OAUTH_CLIENT_ID", "YOUTUBE_OAUTH_CLIENT_SECRET", "YOUTUBE_OAUTH_REDIRECT_URI", "YOUTUBE_TOKEN_ENCRYPTION_KEY"] as const;

/** The one scope this app ever requests — full read/write over the
 *  connected channel's videos (upload, update metadata, list). There is no
 *  narrower "upload only" scope that also allows listing/updating existing
 *  videos, which the CMS needs for "chọn video đã có trên kênh". */
const OAUTH_SCOPES = ["https://www.googleapis.com/auth/youtube"];

export class YoutubeNotConfiguredError extends Error {
  constructor() {
    super("Tích hợp YouTube chưa được cấu hình — thiếu biến môi trường OAuth. Liên hệ Admin để cấu hình.");
    this.name = "YoutubeNotConfiguredError";
  }
}

/** Configured (the app *could* run the OAuth flow) but no Admin has
 *  actually completed it yet — distinct from "not configured at all" so
 *  the UI can tell "nobody set up credentials" apart from "credentials
 *  exist, someone just needs to click Connect." */
export class YoutubeNotConnectedError extends Error {
  constructor() {
    super("Chưa kết nối kênh YouTube nào. Admin cần kết nối kênh trước khi upload hoặc chọn video.");
    this.name = "YoutubeNotConnectedError";
  }
}

/** The YouTube Data API itself failed (quota, revoked/expired consent,
 *  video not found, network) — brief section 7's error states. `reason` is
 *  a short machine code (`quota_exceeded` | `unauthorized` | `not_found` |
 *  `forbidden` | `unknown`) callers can persist as `MediaAsset.errorReason`
 *  without re-parsing a message string. Never wraps the raw googleapis/
 *  gaxios error in what reaches a client — see `describeYoutubeError`. */
export class YoutubeOperationError extends Error {
  reason: string;
  constructor(message: string, reason: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "YoutubeOperationError";
    this.reason = reason;
  }
}

export function isYoutubeConfigured(): boolean {
  return OAUTH_ENV.every((key) => !!process.env[key]);
}

export async function isYoutubeConnected(): Promise<boolean> {
  return (await youtubeConnectionRepository.get()) !== null;
}

function requireConfigured() {
  if (!isYoutubeConfigured()) throw new YoutubeNotConfiguredError();
}

function getOAuthClient() {
  requireConfigured();
  return new auth.OAuth2(process.env.YOUTUBE_OAUTH_CLIENT_ID, process.env.YOUTUBE_OAUTH_CLIENT_SECRET, process.env.YOUTUBE_OAUTH_REDIRECT_URI);
}

/** Step 1 of the consent flow — the URL an Admin's browser is redirected
 *  to. `state` should be a random, session-bound nonce the caller verifies
 *  on callback (CSRF protection for the redirect-back step — see
 *  `youtubeService.beginConnect`). `access_type: "offline"` +
 *  `prompt: "consent"` are both required to reliably get a *refresh* token
 *  back — Google only issues one on the first consent, or when explicitly
 *  re-prompted. */
export function buildYoutubeAuthUrl(state: string): string {
  const client = getOAuthClient();
  return client.generateAuthUrl({ access_type: "offline", prompt: "consent", scope: OAUTH_SCOPES, state });
}

export interface ExchangedYoutubeTokens {
  refreshToken: string;
  channelId: string;
  channelTitle: string;
}

/** Step 2 — exchanges the callback's `code` for tokens, then immediately
 *  looks up the authorizing channel's own id/title (`channels.list({mine:
 *  true})`) so the connection row can display "kênh nào đang kết nối"
 *  without a second round trip later. Throws if Google didn't return a
 *  refresh token at all (happens if `prompt: "consent"` was somehow
 *  skipped, e.g. a stale authorization URL) — a connection with no refresh
 *  token is useless, so this is treated as a hard failure, not stored. */
export async function exchangeCodeForTokens(code: string): Promise<ExchangedYoutubeTokens> {
  const client = getOAuthClient();
  try {
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token) {
      throw new YoutubeOperationError(
        "Google không trả về refresh token — vui lòng thử kết nối lại (đảm bảo chấp thuận toàn bộ quyền được yêu cầu).",
        "no_refresh_token",
      );
    }
    client.setCredentials(tokens);
    const yt = youtubeClient({ version: "v3", auth: client });
    const res = await yt.channels.list({ mine: true, part: ["snippet"] });
    const channel = res.data.items?.[0];
    if (!channel?.id) {
      throw new YoutubeOperationError("Không tìm thấy kênh YouTube nào cho tài khoản vừa đăng nhập.", "no_channel");
    }
    return { refreshToken: tokens.refresh_token, channelId: channel.id, channelTitle: channel.snippet?.title ?? channel.id };
  } catch (err) {
    if (err instanceof YoutubeOperationError) throw err;
    throw new YoutubeOperationError(describeYoutubeError(err), "unknown", { cause: err });
  }
}

// ---------------------------------------------------------------------------
// Refresh-token encryption at rest
// ---------------------------------------------------------------------------

function deriveEncryptionKey(): Buffer {
  // Accepts any secret string of any length/format for
  // YOUTUBE_TOKEN_ENCRYPTION_KEY — hashed down to exactly the 32 bytes
  // AES-256-GCM requires, rather than demanding the Admin generate and
  // paste a precisely-formatted key.
  return createHash("sha256").update(process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY ?? "").digest();
}

/** `iv:authTag:ciphertext`, each hex-encoded — a fresh random IV per call
 *  (AES-GCM must never reuse an IV under the same key). */
export function encryptToken(plainText: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decryptToken(encrypted: string): string {
  const [ivHex, authTagHex, ciphertextHex] = encrypted.split(":");
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new YoutubeOperationError("Dữ liệu token lưu trữ không hợp lệ.", "corrupt_token");
  }
  const decipher = createDecipheriv("aes-256-gcm", deriveEncryptionKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextHex, "hex")), decipher.final()]).toString("utf8");
}

// ---------------------------------------------------------------------------
// Authorized client for the connected channel
// ---------------------------------------------------------------------------

let cachedClient: { client: youtube_v3.Youtube; refreshToken: string } | null = null;

/** Builds (and caches) an authorized `youtube_v3.Youtube` client from the
 *  stored connection's decrypted refresh token. `google-auth-library`'s
 *  `OAuth2Client` mints and caches its own short-lived access tokens from
 *  the refresh token automatically on each call — nothing here manages
 *  access-token expiry by hand. Re-fetches the connection (and rebuilds the
 *  client) whenever the stored refresh token changes, e.g. after a
 *  reconnect. */
async function getAuthorizedClient(): Promise<youtube_v3.Youtube> {
  requireConfigured();
  const connection = await youtubeConnectionRepository.get();
  if (!connection) throw new YoutubeNotConnectedError();
  const refreshToken = decryptToken(connection.encryptedRefreshToken);
  if (cachedClient && cachedClient.refreshToken === refreshToken) return cachedClient.client;
  const oauthClient = getOAuthClient();
  oauthClient.setCredentials({ refresh_token: refreshToken });
  const client = youtubeClient({ version: "v3", auth: oauthClient });
  cachedClient = { client, refreshToken };
  return client;
}

/** Never includes the raw googleapis/gaxios error in what reaches a
 *  client — logs the real error server-side, returns a short safe message.
 *  Mirrors `googleDrive.ts`'s `describeDriveError`. */
function describeYoutubeError(err: unknown): string {
  console.error("[youtube] operation failed:", err);
  if (err instanceof Error) {
    if (/quota|rateLimitExceeded|dailyLimitExceeded/i.test(err.message)) {
      return "YouTube tạm thời vượt hạn mức API — vui lòng thử lại sau.";
    }
    if (/invalid_grant|invalid_rapt|unauthorized|invalid_token/i.test(err.message)) {
      return "YouTube từ chối xác thực — kết nối kênh có thể đã hết hạn hoặc bị thu hồi. Admin cần kết nối lại.";
    }
    if (/forbidden/i.test(err.message)) {
      return "YouTube từ chối yêu cầu này (không đủ quyền trên video/kênh).";
    }
    if (/notFound/i.test(err.message)) {
      return "Không tìm thấy video trên YouTube (có thể đã bị xoá).";
    }
  }
  return "Không thể kết nối tới YouTube. Vui lòng thử lại sau.";
}

function classifyYoutubeError(err: unknown): string {
  if (err instanceof Error) {
    if (/quota|rateLimitExceeded|dailyLimitExceeded/i.test(err.message)) return "quota_exceeded";
    if (/invalid_grant|invalid_rapt|unauthorized|invalid_token/i.test(err.message)) return "unauthorized";
    if (/forbidden/i.test(err.message)) return "forbidden";
    if (/notFound/i.test(err.message)) return "not_found";
  }
  return "unknown";
}

function wrapError(err: unknown): never {
  if (err instanceof YoutubeNotConfiguredError || err instanceof YoutubeNotConnectedError || err instanceof YoutubeOperationError) throw err;
  throw new YoutubeOperationError(describeYoutubeError(err), classifyYoutubeError(err), { cause: err });
}

// ---------------------------------------------------------------------------
// Upload / read / update
// ---------------------------------------------------------------------------

export type YoutubePrivacyStatus = "public" | "unlisted" | "private";

export interface UploadedYoutubeVideo {
  videoId: string;
}

/** Uploads a buffer already fully read into memory by the caller (the
 *  Route Handler — same reasoning as `googleDrive.ts`'s `uploadFileToDrive`:
 *  Next's Route Handler `Request.formData()` API gives no way to treat one
 *  multipart part as a live stream, so the whole file is buffered before
 *  this is ever called; nothing here writes it to disk). YouTube's own
 *  processing (transcoding, thumbnail generation) happens asynchronously
 *  after this returns — the video is not immediately playable, hence
 *  `MediaStatus.PROCESSING` until a status check confirms it's ready. */
export async function uploadVideoToYoutube(
  buffer: Buffer,
  mimeType: string,
  metadata: { title: string; description: string; privacyStatus: YoutubePrivacyStatus },
): Promise<UploadedYoutubeVideo> {
  const client = await getAuthorizedClient();
  try {
    const res = await client.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: { title: metadata.title, description: metadata.description },
        status: { privacyStatus: metadata.privacyStatus },
      },
      media: { mimeType, body: Readable.from(buffer) },
    });
    const videoId = res.data.id;
    if (!videoId) throw new YoutubeOperationError("YouTube không trả về id video sau khi tải lên.", "upload_failed");
    return { videoId };
  } catch (err) {
    wrapError(err);
  }
}

export interface YoutubeVideoStatus {
  title: string;
  description: string;
  privacyStatus: YoutubePrivacyStatus;
  /** "uploaded" | "processed" | "failed" | "rejected" | "deleted" */
  uploadStatus: string;
  embeddable: boolean;
  durationSeconds: number | undefined;
  thumbnailUrl: string | undefined;
}

/** `null` means the video id doesn't resolve to anything the connected
 *  channel's credentials can see at all (deleted, or never existed) —
 *  distinct from a video that resolves but isn't currently embeddable
 *  (`embeddable: false`, `privacyStatus: "private"`), which is a normal
 *  result the caller inspects rather than an error. */
export async function getVideoStatus(videoId: string): Promise<YoutubeVideoStatus | null> {
  const client = await getAuthorizedClient();
  try {
    const res = await client.videos.list({ part: ["snippet", "status", "contentDetails"], id: [videoId] });
    const item = res.data.items?.[0];
    if (!item) return null;
    return {
      title: item.snippet?.title ?? "",
      description: item.snippet?.description ?? "",
      privacyStatus: (item.status?.privacyStatus as YoutubePrivacyStatus | undefined) ?? "private",
      uploadStatus: item.status?.uploadStatus ?? "unknown",
      embeddable: item.status?.embeddable ?? false,
      durationSeconds: item.contentDetails?.duration ? parseIso8601Duration(item.contentDetails.duration) : undefined,
      thumbnailUrl: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? undefined,
    };
  } catch (err) {
    wrapError(err);
  }
}

export async function updateVideoMetadata(
  videoId: string,
  changes: { title?: string; description?: string; privacyStatus?: YoutubePrivacyStatus },
): Promise<void> {
  const client = await getAuthorizedClient();
  try {
    // YouTube's videos.update replaces the whole `snippet`/`status` part
    // sent, not a per-field patch — the current values are fetched first so
    // an update that only changes e.g. visibility doesn't blank out the
    // title/description/categoryId already on the video.
    const current = await client.videos.list({ part: ["snippet", "status"], id: [videoId] });
    const item = current.data.items?.[0];
    if (!item) throw new YoutubeOperationError("Không tìm thấy video trên YouTube (có thể đã bị xoá).", "not_found");
    await client.videos.update({
      part: ["snippet", "status"],
      requestBody: {
        id: videoId,
        snippet: { ...item.snippet, title: changes.title ?? item.snippet?.title, description: changes.description ?? item.snippet?.description },
        status: { ...item.status, privacyStatus: changes.privacyStatus ?? item.status?.privacyStatus },
      },
    });
  } catch (err) {
    wrapError(err);
  }
}

export interface ChannelUploadItem {
  videoId: string;
  title: string;
  thumbnailUrl: string | undefined;
  publishedAt: string | undefined;
}

export interface ChannelUploadsPage {
  items: ChannelUploadItem[];
  nextPageToken: string | undefined;
}

/** "Chọn video đã có trên kênh" (brief section 2) — reads the channel's
 *  standard "uploads" playlist rather than `search.list`, which is both far
 *  more quota-expensive (100 units/call vs. 1) and only eventually
 *  consistent (a just-uploaded video can take a while to appear in search
 *  results, but shows up in the uploads playlist immediately). */
export async function listChannelUploads(pageToken?: string): Promise<ChannelUploadsPage> {
  const client = await getAuthorizedClient();
  try {
    const channelRes = await client.channels.list({ mine: true, part: ["contentDetails"] });
    const uploadsPlaylistId = channelRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) return { items: [], nextPageToken: undefined };
    const itemsRes = await client.playlistItems.list({
      playlistId: uploadsPlaylistId,
      part: ["snippet"],
      maxResults: 25,
      pageToken,
    });
    return {
      items: (itemsRes.data.items ?? []).map((it) => ({
        videoId: it.snippet?.resourceId?.videoId ?? "",
        title: it.snippet?.title ?? "",
        thumbnailUrl: it.snippet?.thumbnails?.medium?.url ?? it.snippet?.thumbnails?.default?.url ?? undefined,
        publishedAt: it.snippet?.publishedAt ?? undefined,
      })).filter((it) => it.videoId),
      nextPageToken: itemsRes.data.nextPageToken ?? undefined,
    };
  } catch (err) {
    wrapError(err);
  }
}

/** `PT#H#M#S` (ISO 8601 duration, the only shape `contentDetails.duration`
 *  ever uses for a YouTube video) -> whole seconds. Missing components
 *  default to 0 (e.g. `PT45S` is valid and has no H/M group). */
export function parseIso8601Duration(iso: string): number {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!match) return 0;
  const [, hours, minutes, seconds] = match;
  return Number(hours ?? 0) * 3600 + Number(minutes ?? 0) * 60 + Number(seconds ?? 0);
}
