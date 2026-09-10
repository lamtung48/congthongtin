import "server-only";

/**
 * Fetches an image referenced by URL (or decodes a `data:` URI) into a
 * Buffer, ready for `storeImageBuffer`. Shared by the editor's
 * "chèn ảnh theo link" route (`/api/admin/media/import-url`) and the
 * external-content collector's convert step (`socialInboxService`), so the
 * SSRF guards below are written and reviewed exactly once.
 *
 * The URL is always attacker-influenced (a pasted link, or an `<img src>`
 * scraped off a third-party news page), so: http(s) only, blocked against
 * loopback / link-local / RFC1918 / CGNAT / ULA hosts, redirects followed
 * manually with every hop re-checked against the same host rules, capped at
 * `MAX_IMAGE_BYTES`, and time-boxed. Not hardened against DNS rebinding —
 * acceptable at this trust level (authenticated internal tooling); revisit
 * if either caller is ever exposed more widely.
 */

export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10_000;

export type FetchImageResult =
  | { ok: true; buffer: Buffer; nameHint: string }
  | { ok: false; error: string; status: number };

export function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  if (h === "::1" || h === "[::1]") return true;
  if (/^\[?(fc|fd|fe80|::1)/.test(h)) return true;
  return false;
}

function bufferFromDataUri(uri: string): Buffer | null {
  const m = /^data:([^;,]*)?(;base64)?,([\s\S]*)$/.exec(uri);
  if (!m) return null;
  try {
    return m[2] ? Buffer.from(m[3], "base64") : Buffer.from(decodeURIComponent(m[3]), "binary");
  } catch {
    return null;
  }
}

/** Filename stem from the URL path (`.../tp-tp-9395.jpg.avif` -> `tp-tp-9395`),
 *  used only when the caller has no better name for the file. */
function stemFromUrl(u: URL): string {
  const last = u.pathname.split("/").pop() ?? "";
  return last.replace(/(\.[a-z0-9]+)+$/i, "") || "anh";
}

/**
 * `nameHint` is what the caller wants the Drive file named after (the
 * article title, typically) — it is returned untouched when given, so the
 * URL's own filename is only ever a last resort.
 */
export async function fetchRemoteImage(rawUrl: string, nameHint?: string): Promise<FetchImageResult> {
  if (rawUrl.startsWith("data:")) {
    const buffer = bufferFromDataUri(rawUrl);
    if (!buffer) return { ok: false, error: "Dữ liệu ảnh dán vào không hợp lệ.", status: 400 };
    return { ok: true, buffer, nameHint: nameHint ?? "anh" };
  }

  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return { ok: false, error: "Địa chỉ ảnh không hợp lệ.", status: 400 };
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return { ok: false, error: "Chỉ hỗ trợ ảnh qua http(s).", status: 400 };
    }
    if (isBlockedHost(u.hostname)) {
      return { ok: false, error: "Không cho phép tải ảnh từ địa chỉ nội bộ.", status: 400 };
    }

    let res: Response;
    try {
      res = await fetch(u, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "user-agent": "HSV-Portal-ImageImport/1.0", accept: "image/*" },
      });
    } catch (err) {
      const error =
        err instanceof Error && err.name === "TimeoutError"
          ? "Hết thời gian chờ khi tải ảnh."
          : "Không kết nối được tới địa chỉ ảnh.";
      return { ok: false, error, status: 502 };
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return { ok: false, error: "Không tải được ảnh (chuyển hướng không hợp lệ).", status: 502 };
      try {
        u = new URL(location, u);
      } catch {
        return { ok: false, error: "Không tải được ảnh (chuyển hướng không hợp lệ).", status: 502 };
      }
      continue;
    }

    if (!res.ok) return { ok: false, error: `Không tải được ảnh (HTTP ${res.status}).`, status: 502 };

    const ct = res.headers.get("content-type") ?? "";
    if (!ct.startsWith("image/")) {
      return { ok: false, error: "Liên kết không trỏ tới một tệp ảnh.", status: 415 };
    }
    if (Number(res.headers.get("content-length") ?? 0) > MAX_IMAGE_BYTES) {
      return { ok: false, error: "Ảnh vượt quá 12MB.", status: 413 };
    }
    const ab = await res.arrayBuffer();
    if (ab.byteLength > MAX_IMAGE_BYTES) {
      return { ok: false, error: "Ảnh vượt quá 12MB.", status: 413 };
    }
    return { ok: true, buffer: Buffer.from(ab), nameHint: nameHint ?? stemFromUrl(u) };
  }

  return { ok: false, error: "Ảnh bị chuyển hướng quá nhiều lần.", status: 502 };
}
