"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import type { MediaOption } from "../../MediaPicker";
import type { VideoOption } from "../../VideoPicker";
import { ArticleImage, ArticleGallery, ArticleYoutube, ArticleQuote, ArticleTable, ArticleEmbed, ArticleMediaRegistry } from "./tiptap/nodes";
import { blocksToDoc, docToBlocks, type EditorBlock } from "./tiptap/blockConversion";

export type { EditorBlock, ArticleBlockType } from "./tiptap/blockConversion";

/**
 * Brief (this task): "Sửa trực tiếp text, embed ảnh và clip vào trong cùng
 * một khung" — replaces the old `BlockEditor.tsx`'s "pick a block type from
 * a dropdown, fill in a separate form" model with a single scrolling,
 * WYSIWYG surface (TipTap/ProseMirror): type paragraphs and headings
 * directly, with bold/italic/link marks applied inline, and insert an
 * image/gallery/video/quote/table/embed at the cursor — each rendering as
 * an actual visual card (a real photo thumbnail, not a dropdown) right
 * there in the flow. See `tiptap/nodes.tsx`'s header comment for the full
 * node-type table and `tiptap/blockConversion.ts` for the two pure
 * functions that keep this editor's document and `articleService`'s
 * `EditorBlock[]`/`ArticleBlockInput[]` contract in exact sync — nothing
 * server-side changed for this rewrite; only how an editor produces that
 * same shape did.
 *
 * The `blocks` prop seeds the document once at mount and is intentionally
 * never re-applied afterward (the same "uncontrolled after mount" contract
 * every other field in `ArticleEditor.tsx` already has via
 * `useState(initial.x)`) — re-running `setContent` on every parent
 * re-render would reset the user's cursor position and undo history on
 * every keystroke, since `onChange` below is what feeds those re-renders
 * in the first place.
 */
