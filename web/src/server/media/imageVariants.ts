import "server-only";
import sharp from "sharp";
import { VARIANT_WIDTHS, type VariantWidth } from "@/lib/media/variantWidths";

/**
 * Resized copies of a stored image, so a 300px-wide card stops downloading
 * the full 1600px original. Every variant is derived, never authoritative —
 * the original on Drive stays the only stored copy.
 *
 * There is no cache in this module any more: `mediaCache.ts` now sits in
 * front of the whole `/api/media/[id]` route (memory + a disk volume that
 * survives redeploys) and is consulted *before* Google Drive is touched at
 * all, so a repeat request never reaches this transform. This file is just
 * the pure "shrink these bytes to this width as WebP" step for a genuine
 * cache miss.
 */

/** A closed set, not an arbitrary `?w=`: otherwise a crawler asking for 1000
 *  distinct widths would burn CPU re-encoding on every request and blow the
 *  cache budget. Shared with the client component that builds `srcset`. */
export { VARIANT_WIDTHS, type VariantWidth } from "@/lib/media/variantWidths";

export function parseVariantWidth(raw: string | null): VariantWidth | null {
  if (!raw) return null;
  const n = Number(raw);
  return (VARIANT_WIDTHS as readonly number[]).includes(n) ? (n as VariantWidth) : null;
}

export interface ImageVariant {
  buffer: Buffer;
  mimeType: string;
}

/**
 * Returns `source` resized to `width` (never enlarged), re-encoded as WebP.
 * `null` when sharp cannot decode the input at all, letting the caller fall
 * back to serving the original bytes untouched rather than 500-ing.
 */
export async function getImageVariant(source: Buffer, width: VariantWidth): Promise<ImageVariant | null> {
  try {
    const buffer = await sharp(source, { failOn: "none" })
      .rotate()
      .resize(width, undefined, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();
    return { buffer, mimeType: "image/webp" };
  } catch {
    return null;
  }
}
