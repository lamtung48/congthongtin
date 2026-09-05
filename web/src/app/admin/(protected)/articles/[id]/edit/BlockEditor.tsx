"use client";

import { useId } from "react";
import { MediaPicker, type MediaOption } from "../../MediaPicker";

/** One block being edited — a local `key` (never sent to the server) keyed
 *  by array position for React, plus the same `{type, data}` shape
 *  `articleBlockDataSchemas` (server-side) validates. Order is implicit:
 *  array index === block order, exactly like `ArticleBlockInput.order` when
 *  this gets sent to `articleService.update`. */
export interface EditorBlock {
  key: string;
  type: "PARAGRAPH" | "HEADING" | "IMAGE" | "GALLERY" | "YOUTUBE" | "QUOTE" | "TABLE" | "EMBED";
  data: Record<string, unknown>;
}

const BLOCK_TYPE_LABELS: Record<EditorBlock["type"], string> = {
  PARAGRAPH: "Đoạn văn",
  HEADING: "Tiêu đề phụ",
  IMAGE: "Ảnh",
  GALLERY: "Bộ sưu tập ảnh",
  YOUTUBE: "Video YouTube",
  QUOTE: "Trích dẫn",
  TABLE: "Bảng",
  EMBED: "Nhúng nội dung",
};

function defaultDataFor(type: EditorBlock["type"]): Record<string, unknown> {
  switch (type) {
    case "PARAGRAPH": return { runs: [{ text: "" }] };
    case "HEADING": return { level: 2, text: "" };
    case "IMAGE": return { mediaId: "", caption: "" };
    case "GALLERY": return { mediaIds: [], caption: "" };
    case "YOUTUBE": return { mediaId: "", title: "" };
    case "QUOTE": return { text: "", cite: "" };
    case "TABLE": return { caption: "", headers: ["Cột 1", "Cột 2"], rows: [["", ""]] };
    case "EMBED": return { provider: "", title: "", status: "missing", url: "" };
  }
}

function makeKey() {
  return Math.random().toString(36).slice(2, 10);
}

function BlockShell({
  index,
  total,
  typeLabel,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  children,
}: {
  index: number;
  total: number;
  typeLabel: string;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="adminCard adminCardPad" style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span className="adminBadge adminBadgeNeutral">{typeLabel}</span>
        <div style={{ display: "flex", gap: 4 }}>
          <button type="button" className="adminButton adminButtonSmall" onClick={onMoveUp} disabled={index === 0} aria-label="Di chuyển lên">↑</button>
          <button type="button" className="adminButton adminButtonSmall" onClick={onMoveDown} disabled={index === total - 1} aria-label="Di chuyển xuống">↓</button>
          <button type="button" className="adminButton adminButtonSmall" onClick={onDuplicate}>Nhân đôi</button>
          <button type="button" className="adminButton adminButtonSmall adminButtonDanger" onClick={onDelete}>Xoá</button>
        </div>
      </div>
      {children}
    </div>
  );
}

function ParagraphFields({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }) {
  const runs = (data.runs as { text: string; bold?: boolean; italic?: boolean }[]) ?? [{ text: "" }];
  const text = runs.map((r) => r.text).join("");
  const bold = !!runs[0]?.bold;
  const italic = !!runs[0]?.italic;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <textarea
        className="adminInput"
        rows={3}
        value={text}
        onChange={(e) => onChange({ runs: [{ text: e.target.value, bold, italic }] })}
        placeholder="Nội dung đoạn văn…"
      />
      <div style={{ display: "flex", gap: 16, fontSize: 12.5 }}>
        <label><input type="checkbox" checked={bold} onChange={(e) => onChange({ runs: [{ text, bold: e.target.checked, italic }] })} /> In đậm</label>
        <label><input type="checkbox" checked={italic} onChange={(e) => onChange({ runs: [{ text, bold, italic: e.target.checked }] })} /> Nghiêng</label>
      </div>
    </div>
  );
}

function HeadingFields({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <select className="adminSelect" value={String(data.level ?? 2)} onChange={(e) => onChange({ ...data, level: Number(e.target.value) })}>
        <option value="2">Heading 2</option>
        <option value="3">Heading 3</option>
      </select>
      <input className="adminInput" style={{ flex: 1 }} value={String(data.text ?? "")} onChange={(e) => onChange({ ...data, text: e.target.value })} placeholder="Nội dung tiêu đề…" />
    </div>
  );
}

