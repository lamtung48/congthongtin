"use client";

import { useState } from "react";
import { Extension, Node, mergeAttributes, type Editor } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent, type NodeViewProps } from "@tiptap/react";
import { Fragment, type Node as PMNode } from "@tiptap/pm/model";
import { MediaPicker, type MediaOption } from "../../../MediaPicker";
import { VideoPicker, type VideoOption } from "../../../VideoPicker";

/**
 * The rich-text editor's non-text block types, each a custom TipTap node
 * with its own React `NodeView` — this is what makes "sửa trực tiếp text,
 * embed ảnh và clip vào trong cùng một khung" literal: an image/gallery/
 * video/table/quote/embed renders as an actual visual card inline in the
 * document flow the editor already shows, not a separate form bolted onto
 * the side. `blockConversion.ts` is the only other file that needs to know
 * these node type names — it's the sole place translating to/from the
 * `EditorBlock`/`ArticleBlockInput` shape `articleService` still expects
 * completely unchanged by this rewrite.
 *
 * | Node name         | ArticleBlock type | Attrs                              |
 * |-------------------|--------------------|-------------------------------------|
 * | `articleImage`    | `IMAGE`            | `mediaId`, `caption`                |
 * | `articleGallery`  | `GALLERY`          | `mediaIds` (string[]), `caption`    |
 * | `articleYoutube`  | `YOUTUBE`          | `mediaId`, `title`                  |
 * | `articleQuote`    | `QUOTE`            | `cite` (attr) + text content (body) |
 * | `articleTable`    | `TABLE`            | `caption`, `headers`, `rows`        |
 * | `articleEmbed`    | `EMBED`            | `provider`, `title`, `url`, `aspectRatio` |
 *
 * All but `articleQuote` are `atom` nodes (no ProseMirror-editable content
 * of their own — every field inside them is a plain React-controlled input
 * driven through `updateAttributes`, never part of the document's text
 * flow). `articleQuote` has real editable inline text (`content: "text*"`,
 * `marks: ""` — plain text only, matching `QuoteBlock.text: string`, no
 * bold/italic to strip on save).
 */

// ---------------------------------------------------------------------------
// Shared cross-node media registry
// ---------------------------------------------------------------------------

export interface ArticleMediaStorage {
  mediaOptions: MediaOption[];
  /** Seeded once at editor creation, same as `mediaOptions` — unlike
   *  images, a video linked/uploaded from one `articleYoutube` node isn't
   *  broadcast to sibling YouTube blocks in the same document (no
   *  `registerVideoOption` equivalent exists); each `VideoPicker` instance
   *  just grows its own local list, same as `MediaPicker` did before the
   *  cross-node registry existed. Documented as a known limitation — see
   *  docs/YOUTUBE_INTEGRATION.md. */
  videoOptions: VideoOption[];
  canManageMediaAny: boolean;
  /** Whether *this* actor may upload a new video at all — Contributor's
   *  own `media.manage.own` plus the deployment-wide policy env var (see
   *  `youtubeService.isContributorVideoUploadAllowed`). Computed once
   *  server-side and threaded through here rather than re-derived per
   *  node view. */
  canUploadVideo: boolean;
}

declare module "@tiptap/core" {
  interface Storage {
    articleMediaRegistry: ArticleMediaStorage;
  }
}

/**
 * One list of known `MediaAsset`s shared by every image/gallery/youtube
 * node view in this document, held in TipTap's own `editor.storage` (a
 * plain mutable object, not React state) — `ReactNodeViewRenderer` mounts
 * each node view outside the surrounding React tree, so a React Context
 * provided by `ArticleContentEditor` would never reach them. Mutating this
 * object directly and then dispatching an empty transaction (see
 * `registerMediaOption`) is the standard TipTap idiom for "external state a
 * node view needs to react to": every mounted node view re-renders on any
 * transaction, so it always reads the current array on its next render.
 */
