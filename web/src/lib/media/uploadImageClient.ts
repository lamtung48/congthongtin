/** Trimmed to what the rich-text editor needs to register a media option +
 *  insert an `articleImage` node. Structurally a `MediaOption` plus alt/caption. */
export interface ImportedImage {
  id: string;
  label: string;
  previewUrl: string;
  alt: string | null;
  caption: string | null;
}

function toOption(m: {
  id: string;
  filename?: string | null;
  alt?: string | null;
  caption?: string | null;
}): ImportedImage {
  return {
    id: m.id,
    label: m.alt || m.caption || m.filename || m.id,
    previewUrl: `/api/media/${m.id}`,
    alt: m.alt ?? null,
    caption: m.caption ?? null,
  };
}

async function post(url: string, init: RequestInit): Promise<ImportedImage> {
  const res = await fetch(url, init);
  const body = (await res.json().catch(() => null)) as { media?: { id: string }; error?: string } | null;
  if (!res.ok || !body?.media?.id) {
    throw new Error(body?.error ?? `Tải ảnh thất bại (HTTP ${res.status}).`);
  }
  return toOption(body.media as Parameters<typeof toOption>[0]);
}

/** Upload a local `File` (drag-drop onto the editor, or a pasted screenshot). */
export function uploadImageFile(file: File, nameHint?: string): Promise<ImportedImage> {
  const fd = new FormData();
  fd.append("file", file);
  if (nameHint?.trim()) fd.append("nameHint", nameHint.trim());
  return post("/api/admin/media/upload", { method: "POST", body: fd });
}

/** Pull an image from a `data:` URI or a remote `http(s)` URL (pasting an
 *  article whose `<img>`s point elsewhere) into Drive. */
export function importImageFromUrl(url: string, nameHint?: string): Promise<ImportedImage> {
  return post("/api/admin/media/import-url", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url, nameHint }),
  });
}
