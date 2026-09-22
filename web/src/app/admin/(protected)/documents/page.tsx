import type { Metadata } from "next";
import { requirePermission } from "@/server/auth/guard";
import { documentService } from "@/server/services/documentService";
import { formatDateVi } from "@/lib/formatDate";
import { DocumentForm } from "./DocumentForm";
import { DocumentRowActions, DeleteLabelButton } from "./DocumentRowActions";

export const metadata: Metadata = { title: "Tài liệu" };

/** Bytes → "1,2 MB" for the size column; documents are big enough that KB
 *  would be noise. */
function formatSize(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default async function AdminDocumentsPage() {
  await requirePermission("document.manage");
  const [documents, labels] = await Promise.all([
    documentService.list(),
    documentService.listLabelsWithUsage(),
  ]);

  return (
    <>
      <div className="adminPageHead">
        <div>
          <h1 className="adminPageTitle">Tài liệu</h1>
          <p className="adminPageSubtitle">
            Văn bản để tải về — tải tệp lên trực tiếp (PDF, Word, Excel, PowerPoint) hoặc dán đường dẫn Google Drive, rồi gán nhãn
            phân loại. Tài liệu đang hiển thị sẽ xuất hiện ở mục &ldquo;Tài liệu&rdquo; ngoài trang chủ.
          </p>
        </div>
      </div>

      <DocumentForm labels={labels} />

      <div className="adminCard adminCardPad" style={{ marginBottom: 20 }}>
        <span className="adminLabel">Nhãn hiện có</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
          {labels.length === 0 ? (
            <span className="adminHint">Chưa có nhãn nào.</span>
          ) : (
            labels.map((l) => (
              <span
                key={l.id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "4px 6px 4px 11px",
                  border: "1px solid var(--admin-border)",
                  borderRadius: "var(--admin-radius)",
                  background: "var(--admin-surface)",
                }}
              >
                {l.name}
                <span className="adminHint">{l._count.documents}</span>
                <DeleteLabelButton id={l.id} name={l.name} count={l._count.documents} />
              </span>
            ))
          )}
        </div>
      </div>

      <div className="adminCard">
        {documents.length === 0 ? (
          <div className="adminEmptyState">Chưa có tài liệu nào.</div>
        ) : (
          <div className="adminTableWrap">
            <table className="adminTable">
              <thead>
                <tr>
                  <th>Tài liệu</th>
                  <th>Nhãn</th>
                  <th>Nguồn</th>
                  <th style={{ whiteSpace: "nowrap" }}>Ngày ban hành</th>
                  <th>Trạng thái</th>
                  <th style={{ width: 150 }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <div style={{ fontWeight: 600, lineHeight: 1.35 }}>{d.title}</div>
                      <div className="adminHint" style={{ marginTop: 3 }}>
                        {d.documentNumber ? `${d.documentNumber} · ` : ""}
                        {d.description ?? "—"}
                      </div>
                    </td>
                    <td className="adminHint">{d.label?.name ?? "Chưa phân loại"}</td>
                    <td className="adminHint" style={{ maxWidth: 220 }}>
                      {d.media ? (
                        <>
                          <a href={`/api/tai-lieu/${d.id}`} target="_blank" rel="noreferrer">Tệp tải lên ↓</a>
                          <div>{formatSize(d.media.size)}</div>
                        </>
                      ) : d.externalUrl ? (
                        <a href={d.externalUrl} target="_blank" rel="noreferrer noopener" style={{ wordBreak: "break-all" }}>
                          Đường dẫn ngoài ↗
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="adminHint" style={{ whiteSpace: "nowrap" }}>
                      {d.issuedAt ? formatDateVi(d.issuedAt) : "—"}
                    </td>
                    <td>
                      <span className={`adminBadge ${d.isPublished ? "adminBadgeSuccess" : "adminBadgeNeutral"}`}>
                        {d.isPublished ? "Đang hiện" : "Đang ẩn"}
                      </span>
                    </td>
                    <td>
                      <DocumentRowActions id={d.id} title={d.title} isPublished={d.isPublished} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