export const ArticleMediaRegistry = Extension.create<
  { initialMediaOptions: MediaOption[]; initialVideoOptions: VideoOption[]; canManageMediaAny: boolean; canUploadVideo: boolean },
  ArticleMediaStorage
>({
  name: "articleMediaRegistry",
  addOptions() {
    return { initialMediaOptions: [], initialVideoOptions: [], canManageMediaAny: false, canUploadVideo: false };
  },
  addStorage() {
    return {
      mediaOptions: this.options.initialMediaOptions,
      videoOptions: this.options.initialVideoOptions,
      canManageMediaAny: this.options.canManageMediaAny,
      canUploadVideo: this.options.canUploadVideo,
    };
  },
});

/** Called by a node view whenever its embedded `MediaPicker` uploads or
 *  manually links a brand-new asset — makes it visible to every other
 *  embedded picker in the same document immediately, without which a
 *  second image block wouldn't show a photo just uploaded from the first
 *  one until the page reloads. */
export function registerMediaOption(editor: Editor, option: MediaOption) {
  const storage = editor.storage.articleMediaRegistry as ArticleMediaStorage;
  if (!storage.mediaOptions.some((o) => o.id === option.id)) {
    storage.mediaOptions = [option, ...storage.mediaOptions];
  }
  editor.view.dispatch(editor.state.tr);
}

/** Swaps this top-level node with its previous/next sibling — the ↑/↓
 *  controls on every complex node view. Rebuilding the whole top-level
 *  fragment with two entries swapped, rather than a delete+reinsert at
 *  computed positions, sidesteps every off-by-one risk position math would
 *  otherwise carry; an article's block count is small enough that this
 *  costs nothing worth optimizing. */
export function moveTopLevelNode(editor: Editor, pos: number, direction: -1 | 1) {
  const { state } = editor;
  const nodes: { node: PMNode; pos: number }[] = [];
  state.doc.forEach((node, offset) => nodes.push({ node, pos: offset }));
  const currentIndex = nodes.findIndex((n) => n.pos === pos);
  if (currentIndex === -1) return;
  const targetIndex = currentIndex + direction;
  if (targetIndex < 0 || targetIndex >= nodes.length) return;
  const reordered = nodes.map((n) => n.node);
  [reordered[currentIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[currentIndex]];
  const tr = state.tr.replaceWith(0, state.doc.content.size, Fragment.fromArray(reordered));
  editor.view.dispatch(tr);
}

// ---------------------------------------------------------------------------
// Shared chrome for atom (non-text) node views
// ---------------------------------------------------------------------------

function NodeChrome({
  editor,
  getPos,
  deleteNode,
  label,
  children,
}: {
  editor: Editor;
  getPos: () => number | undefined;
  deleteNode: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <NodeViewWrapper className="richNode" contentEditable={false}>
      <div className="richNodeToolbar">
        <span className="richNodeLabel">{label}</span>
        <div className="richNodeActions">
          <button
            type="button"
            className="adminButton adminButtonSmall"
            onClick={() => {
              const pos = getPos();
              if (pos !== undefined) moveTopLevelNode(editor, pos, -1);
            }}
            aria-label="Di chuyển lên"
          >
            ↑
          </button>
          <button
            type="button"
            className="adminButton adminButtonSmall"
            onClick={() => {
              const pos = getPos();
              if (pos !== undefined) moveTopLevelNode(editor, pos, 1);
            }}
            aria-label="Di chuyển xuống"
          >
            ↓
          </button>
          <button type="button" className="adminButton adminButtonSmall adminButtonDanger" onClick={deleteNode} aria-label="Xoá khối">
            ✕
          </button>
        </div>
      </div>
      {children}
    </NodeViewWrapper>
  );
}

// ---------------------------------------------------------------------------
// articleImage
// ---------------------------------------------------------------------------

function ArticleImageView({ node, updateAttributes, deleteNode, getPos, editor }: NodeViewProps) {
  const mediaId = (node.attrs.mediaId as string) || "";
  const caption = (node.attrs.caption as string) || "";
  const storage = editor.storage.articleMediaRegistry as ArticleMediaStorage;
  const [picking, setPicking] = useState(!mediaId);
  const option = storage.mediaOptions.find((o) => o.id === mediaId);

  return (
    <NodeChrome editor={editor} getPos={getPos} deleteNode={deleteNode} label="Ảnh">
      {picking || !mediaId ? (
        <MediaPicker
          label="Chọn ảnh"
          value={mediaId || null}
          onChange={(id, newOption) => {
            if (!id) return;
            if (newOption) registerMediaOption(editor, newOption);
            updateAttributes({ mediaId: id });
            setPicking(false);
          }}
          options={storage.mediaOptions}
          canManageAny={storage.canManageMediaAny}
        />
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {option?.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- editor-only preview of a Drive-hosted asset, not a public page image
            <img src={option.previewUrl} alt={caption || option.label} className="richImagePreview" />
          ) : (
            <div className="richImagePlaceholder">{option?.label ?? mediaId}</div>
          )}
          <input
            className="adminInput"
            placeholder="Chú thích ảnh (tuỳ chọn)"
            value={caption}
            onChange={(e) => updateAttributes({ caption: e.target.value })}
          />
          <button type="button" className="adminButton adminButtonSmall" onClick={() => setPicking(true)}>
            Đổi ảnh
          </button>
        </div>
      )}
    </NodeChrome>
  );
}

