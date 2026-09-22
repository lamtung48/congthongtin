import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename, stat, readdir, unlink, utimes } from "node:fs/promises";
import path from "node:path";

/**
 * Shared, persistent cache for the bytes `/api/media/[mediaId]` serves.
 *
 * Before this, every image request — even an immediate repeat — made a full
 * Google Drive round trip (measured at ~1.5–4s per image on the VPS),
 * because the only cache was an in-process LRU that (a) lived exactly one
 * process deep and was wiped on every redeploy, and (b) was consulted
 * *after* the original had already been pulled from Drive, so it only ever
 * saved the `sharp` re-encode, never the fetch. With ~13 images on the
 * homepage that was the whole "trang load rất chậm".
 *
 * Two tiers:
 *  - L1: an in-process byte-budgeted LRU (sub-ms, small, lost on restart).
 *  - L2: files under `MEDIA_CACHE_DIR`, meant to be a Docker volume so it
 *        survives restart and redeploy. A `MediaAsset` id's bytes never
 *        change in place (replacing an image makes a new asset row + new
 *        Drive file) and the `?w=` width set is closed, so an entry is valid
 *        forever — eviction is purely a disk-budget concern, handled by a
 *        cheap size-capped LRU sweep keyed on mtime.
 *
 * Every failure here is swallowed: a cache miss, a broken cache dir or a
 * failed write must never turn into a failed media request.
 */

const CACHE_DIR = process.env.MEDIA_CACHE_DIR || path.join(process.cwd(), ".media-cache");
const MAX_DISK_BYTES = Number(process.env.MEDIA_CACHE_MAX_BYTES) || 512 * 1024 * 1024;
/** An entry larger than this is served but never stored — keeps one stray
 *  un-resized legacy original from evicting the whole working set. */
export const MEDIA_CACHE_MAX_ENTRY_BYTES = Number(process.env.MEDIA_CACHE_MAX_ENTRY_BYTES) || 8 * 1024 * 1024;
const MAX_MEM_BYTES = 64 * 1024 * 1024;

export interface CachedMedia {
  buffer: Buffer;
  contentType: string;
}

// --- L1: in-process LRU ----------------------------------------------------
// Insertion-ordered Map as an LRU: a hit re-inserts the key at the end, so
// eviction from the front always drops the least recently used entry.
const mem = new Map<string, CachedMedia>();
let memBytes = 0;

function memGet(key: string): CachedMedia | undefined {
  const hit = mem.get(key);
  if (!hit) return undefined;
  mem.delete(key);
  mem.set(key, hit);
  return hit;
}

function memSet(key: string, entry: CachedMedia): void {
  if (mem.has(key)) memBytes -= mem.get(key)!.buffer.byteLength;
  mem.set(key, entry);
  memBytes += entry.buffer.byteLength;
  while (memBytes > MAX_MEM_BYTES) {
    const oldest = mem.keys().next();
    if (oldest.done) break;
    memBytes -= mem.get(oldest.value)!.buffer.byteLength;
    mem.delete(oldest.value);
  }
}

// --- L2: disk ------------------------------------------------------------
/** Hash the key: asset ids are cuid (`[a-z0-9]`) and the width suffix is
 *  `@wNNN`, but hashing means a surprising key can never escape `CACHE_DIR`
 *  or collide with the `.meta` sidecar naming. */
function fileFor(key: string): string {
  return path.join(CACHE_DIR, createHash("sha1").update(key).digest("hex"));
}

let dirReady: Promise<void> | undefined;
function ensureDir(): Promise<void> {
  dirReady ??= mkdir(CACHE_DIR, { recursive: true }).then(() => undefined);
  return dirReady;
}

async function get(key: string): Promise<CachedMedia | undefined> {
  const l1 = memGet(key);
  if (l1) return l1;
  try {
    await ensureDir();
    const base = fileFor(key);
    const [buffer, metaRaw] = await Promise.all([readFile(base), readFile(`${base}.meta`, "utf8")]);
    const contentType = (JSON.parse(metaRaw).ct as string) || "application/octet-stream";
    const entry: CachedMedia = { buffer, contentType };
    memSet(key, entry);
    // Bump recency for the disk sweep's LRU ordering (fire and forget).
    const now = new Date();
    void utimes(base, now, now).catch(() => {});
    return entry;
  } catch {
    return undefined;
  }
}

async function set(key: string, buffer: Buffer, contentType: string): Promise<void> {
  if (buffer.byteLength > MEDIA_CACHE_MAX_ENTRY_BYTES) return;
  memSet(key, { buffer, contentType });
  try {
    await ensureDir();
    const base = fileFor(key);
    const tmp = `${base}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
    await writeFile(tmp, buffer);
    await rename(tmp, base); // atomic: a reader never sees a half-written file
    await writeFile(`${base}.meta`, JSON.stringify({ ct: contentType, k: key }));
    void sweep();
  } catch {
    // A cache write failing must never fail the request.
  }
}

let sweeping = false;
/** Drop the oldest payload files (with their `.meta`) until the cache dir is
 *  back under 90% of budget. Also clears stray `.tmp` files from a write
 *  that crashed mid-flight. Runs at most once at a time. */
async function sweep(): Promise<void> {
  if (sweeping) return;
  sweeping = true;
  try {
    const names = await readdir(CACHE_DIR);
    const payloads: { path: string; size: number; mtime: number }[] = [];
    let total = 0;
    for (const name of names) {
      const full = path.join(CACHE_DIR, name);
      try {
        const s = await stat(full);
        if (!s.isFile()) continue;
        if (name.endsWith(".tmp")) {
          await unlink(full).catch(() => {});
          continue;
        }
        if (name.endsWith(".meta")) continue;
        payloads.push({ path: full, size: s.size, mtime: s.mtimeMs });
        total += s.size;
      } catch {
        /* raced with another sweep / eviction */
      }
    }
    if (total <= MAX_DISK_BYTES) return;
    payloads.sort((a, b) => a.mtime - b.mtime); // oldest first
    const target = MAX_DISK_BYTES * 0.9;
    for (const p of payloads) {
      if (total <= target) break;
      await unlink(p.path).catch(() => {});
      await unlink(`${p.path}.meta`).catch(() => {});
      total -= p.size;
    }
  } catch {
    /* cache dir unreadable — nothing to do */
  } finally {
    sweeping = false;
  }
}

export const mediaCache = { get, set };