function ImageFields({ data, onChange, mediaOptions }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void; mediaOptions: MediaOption[] }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <MediaPicker label="Ảnh" accept="IMAGE" value={(data.mediaId as string) || null} onChange={(id) => onChange({ ...data, mediaId: id ?? "" })} options={mediaOptions} />
      <input className="adminInput" value={String(data.caption ?? "")} onChange={(e) => onChange({ ...data, caption: e.target.value })} placeholder="Chú thích ảnh (tuỳ chọn)" />
    </div>
  );
}

function GalleryFields({ data, onChange, mediaOptions }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void; mediaOptions: MediaOption[] }) {
  const mediaIds = (data.mediaIds as string[]) ?? [];
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {mediaIds.map((id) => {
          const opt = mediaOptions.find((o) => o.id === id);
          return (
            <span key={id} className="adminBadge adminBadgeNeutral">
              {opt?.label ?? id}{" "}
              <button type="button" onClick={() => onChange({ ...data, mediaIds: mediaIds.filter((m) => m !== id) })} style={{ marginLeft: 4, cursor: "pointer", border: "none", background: "none" }} aria-label="Bỏ ảnh này">✕</button>
            </span>
          );
        })}
        {mediaIds.length === 0 && <span className="adminHint">Chưa có ảnh nào trong bộ sưu tập.</span>}
      </div>
      <MediaPicker
        label="Thêm ảnh vào bộ sưu tập"
        accept="IMAGE"
        value={null}
        onChange={(id) => { if (id && !mediaIds.includes(id)) onChange({ ...data, mediaIds: [...mediaIds, id] }); }}
        options={mediaOptions}
      />
      <input className="adminInput" value={String(data.caption ?? "")} onChange={(e) => onChange({ ...data, caption: e.target.value })} placeholder="Chú thích chung (tuỳ chọn)" />
    </div>
  );
}

function YoutubeFields({ data, onChange, mediaOptions }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void; mediaOptions: MediaOption[] }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <MediaPicker label="Video" accept="VIDEO" value={(data.mediaId as string) || null} onChange={(id) => onChange({ ...data, mediaId: id ?? "" })} options={mediaOptions} />
      <input className="adminInput" value={String(data.title ?? "")} onChange={(e) => onChange({ ...data, title: e.target.value })} placeholder="Tiêu đề video" />
    </div>
  );
}

function QuoteFields({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <textarea className="adminInput" rows={2} value={String(data.text ?? "")} onChange={(e) => onChange({ ...data, text: e.target.value })} placeholder="Nội dung trích dẫn…" />
      <input className="adminInput" value={String(data.cite ?? "")} onChange={(e) => onChange({ ...data, cite: e.target.value })} placeholder="Nguồn trích dẫn (tuỳ chọn)" />
    </div>
  );
}

function TableFields({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }) {
  const headers = (data.headers as string[]) ?? [];
  const rows = (data.rows as string[][]) ?? [];
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <input className="adminInput" value={String(data.caption ?? "")} onChange={(e) => onChange({ ...data, caption: e.target.value })} placeholder="Chú thích bảng (tuỳ chọn)" />
      <div className="adminTableWrap">
        <table className="adminTable">
          <thead>
            <tr>
              {headers.map((h, ci) => (
                <th key={ci}>
                  <input
                    className="adminInput"
                    style={{ fontSize: 12 }}
                    value={h}
                    onChange={(e) => {
                      const next = [...headers];
                      next[ci] = e.target.value;
                      onChange({ ...data, headers: next });
                    }}
                  />
                </th>
              ))}
              <th>
                <button type="button" className="adminButton adminButtonSmall" onClick={() => onChange({ ...data, headers: [...headers, `Cột ${headers.length + 1}`], rows: rows.map((r) => [...r, ""]) })}>+ Cột</button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci}>
                    <input
                      className="adminInput"
                      style={{ fontSize: 12 }}
                      value={cell}
                      onChange={(e) => {
                        const nextRows = rows.map((r) => [...r]);
                        nextRows[ri][ci] = e.target.value;
                        onChange({ ...data, rows: nextRows });
                      }}
                    />
                  </td>
                ))}
                <td>
                  <button type="button" className="adminButton adminButtonSmall adminButtonDanger" onClick={() => onChange({ ...data, rows: rows.filter((_, i) => i !== ri) })}>Xoá dòng</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="adminButton adminButtonSmall" onClick={() => onChange({ ...data, rows: [...rows, headers.map(() => "")] })}>+ Thêm dòng</button>
    </div>
  );
}