export const ArticleImage = Node.create({
  name: "articleImage",
  group: "block",
  atom: true,
  addAttributes() {
    return { mediaId: { default: "" }, caption: { default: "" } };
  },
  parseHTML() {
    return [{ tag: "div[data-article-image]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-article-image": "" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ArticleImageView);
  },
});

// ---------------------------------------------------------------------------
// articleGallery
// ---------------------------------------------------------------------------

function ArticleGalleryView({ node, updateAttributes, deleteNode, getPos, editor }: NodeViewProps) {
  const mediaIds = (node.attrs.mediaIds as string[]) || [];
  const caption = (node.attrs.caption as string) || "";
  const storage = editor.storage.articleMediaRegistry as ArticleMediaStorage;

  return (
    <NodeChrome editor={editor} getPos={getPos} deleteNode={deleteNode} label="Bộ sưu tập ảnh">
      <div className="richGalleryStrip">
        {mediaIds.map((id) => {
          const option = storage.mediaOptions.find((o) => o.id === id);
          return (
            <div key={id} className="richGalleryItem">
              {option?.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- editor-only preview
                <img src={option.previewUrl} alt={option.label} />
              ) : (
                <div className="richImagePlaceholder richGalleryPlaceholder">{option?.label ?? id}</div>
              )}
              <button
                type="button"
                className="richGalleryRemove"
                onClick={() => updateAttributes({ mediaIds: mediaIds.filter((m) => m !== id) })}
                aria-label="Bỏ ảnh này"
              >
                ✕
              </button>
            </div>
          );
        })}
        {mediaIds.length === 0 && <span className="adminHint">Chưa có ảnh nào — thêm ảnh bên dưới.</span>}
      </div>
      <MediaPicker
        label="Thêm ảnh vào bộ sưu tập"
        value={null}
        onChange={(id, newOption) => {
          if (!id) return;
          if (newOption) registerMediaOption(editor, newOption);
          if (!mediaIds.includes(id)) updateAttributes({ mediaIds: [...mediaIds, id] });
        }}
        options={storage.mediaOptions}
        canManageAny={storage.canManageMediaAny}
      />
      <input
        className="adminInput"
        placeholder="Chú thích chung (tuỳ chọn)"
        value={caption}
        onChange={(e) => updateAttributes({ caption: e.target.value })}
      />
    </NodeChrome>
  );
}

