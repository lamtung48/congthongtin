import "server-only";
import sharp from "sharp";
import { VARIANT_WIDTHS, type VariantWidth } from "@/lib/media/variantWidths";

/**
 * Resized copies of a stored image, so a 300px-wide card stops downloading
 * the full 1600px original. Every variant is derived, never authoritative —
 * the original on Drive stays the only stored copy.
 *
 * Cached in memory rather than on disk deliberately: this app writes no
 * temp files anywhere else (see `googleDrive.ts`), and an unbounded on-disk
 * cache is a disk-budget risk on a shared VPS. Variants are small (tens of
 * KB), so a modest byte budget holds the whole site's working set, and
 * anything evicted is simply regenerated on the next request.
 */

/** A closed set, not an arbitrary `?w=`: otherwise a crawler asking for 1000
 *  distinct widths would evict the real working set and burn CPU re-encoding
 *  on every request. Shared with the client component that builds `srcset`. */
export { VARIANT_WIDTHS, type VariantWidth } from "@/lib/media/variantWidths";

export function parseVariantWidth(raw: string | null): VariantWidth | null {
  if (!raw) return null;
  const n = Number(raw);
  return (VARIANT_WIDTHS as readonly number[]).includes(n) ? (n as VariantWidth) : null;
}

const MAX_CACHE_BYTES = 64 * 1024 * 1024;

interface Entry {
  buffer: Buffer;
  mimeType: string;
}

// Insertion-ordered Map used as an LRU: a hit re-inserts the key at the end,
// so eviction from the front always drops the least recently used variant.
const cache = new Map<string, Entry>();
let cacheBytes = 0;

function cacheGet(key: string): Entry | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

function cacheSet(key: string, entry: Entry): void {
  if (cache.has(key)) cacheBytes -= cache.get(key)!.buffer.byteLength;
  cache.set(key, entry);
  cacheBytes += entry.buffer.byteLength;
  while (cacheBytes > MAX_CACHE_BYTES) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    cacheBytes -= cache.get(oldest.value)!.buffer.byteLength;
    cache.delete(oldest.value);
  }
}

/**
 * Returns the image resized to `width` (never enlarged), re-encoded as WebP.
 * `null` when sharp cannot decode the input at all, letting the caller fall
 * back to serving the original bytes untouched rather than 500-ing.
 */
export async function getImageVariant(cacheKey: string, source: Buffer, width: VariantWidth): Promise<Entry | null> {
  const key = `${cacheKey}@${width}`;
  const hit = cacheGet(key);
  if (hit) return hit;

  try {
    const buffer = await sharp(source, { failOn: "none" })
      .rotate()
      .resize(width, undefined, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();
    const entry: Entry = { buffer, mimeType: "image/webp" };
    cacheSet(key, entry);
    return entry;
  } catch {
    return null;
  }
}
