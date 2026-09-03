/**
 * Stand-in for the design prototype's <image-slot>. No real photography was
 * supplied with the handoff, so every image position renders this clean,
 * neutral placeholder instead of a fake or stock photo — production notes
 * list what each slot needs (see Handoff docs).
 */
export function MediaPlaceholder({
  need,
  className,
}: {
  need: string;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        background:
          "linear-gradient(135deg, var(--surface-sunken) 0%, var(--ink-150) 100%)",
        color: "var(--text-faint)",
        padding: 12,
        textAlign: "center",
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M3 6h18v13H3z" />
        <path d="M3 15l5-4 4 3 3-2 6 4" />
        <circle cx="8.5" cy="10" r="1.4" />
      </svg>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          lineHeight: 1.4,
          letterSpacing: ".02em",
          maxWidth: "26ch",
        }}
      >
        {need}
      </span>
    </div>
  );
}