export function ArticleContentEditor({
  blocks,
  onChange,
  mediaOptions,
  videoOptions,
  canManageMediaAny,
  canUploadVideo,
  editable = true,
}: {
  blocks: EditorBlock[];
  onChange: (blocks: EditorBlock[]) => void;
  mediaOptions: MediaOption[];
  videoOptions: VideoOption[];
  canManageMediaAny: boolean;
  canUploadVideo: boolean;
  editable?: boolean;
}) {
  // Captured once, at mount, via the lazy-initializer form of `useState` —
  // never updated again (same contract as `blocks` itself, see this
  // component's header comment). Deliberately state, not a ref: reading
  // `ref.current` during render is not allowed by this codebase's React
  // Compiler-enforced lint rules, and a `useState` initializer already runs
  // exactly once regardless.
  const [initialBlocks] = useState(blocks);
  const [initialMediaOptions] = useState(mediaOptions);
  const [initialVideoOptions] = useState(videoOptions);

  // `onChange` itself is NOT captured once — the editor must always call
  // whatever the latest `onChange` prop is (`ArticleEditor.tsx` passes a
  // stable `setBlocks`, but nothing here should assume every caller will).
  // Mutating a ref during render is disallowed by the same lint rules, so
  // the assignment happens inside an effect (runs after every commit)
  // instead of directly in the render body.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        blockquote: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        listKeymap: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true },
      }),
      Placeholder.configure({ placeholder: "Bắt đầu viết nội dung bài viết…" }),
      ArticleMediaRegistry.configure({ initialMediaOptions, initialVideoOptions, canManageMediaAny, canUploadVideo }),
      ArticleImage,
      ArticleGallery,
      ArticleYoutube,
      ArticleQuote,
      ArticleTable,
      ArticleEmbed,
    ],
    // Extensions (and the storage they seed) are built once at mount, same
    // "initial value only" contract as `blocks` — see the component's own
    // header comment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const editor = useEditor({
    extensions,
    content: blocksToDoc(initialBlocks),
    immediatelyRender: false,
    editable,
    onUpdate({ editor: e }) {
      onChangeRef.current(docToBlocks(e.getJSON()));
    },
  });

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  if (!editor) {
    return <div className="adminHint">Đang tải trình soạn thảo…</div>;
  }

  function toggleLinkPopover() {
    if (!linkPopoverOpen) {
      setLinkUrl((editor!.getAttributes("link").href as string) ?? "");
    }
    setLinkPopoverOpen((v) => !v);
  }

  function applyLink() {
    if (linkUrl.trim()) {
      editor!.chain().focus().extendMarkRange("link").setLink({ href: linkUrl.trim() }).run();
    } else {
      editor!.chain().focus().extendMarkRange("link").unsetLink().run();
    }
    setLinkPopoverOpen(false);
  }

  function removeLink() {
    editor!.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkPopoverOpen(false);
  }

  /**
   * A plain `insertContent` at the current selection is exactly "chèn ngay
   * tại vị trí con trỏ" for the common case (a text cursor inside a
   * paragraph). But every atom node this editor inserts leaves the
   * selection as a `NodeSelection` wrapping that whole node right
   * afterward — ProseMirror's `insertContent`/`replaceSelection` then
   * *replaces* whatever is selected, so inserting a second block right
   * after the first (without first clicking elsewhere to move the cursor)
   * would silently swap it out instead of adding to it. This checks for
   * that one case and inserts after the selected node instead of on top of
   * it; every other selection state falls through to the normal at-cursor
   * behavior.
   */
  function insertBlockAtCursor(content: JSONContent) {
    const e = editor!;
    if (e.state.selection instanceof NodeSelection) {
      e.chain().focus().insertContentAt(e.state.selection.to, content).run();
    } else {
      e.chain().focus().insertContent(content).run();
    }
  }

  return (
    <div>
      <div className="adminToolbar richToolbar">
        <button
          type="button"
          className={editor.isActive("heading", { level: 2 }) ? "adminButton adminButtonSmall adminButtonPrimary" : "adminButton adminButtonSmall"}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          disabled={!editable}
        >
          H2
        </button>
        <button
          type="button"
          className={editor.isActive("heading", { level: 3 }) ? "adminButton adminButtonSmall adminButtonPrimary" : "adminButton adminButtonSmall"}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          disabled={!editable}
        >
          H3
        </button>
        <span className="richToolbarDivider" />
        <button
          type="button"
          className={editor.isActive("bold") ? "adminButton adminButtonSmall adminButtonPrimary" : "adminButton adminButtonSmall"}
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editable}
          aria-label="In đậm"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className={editor.isActive("italic") ? "adminButton adminButtonSmall adminButtonPrimary" : "adminButton adminButtonSmall"}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editable}
          aria-label="Nghiêng"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          className={editor.isActive("link") ? "adminButton adminButtonSmall adminButtonPrimary" : "adminButton adminButtonSmall"}
          onClick={toggleLinkPopover}
          disabled={!editable}
        >
          Liên kết
        </button>
        <span className="richToolbarDivider" />
        <button type="button" className="adminButton adminButtonSmall" disabled={!editable} onClick={() => insertBlockAtCursor({ type: "articleQuote" })}>
          Trích dẫn
        </button>
        <button
          type="button"
          className="adminButton adminButtonSmall"
          disabled={!editable}
          onClick={() => insertBlockAtCursor({ type: "articleImage" })}
        >
          Ảnh
        </button>
        <button
          type="button"
          className="adminButton adminButtonSmall"
          disabled={!editable}
          onClick={() => insertBlockAtCursor({ type: "articleGallery" })}
        >
          Bộ sưu tập
        </button>
        <button
          type="button"
          className="adminButton adminButtonSmall"
          disabled={!editable}
          onClick={() => insertBlockAtCursor({ type: "articleYoutube" })}
        >
          Video
        </button>
        <button
          type="button"
          className="adminButton adminButtonSmall"
          disabled={!editable}
          onClick={() => insertBlockAtCursor({ type: "articleTable" })}
        >
          Bảng
        </button>
        <button
          type="button"
          className="adminButton adminButtonSmall"
          disabled={!editable}
          onClick={() => insertBlockAtCursor({ type: "articleEmbed" })}
        >
          Nhúng
        </button>
      </div>

      {linkPopoverOpen && (
        <div className="richLinkPopover">
          <input
            className="adminInput"
            style={{ flex: 1 }}
            placeholder="https://… hoặc /tin-tuc/…"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              }
            }}
            autoFocus
          />
          <button type="button" className="adminButton adminButtonSmall adminButtonPrimary" onClick={applyLink}>
            Áp dụng
          </button>
          {editor.isActive("link") && (
            <button type="button" className="adminButton adminButtonSmall" onClick={removeLink}>
              Bỏ liên kết
            </button>
          )}
        </div>
      )}

      <EditorContent editor={editor} className="richEditorContent" />
    </div>
  );
}
