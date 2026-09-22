import "server-only";
import { randomUUID } from "node:crypto";
import { validateImageUpload, buildStorageFilename, sniffImageFormat, type ImageFormat } from "@/server/validation/mediaUpload";
import { processImageForStorage, transcodeToWebp } from "@/server/media/processImage";
import { fetchRemoteImage } from "@/server/media/fetchRemoteImage";
import { uploadFileToDrive } from "@/server/integrations/googleDrive";
import { mediaService } from "@/server/services/mediaService";
import { mediaRepository } from "@/server/repositories/mediaRepository";
import { slugify } from "@/lib/slug";
import type { SessionUser } from "@/server/auth/session";

const EXT: Record<ImageFormat, string> = { JPEG: "jpg", PNG: "png", GIF: "gif", WEBP: "webp" };

/** Filename whose extension matches the buffer's real format, so
 *  `validateImageUpload`'s extension-vs-format check passes for images that
 *  arrived without a trustworthy name (remote URL / pasted blob). */
export function inferImageFilename(buffer: Buffer, hint: string): string {
  const fmt = sniffImageFormat(buffer);
  const base = slugify(hint).slice(0, 60).replace(/-+$/, "") || "anh";
  return fmt ? `${base}.${EXT[fmt]}` : `${base}.bin`;
}

export type StoreImageResult =
  | { ok: true; media: Awaited<ReturnType<typeof mediaService.registerUpload>> }
  | { ok: false; status: number; error: string };

/**
 * The shared tail of every image ingest path: validate (magic bytes, size,
 * dimensions) → downscale + strip EXIF → Google Drive → `MediaAsset` row.
 * `POST /api/admin/media/upload` (drag-drop / file picker) and
 * `POST /api/admin/media/import-url` (data: URI / remote URL) both end here.
 * May throw `GoogleDriveNotConfiguredError`/`GoogleDriveOperationError` — the
 * caller route maps those to 503/502.
 */
export async function storeImageBuffer(
  actor: SessionUser,
  buffer: Buffer,
  opts: { originalName: string; nameHint?: string },
): Promise<StoreImageResult> {
  // News CDNs hand out AVIF (and the odd TIFF); re-encode anything outside
  // the four accepted formats to WebP first so it can take the normal path.
  let source = buffer;
  let originalName = opts.originalName;
  if (!sniffImageFormat(source)) {
    const webp = await transcodeToWebp(source);
    if (webp) {
      source = webp;
      originalName = `${originalName.replace(/\.[^./]*$/, "")}.webp`;
    }
  }

  const validation = validateImageUpload(source, originalName);
  if (!validation.ok) return { ok: false, status: 400, error: validation.error };

  const { format, mimeType, dimensions } = validation.value;
  const processed = await processImageForStorage(source, format);
  const slugHint = opts.nameHint?.trim() ? slugify(opts.nameHint).slice(0, 80).replace(/-+$/, "") || undefined : undefined;
  const storageFilename = buildStorageFilename(randomUUID(), format, slugHint);

  const uploaded = await uploadFileToDrive(processed.buffer, storageFilename, mimeType);
  const media = await mediaService.registerUpload(actor, {
    providerFileId: uploaded.fileId,
    type: "IMAGE",
    filename: originalName,
    mimeType,
    size: uploaded.size,
    width: processed.width ?? dimensions?.width,
    height: processed.height ?? dimensions?.height,
  });
  return { ok: true, media };
}

/**
 * Fetch an image by URL and put it in Drive, returning the `MediaAsset` id —
 * the "copy it in, don't hot-link it" path the external-content collector
 * uses when converting an inbox item into a Draft, so a converted article's
 * images are ordinary Drive-backed assets an editor can preview, reuse and
 * manage like any upload.
 *
 * Never throws: an unreachable image or a Drive outage must not take a whole
 * conversion down with it. Falls back to registering the original URL as an
 * `EXTERNAL` (hot-linked) asset so the article still renders, and returns
 * `null` only when even that isn't possible.
 */
export async function importImageFromUrl(
  actor: SessionUser,
  opts: { url: string; nameHint?: string; caption?: string },
): Promise<string | null> {
  try {
    const fetched = await fetchRemoteImage(opts.url, opts.nameHint);
    if (fetched.ok) {
      const stored = await storeImageBuffer(actor, fetched.buffer, {
        originalName: inferImageFilename(fetched.buffer, fetched.nameHint),
        nameHint: opts.nameHint,
      });
      if (stored.ok) {
        const alt = opts.caption?.trim() || opts.nameHint?.trim();
        if (alt) await mediaRepository.updateMetadata(stored.media.id, { alt, caption: opts.caption?.trim() || null });
        return stored.media.id;
      }
      console.warn(`[importImageFromUrl] store failed for ${opts.url}: ${stored.error}`);
    } else {
      console.warn(`[importImageFromUrl] fetch failed for ${opts.url}: ${fetched.error}`);
    }
  } catch (err) {
    console.warn(`[importImageFromUrl] unexpected error for ${opts.url}:`, err);
  }

  try {
    const external = await mediaService.registerExternalImage(actor, {
      url: opts.url,
      alt: opts.nameHint,
      caption: opts.caption,
    });
    return external.id;
  } catch {
    return null;
  }
}

/**
 * Imports many images at once with bounded concurrency, returning a
 * `url -> MediaAsset.id` map (a URL that could not be imported at all is
 * simply absent). Duplicate URLs are collapsed before any work starts.
 *
 * Concurrency matters a lot here: a Drive `files.create` round trip takes
 * roughly 3s from this host and spends essentially all of it waiting on the
 * network, so importing an article's images one after another made
 * converting a typical 8-image news item block a Server Action for ~28s.
 * Four in flight cuts that to about a quarter while staying well inside
 * Drive's per-user write limits.
 */
export async function importImagesFromUrls(
  actor: SessionUser,
  requests: { url: string; nameHint?: string; caption?: string }[],
  concurrency = 4,
): Promise<Map<string, string>> {
  // First request for a URL wins, so a body image's caption isn't lost to a
  // later duplicate that has none.
  const unique = [...new Map(requests.map((r) => [r.url, r])).values()];
  const result = new Map<string, string>();
  let cursor = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const index = cursor++;
      if (index >= unique.length) return;
      const request = unique[index];
      const mediaId = await importImageFromUrl(actor, request);
      if (mediaId) result.set(request.url, mediaId);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, unique.length) }, worker));
  return result;
}
