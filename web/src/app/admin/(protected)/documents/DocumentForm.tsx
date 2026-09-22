"use client";

import { useRef, useState, useTransition } from "react";
import { createDocumentAction, createDocumentLabelAction } from "./actions";
import { DOCUMENT_EXTENSIONS, MAX_DOCUMENT_BYTES } from "@/lib/media/documentFormats";

interface Label {
  id: string;
  name: string;
}

type SourceKind = "upload" | "link";

const ACCEPT = DOCUMENT_EXTENSIONS.map((e) => `.${e}`).join(",");
const MAX_MB = Math.round(MAX_DOCUMENT_BYTES / (1024 * 1024));

/**
 * One form covering both ways a document can arrive. The two are mutually
 * exclusive — `documentService` rejects a submission carrying both — so the
 * form makes that a radio choice rather than two fields an editor could fill
 * in at once and then be told off for.
 *
 * The file goes up first, on its own request to `/api/admin/documents/upload`
 * (a Server Action body is capped at 1MB, far below a scanned PDF), and only
 * the resulting `MediaAsset.id` is submitted with the rest of the form.
 */
export function DocumentForm({ labels }: { labels: Label[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [kind, setKind] = useState<SourceKind>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [labelBusy, startLabel] = useTransition();

  async function uploadFile(): Promise<string> {
    const body = new FormData();
    body.append("file", file!);
    const res = await fetch("/api/admin/documents/upload", { method: "POST", body });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error ?? "Tải tệp lên thất bại.");
    return data.media.id as string;
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setDone(false);
    const formData = new FormData(e.currentTarget);
    setBusy(true);
    try {
      if (kind === "upload") {
        if (!file) throw new Error("Hãy chọn tệp cần tải lên.");
        formData.set("mediaId", await uploadFile());
        formData.delete("externalUrl");
      } else {
        formData.delete("mediaId");
      }
      const result = await createDocumentAction(formData);
      if (!result.ok) throw new Error(result.error);
      formRef.current?.reset();
      setFile(null);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được tài liệu.");
    } finally {
      setBusy(false);
    }
  }

  function addLabel() {
    const name = newLabel.trim();
    if (!name) return;
    startLabel(async () => {
      const result = await createDocumentLabelAction(name);
      if (result.ok) setNewLabel("");
      else setError(result.error);
    });
  }

  return (
    <form ref={formRef} onSubmit={submit} className="adminCard adminCardPad" style={{ marginBottom: 20, display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="doc-title">Tên tài liệu *</label>
          <input id="doc-title" name="title" required className="adminInput" disabled={busy} />
        </div>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="doc-number">Số / ký hiệu</label>
          <input id="doc-number" name="documentNumber" className="adminInput" placeholder="1234-KH/TWHSV" disabled={busy} />
        </div>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="doc-issued">Ngày ban hành</label>
          <input id="doc-issued" name="issuedAt" type="date" className="adminInput" disabled={busy} />
        </div>
      </div>

      <div className="adminField" style={{ marginBottom: 0 }}>
        <label className="adminLabel" htmlFor="doc-desc">Mô tả ngắn</label>
        <input id="doc-desc" name="description" className="adminInput" disabled={busy} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(200px, 1fr) minmax(260px, 2fr)", gap: 12, alignItems: "start" }}>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <label className="adminLabel" htmlFor="doc-label">Nhãn</label>
          <select id="doc-label" name="labelId" className="adminSelect" defaultValue="" disabled={busy}>
            <option value="">— Chưa phân loại —</option>
            {labels.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
        <div className="adminField" style={{ marginBottom: 0 }}>
          <span className="adminLabel">Thêm nhãn mới</span>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                // Enter here must not submit the whole document form.
                if (e.key === "Enter") {
                  e.preventDefault();
                  addLabel();
                }
              }}
              placeholder="vd: Công văn"
              className="adminInput"
              disabled={labelBusy}
            />
            <button type="button" onClick={addLabel} className="adminButton" disabled={labelBusy || !newLabel.trim()}>
              {labelBusy ? "Đang thêm…" : "Thêm nhãn"}
            </button>
          </div>
          <span className="adminHint">Nhãn mới dùng được ngay cho các tài liệu sau.</span>
        </div>
      </div>

      <fieldset style={{ border: "1px solid var(--admin-border)", borderRadius: "var(--admin-radius)", padding: 12, margin: 0 }}>
        <legend className="adminLabel" style={{ padding: "0 6px", margin: 0 }}>Nguồn tài liệu</legend>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 10 }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
            <input type="radio" name="sourceKind" checked={kind === "upload"} onChange={() => setKind("upload")} disabled={busy} />
            Tải tệp lên
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
            <input type="radio" name="sourceKind" checked={kind === "link"} onChange={() => setKind("link")} disabled={busy} />
            Dán đường dẫn (Google Drive…)
          </label>
        </div>

        {kind === "upload" ? (
          <div className="adminField" style={{ marginBottom: 0 }}>
            <input
              type="file"
              accept={ACCEPT}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="adminInput"
              disabled={busy}
            />
            <span className="adminHint">
              Nhận {DOCUMENT_EXTENSIONS.join(", ").toUpperCase()} · tối đa {MAX_MB} MB. Tệp được lưu trên Google Drive của Hội và
              tải về qua chính cổng này (không lộ liên kết Drive).
            </span>
          </div>
        ) : (
          <div className="adminField" style={{ marginBottom: 0 }}>
            <input name="externalUrl" type="url" placeholder="https://drive.google.com/…" className="adminInput" disabled={busy} />
            <span className="adminHint">Người xem sẽ mở thẳng đường dẫn này ở tab mới. Nhớ đặt quyền xem công khai.</span>
          </div>
        )}
      </fieldset>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button type="submit" className="adminButton adminButtonPrimary" disabled={busy}>
          {busy ? "Đang lưu…" : "Thêm tài liệu"}
        </button>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" name="isPublished" value="true" defaultChecked disabled={busy} />
          Hiển thị công khai ngay
        </label>
        {error && <span className="adminErrorText" role="alert">{error}</span>}
        {done && <span style={{ color: "var(--admin-success)", fontSize: 12.5 }}>Đã thêm tài liệu.</span>}
      </div>
    </form>
  );
}