function EmbedFields({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }) {
  const url = String(data.url ?? "");
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <input className="adminInput" value={String(data.provider ?? "")} onChange={(e) => onChange({ ...data, provider: e.target.value })} placeholder="Nguồn nhúng (vd: Facebook, Form,…)" />
      <input className="adminInput" value={String(data.title ?? "")} onChange={(e) => onChange({ ...data, title: e.target.value })} placeholder="Tiêu đề nội dung nhúng" />
      <input
        className="adminInput"
        value={url}
        onChange={(e) => onChange({ ...data, url: e.target.value, status: e.target.value ? "ready" : "missing" })}
        placeholder="Đường dẫn nhúng (URL) — để trống nếu chưa có"
      />
      <span className="adminHint">Trạng thái: {url ? "Sẵn sàng" : "Chưa kết nối (sẽ hiện placeholder)"}</span>
    </div>
  );
}

function renderFields(block: EditorBlock, onChange: (d: Record<string, unknown>) => void, mediaOptions: MediaOption[]) {
  switch (block.type) {
    case "PARAGRAPH": return <ParagraphFields data={block.data} onChange={onChange} />;
    case "HEADING": return <HeadingFields data={block.data} onChange={onChange} />;
    case "IMAGE": return <ImageFields data={block.data} onChange={onChange} mediaOptions={mediaOptions} />;
    case "GALLERY": return <GalleryFields data={block.data} onChange={onChange} mediaOptions={mediaOptions} />;
    case "YOUTUBE": return <YoutubeFields data={block.data} onChange={onChange} mediaOptions={mediaOptions} />;
    case "QUOTE": return <QuoteFields data={block.data} onChange={onChange} />;
    case "TABLE": return <TableFields data={block.data} onChange={onChange} />;
    case "EMBED": return <EmbedFields data={block.data} onChange={onChange} />;
  }
}

/**
 * Brief section 5: builds exactly the 8 block types the public
 * `ArticleBody` renderer supports (`src/domain/articleContent.ts`) — the
 * `EditorBlock["type"]` union is closed to those 8, so there's no code path
 * that could add a 9th type the frontend can't render. Add/delete/reorder/
 * duplicate all operate on the plain `blocks` array the parent
 * (`ArticleEditor`) owns — this component has no state of its own besides
 * "which block type is about to be added", so autosave (which reads the
 * parent's `blocks` state) always sees the current content immediately.
 */
export function BlockEditor({
  blocks,
  onChange,
  mediaOptions,
}: {
  blocks: EditorBlock[];
  onChange: (blocks: EditorBlock[]) => void;
  mediaOptions: MediaOption[];
}) {
  const addSelectId = useId();

  function updateAt(index: number, data: Record<string, unknown>) {
    onChange(blocks.map((b, i) => (i === index ? { ...b, data } : b)));
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function duplicate(index: number) {
    const next = [...blocks];
    next.splice(index + 1, 0, { ...blocks[index], key: makeKey(), data: JSON.parse(JSON.stringify(blocks[index].data)) });
    onChange(next);
  }

  function remove(index: number) {
    onChange(blocks.filter((_, i) => i !== index));
  }

  function add(type: EditorBlock["type"]) {
    onChange([...blocks, { key: makeKey(), type, data: defaultDataFor(type) }]);
  }

  return (
    <div>
      {blocks.length === 0 && <p className="adminHint" style={{ marginBottom: 12 }}>Chưa có nội dung — thêm khối đầu tiên bên dưới.</p>}
      {blocks.map((block, index) => (
        <BlockShell
          key={block.key}
          index={index}
          total={blocks.length}
          typeLabel={BLOCK_TYPE_LABELS[block.type]}
          onMoveUp={() => move(index, -1)}
          onMoveDown={() => move(index, 1)}
          onDuplicate={() => duplicate(index)}
          onDelete={() => remove(index)}
        >
          {renderFields(block, (d) => updateAt(index, d), mediaOptions)}
        </BlockShell>
      ))}

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
        <label className="adminHint" htmlFor={addSelectId}>Thêm khối:</label>
        <select id={addSelectId} className="adminSelect" defaultValue="" onChange={(e) => { if (e.target.value) { add(e.target.value as EditorBlock["type"]); e.target.value = ""; } }}>
          <option value="" disabled>Chọn loại khối…</option>
          {(Object.keys(BLOCK_TYPE_LABELS) as EditorBlock["type"][]).map((t) => (
            <option key={t} value={t}>{BLOCK_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