export const ArticleGallery = Node.create({
  name: "articleGallery",
  group: "block",
  atom: true,
  addAttributes() {
    return { mediaIds: { default: [] as string[] }, caption: { default: "" } };
  },
  parseHTML() {
    return [{ tag: "div[data-article-gallery]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-article-gallery": "" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ArticleGalleryView);
  },
});

// ---------------------------------------------------------------------------
// articleYoutube
// ---------------------------------------------------------------------------

function ArticleYoutubeView({ node, updateAttributes, deleteNode, getPos, editor }: NodeViewProps) {
  const mediaId = (node.attrs.mediaId as string) || "";
  const title = (node.attrs.title as string) || "";
  const storage = editor.storage.articleMediaRegistry as ArticleMediaStorage;
  const [picking, setPicking] = useState(!mediaId);
  const option = storage.videoOptions.find((o) => o.id === mediaId);

  return (
    <NodeChrome editor={editor} getPos={getPos} deleteNode={deleteNode} label="Video YouTube">
      {picking || !mediaId ? (
        <VideoPicker
          label="Chọn video"
          value={mediaId || null}
          onChange={(id) => {
            if (!id) return;
            updateAttributes({ mediaId: id });
            setPicking(false);
          }}
          options={storage.videoOptions}
          canManageAny={storage.canManageMediaAny}
          canUpload={storage.canUploadVideo}
        />
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {option?.videoId ? (
            // eslint-disable-next-line @next/next/no-img-element -- a public YouTube thumbnail URL, not a local asset
            <img src={`https://img.youtube.com/vi/${option.videoId}/mqdefault.jpg`} alt={title || option.label} className="richImagePreview" style={{ maxWidth: 320 }} />
          ) : (
            <div className="richVideoBadge">▶ {option?.label ?? mediaId}</div>
          )}
          <input
            className="adminInput"
            placeholder="Tiêu đề video"
            value={title}
            onChange={(e) => updateAttributes({ title: e.target.value })}
          />
          <button type="button" className="adminButton adminButtonSmall" onClick={() => setPicking(true)}>
            Đổi video
          </button>
        </div>
      )}
    </NodeChrome>
  );
}

export const ArticleYoutube = Node.create({
  name: "articleYoutube",
  group: "block",
  atom: true,
  addAttributes() {
    return { mediaId: { default: "" }, title: { default: "" } };
  },
  parseHTML() {
    return [{ tag: "div[data-article-youtube]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-article-youtube": "" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ArticleYoutubeView);
  },
});

// ---------------------------------------------------------------------------
// articleQuote — the one non-atom custom node (has real editable text)
// ---------------------------------------------------------------------------

function ArticleQuoteView({ node, updateAttributes, deleteNode, getPos, editor }: NodeViewProps) {
  const cite = (node.attrs.cite as string) || "";
  return (
    <NodeViewWrapper className="richNode richQuoteNode">
      <div className="richNodeToolbar" contentEditable={false}>
        <span className="richNodeLabel">Trích dẫn</span>
        <div className="richNodeActions">
          <button
            type="button"
            className="adminButton adminButtonSmall"
            onClick={() => {
              const pos = getPos();
              if (pos !== undefined) moveTopLevelNode(editor, pos, -1);
            }}
            aria-label="Di chuyển lên"
          >
            ↑
          </button>
          <button
            type="button"
            className="adminButton adminButtonSmall"
            onClick={() => {
              const pos = getPos();
              if (pos !== undefined) moveTopLevelNode(editor, pos, 1);
            }}
            aria-label="Di chuyển xuống"
          >
            ↓
          </button>
          <button type="button" className="adminButton adminButtonSmall adminButtonDanger" onClick={deleteNode} aria-label="Xoá khối">
            ✕
          </button>
        </div>
      </div>
      <blockquote className="richQuote">
        <NodeViewContent className="richQuoteText" />
        <div contentEditable={false}>
          <input
            className="adminInput"
            placeholder="Nguồn trích dẫn (tuỳ chọn)"
            value={cite}
            onChange={(e) => updateAttributes({ cite: e.target.value })}
          />
        </div>
      </blockquote>
    </NodeViewWrapper>
  );
}

export const ArticleQuote = Node.create({
  name: "articleQuote",
  group: "block",
  content: "text*",
  marks: "",
  addAttributes() {
    return { cite: { default: "" } };
  },
  parseHTML() {
    return [{ tag: "blockquote[data-article-quote]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["blockquote", mergeAttributes(HTMLAttributes, { "data-article-quote": "" }), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ArticleQuoteView);
  },
});

// ---------------------------------------------------------------------------
// articleTable
// ---------------------------------------------------------------------------

function ArticleTableView({ node, updateAttributes, deleteNode, getPos, editor }: NodeViewProps) {
  const caption = (node.attrs.caption as string) || "";
  const headers = (node.attrs.headers as string[]) || [];
  const rows = (node.attrs.rows as string[][]) || [];

  return (
    <NodeChrome editor={editor} getPos={getPos} deleteNode={deleteNode} label="Bảng">
      <input
        className="adminInput"
        placeholder="Chú thích bảng (tuỳ chọn)"
        value={caption}
        onChange={(e) => updateAttributes({ caption: e.target.value })}
        style={{ marginBottom: 8 }}
      />
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
                      updateAttributes({ headers: next });
                    }}
                  />
                </th>
              ))}
              <th>
                <button
                  type="button"
                  className="adminButton adminButtonSmall"
                  onClick={() => updateAttributes({ headers: [...headers, `Cột ${headers.length + 1}`], rows: rows.map((r) => [...r, ""]) })}
                >
                  + Cột
                </button>
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
                        updateAttributes({ rows: nextRows });
                      }}
                    />
                  </td>
                ))}
                <td>
                  <button
                    type="button"
                    className="adminButton adminButtonSmall adminButtonDanger"
                    onClick={() => updateAttributes({ rows: rows.filter((_, i) => i !== ri) })}
                  >
                    Xoá dòng
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="adminButton adminButtonSmall"
        onClick={() => updateAttributes({ rows: [...rows, headers.map(() => "")] })}
        style={{ marginTop: 8 }}
      >
        + Thêm dòng
      </button>
    </NodeChrome>
  );
}

