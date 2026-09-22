"use client";

import { useState, useTransition } from "react";
import { SitePreview } from "./SitePreview";
import { saveBackgroundAction } from "./actions";
import {
  BACKGROUND_PRESETS,
  DEFAULT_PAGE_BACKGROUND,
  MIN_BODY_CONTRAST,
  contrastReport,
  normalizeHex,
} from "@/lib/appearance";

/**
 * Background picker. Everything except the final save happens in the
 * browser: choosing a swatch, typing a hex, dragging the native colour
 * picker all repaint the preview instantly, and the contrast figures come
 * from the same `contrastReport()` the server enforces with. Nothing reaches
 * the database — or any visitor — until "Lưu & áp dụng".
 */
export function AppearanceEditor({
  initialBackground,
  lastUpdatedLabel,
}: {
  initialBackground: string;
  lastUpdatedLabel: string | null;
}) {
  const [saved, setSaved] = useState(initialBackground);
  // What the picker currently shows. Kept as the raw string so a
  // half-typed "#f5f" doesn't fight the user's keystrokes.
  const [draft, setDraft] = useState(initialBackground);
  const [narrow, setNarrow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const normalized = normalizeHex(draft);
  const effective = normalized ?? saved;
  const contrast = contrastReport(effective);
  const dirty = normalized !== null && normalized !== saved;
  const canSave = normalized !== null && contrast.readable && dirty && !saving;

  function pick(value: string) {
    setDraft(value);
    setError(null);
    setDone(null);
  }

  function save() {
    if (!normalized) return;
    setError(null);
    setDone(null);
    startSaving(async () => {
      const result = await saveBackgroundAction(normalized);
      if (result.ok) {
        setSaved(result.value);
        setDraft(result.value);
        setDone("Đã áp dụng cho toàn bộ trang công khai.");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="adminCard adminCardPad" style={{ display: "grid", gap: 16 }}>
        <div>
          <span className="adminLabel">Chọn nhanh</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
            {BACKGROUND_PRESETS.map((p) => {
              const active = normalized === p.value;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => pick(p.value)}
                  title={p.note}
                  aria-pressed={active}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 11px 7px 8px",
                    borderRadius: "var(--admin-radius)",
                    border: `1.5px solid ${active ? "var(--admin-brand)" : "var(--admin-border)"}`,
                    background: active ? "color-mix(in srgb, var(--admin-brand) 8%, #fff)" : "var(--admin-surface)",
                    cursor: "pointer",
                    font: "inherit",
                    color: "var(--admin-text)",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 4,
                      background: p.value,
                      border: "1px solid var(--admin-border)",
                      flex: "0 0 auto",
                    }}
                  />
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-end" }}>
          <div className="adminField" style={{ maxWidth: 210 }}>
            <label className="adminLabel" htmlFor="bg-hex">Mã màu tuỳ chọn</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="color"
                aria-label="Bảng chọn màu"
                value={effective}
                onChange={(e) => pick(e.target.value)}
                style={{ width: 42, height: 34, padding: 2, border: "1px solid var(--admin-border)", borderRadius: "var(--admin-radius)", background: "var(--admin-surface)", cursor: "pointer" }}
              />
              <input
                id="bg-hex"
                className="adminInput"
                value={draft}
                onChange={(e) => pick(e.target.value)}
                spellCheck={false}
                placeholder="#ffffff"
                style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", maxWidth: 130 }}
              />
            </div>
            {normalized === null && (
              <span className="adminErrorText">Mã màu chưa hợp lệ. Dạng đúng: #f5f7fa.</span>
            )}
          </div>

          <div className="adminField" style={{ maxWidth: 320 }}>
            <span className="adminLabel">Độ tương phản với chữ</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className={`adminBadge ${contrast.readable ? "adminBadgeSuccess" : "adminBadgeDanger"}`}>
                Chữ chính {contrast.body.toFixed(1)}:1
              </span>
              <span className={`adminBadge ${contrast.mutedReadable ? "adminBadgeSuccess" : "adminBadgeWarning"}`}>
                Chữ phụ {contrast.muted.toFixed(1)}:1
              </span>
            </div>
            <span className="adminHint">
              {contrast.readable
                ? contrast.mutedReadable
                  ? "Đạt chuẩn WCAG AA (≥ 4,5:1) cho cả chữ chính và chữ phụ."
                  : "Chữ chính đạt chuẩn, nhưng chữ phụ (ngày tháng, chú thích) xuống dưới 4,5:1 — vẫn lưu được, nên cân nhắc màu sáng hơn."
                : `Nền quá tối: chữ chính chỉ đạt ${contrast.body.toFixed(1)}:1, dưới mức tối thiểu ${MIN_BODY_CONTRAST}:1. Chưa thể lưu.`}
            </span>
          </div>

          <div className="adminField" style={{ maxWidth: 200 }}>
            <span className="adminLabel">Khổ xem trước</span>
            <div className="adminTabs" style={{ marginBottom: 0 }}>
              <button type="button" onClick={() => setNarrow(false)} className={narrow ? "adminTab" : "adminTab adminTabActive"}>
                Máy tính
              </button>
              <button type="button" onClick={() => setNarrow(true)} className={narrow ? "adminTab adminTabActive" : "adminTab"}>
                Điện thoại
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="adminCard adminCardPad" style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span className="adminLabel" style={{ margin: 0 }}>Xem trước trực quan</span>
          <span className="adminHint">
            Mô phỏng đúng các lớp nền của trang công khai: nền trang, thẻ tin, dải xen kẽ và đường kẻ.
            {dirty ? " Đang xem màu chưa lưu." : " Đang xem màu đang áp dụng."}
          </span>
        </div>
        <SitePreview background={effective} narrow={narrow} />
      </div>

      <div className="adminStickyBar">
        <span className="adminSaveStatus">
          {error ? (
            <span style={{ color: "var(--admin-danger)" }}>{error}</span>
          ) : done ? (
            <span style={{ color: "var(--admin-success)" }}>{done}</span>
          ) : dirty ? (
            <>Đang chọn <code>{normalized}</code> — chưa áp dụng.</>
          ) : (
            <>
              Đang áp dụng <code>{saved}</code>
              {saved === DEFAULT_PAGE_BACKGROUND ? " (mặc định)" : ""}
              {lastUpdatedLabel ? ` · ${lastUpdatedLabel}` : ""}
            </>
          )}
        </span>
        <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
          <button
            type="button"
            className="adminButton"
            onClick={() => pick(DEFAULT_PAGE_BACKGROUND)}
            disabled={saving || normalized === DEFAULT_PAGE_BACKGROUND}
          >
            Về màu mặc định
          </button>
          <button type="button" className="adminButton" onClick={() => pick(saved)} disabled={saving || !dirty}>
            Hoàn tác
          </button>
          <button type="button" className="adminButton adminButtonPrimary" onClick={save} disabled={!canSave}>
            {saving ? "Đang áp dụng…" : "Lưu & áp dụng"}
          </button>
        </div>
      </div>
    </div>
  );
}
