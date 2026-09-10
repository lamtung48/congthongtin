/**
 * The URL an admin screen should put in an `<img src>` to show a thumbnail
 * of one image asset. Deliberately separate from `resolveMedia.ts`, which
 * works on the public `MediaAsset` *domain* shape — every caller here holds
 * a raw Prisma row instead, and the admin's needs are narrower (a preview or
 * nothing; never a placeholder-resolution decision).
 *
 * `GOOGLE_DRIVE` assets stream through this app's own `/api/media/[id]`
 * delivery route (a raw Drive URL is never handed to a browser); an
 * `EXTERNAL` asset's `providerFileId` already *is* the image URL, so a
 * hot-linked image from the news collector previews too rather than
 * showing as a bare filename.
 */
export function adminImagePreviewUrl(media: {
  id: string;
  provider: string;
  status: string;
  providerFileId?: string | null;
}): string | undefined {
  if (media.status !== "READY") return undefined;
  if (media.provider === "GOOGLE_DRIVE") return `/api/media/${media.id}`;
  if (media.provider === "EXTERNAL") return media.providerFileId ?? undefined;
  return undefined;
}