export const ArticleTable = Node.create({
  name: "articleTable",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      caption: { default: "" },
      headers: { default: ["Cột 1", "Cột 2"] as string[] },
      rows: { default: [["", ""]] as string[][] },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-article-table]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-article-table": "" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ArticleTableView);
  },
});

// ---------------------------------------------------------------------------
// articleEmbed
// ---------------------------------------------------------------------------

function ArticleEmbedView({ node, updateAttributes, deleteNode, getPos, editor }: NodeViewProps) {
  const provider = (node.attrs.provider as string) || "";
  const title = (node.attrs.title as string) || "";
  const url = (node.attrs.url as string) || "";

  return (
    <NodeChrome editor={editor} getPos={getPos} deleteNode={deleteNode} label="Nhúng nội dung">
      <div style={{ display: "grid", gap: 8 }}>
        <input
          className="adminInput"
          placeholder="Nguồn nhúng (vd: Facebook, Form,…)"
          value={provider}
          onChange={(e) => updateAttributes({ provider: e.target.value })}
        />
        <input
          className="adminInput"
          placeholder="Tiêu đề nội dung nhúng"
          value={title}
          onChange={(e) => updateAttributes({ title: e.target.value })}
        />
        <input
          className="adminInput"
          placeholder="Đường dẫn nhúng (URL) — để trống nếu chưa có"
          value={url}
          onChange={(e) => updateAttributes({ url: e.target.value })}
        />
        <span className="adminHint">Trạng thái: {url ? "Sẵn sàng" : "Chưa kết nối (sẽ hiện placeholder)"}</span>
      </div>
    </NodeChrome>
  );
}

export const ArticleEmbed = Node.create({
  name: "articleEmbed",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      provider: { default: "" },
      title: { default: "" },
      url: { default: "" },
      aspectRatio: { default: null as number | null },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-article-embed]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-article-embed": "" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ArticleEmbedView);
  },
});
