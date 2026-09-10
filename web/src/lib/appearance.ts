/**
 * Site background theming — the single source of truth for "what does a
 * chosen background colour actually do to the site's tokens".
 *
 * Deliberately dependency-free and free of `server-only`: the exact same
 * functions run on the server (to render the override into `(site)/layout.tsx`)
 * and in the browser (to drive the admin's live preview). That is what makes
 * the preview trustworthy — it is not a hand-drawn approximation of the
 * result, it is the same CSS the public site will get, applied to a smaller
 * surface.
 */

/** The design system's own page background (`globals.css`, `--surface-page`
 *  → `--white`). Storing this value means "no override at all". */
export const DEFAULT_PAGE_BACKGROUND = "#ffffff";

/** Body and muted text are the two colours that sit *directly* on the page
 *  background everywhere on the site, so they are what a contrast check has
 *  to be run against. Values mirror `globals.css`'s `--text-body`
 *  (`--ink-800`) and `--text-muted` (`--ink-500`). */
export const TEXT_BODY_COLOR = "#1d232c";
export const TEXT_MUTED_COLOR = "#647081";

/** Below this, body text on the chosen background fails WCAG AA (4.5:1) and
 *  the site would be genuinely hard to read — saving is refused, not just
 *  warned about. */
export const MIN_BODY_CONTRAST = 4.5;

export interface BackgroundPreset {
  key: string;
  label: string;
  value: string;
  note: string;
}

/**
 * Curated backgrounds, all verified to keep both body and muted text above
 * 4.5:1 (see `scripts/`-free check in the admin UI, which shows the live
 * ratio for whatever is selected). A custom colour is still allowed — these
 * are a starting point, not a whitelist.
 */
export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  { key: "default", label: "Trắng (mặc định)", value: "#ffffff", note: "Giao diện gốc của hệ thống thiết kế." },
  { key: "paper", label: "Trắng ngà", value: "#fbfaf7", note: "Ấm hơn một chút, dịu mắt khi đọc lâu." },
  { key: "mist", label: "Xám sương", value: "#f5f7fa", note: "Trung tính, làm nổi khối thẻ trắng." },
  { key: "sky", label: "Xanh nhạt", value: "#f1f6fd", note: "Cùng tông xanh nhận diện của Hội." },
  { key: "mint", label: "Xanh bạc hà", value: "#f1f8f4", note: "Hợp các đợt cao điểm tình nguyện." },
  { key: "sand", label: "Vàng kem", value: "#fdf8ec", note: "Ấm, hợp dịp kỷ niệm — nền vàng sao." },
  { key: "blossom", label: "Hồng phấn", value: "#fdf3f3", note: "Nhẹ, hợp dịp lễ đầu năm." },
];

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Accepts `#rgb`, `#rrggbb`, with or without the `#`, any case. Returns the
 *  canonical lowercase `#rrggbb`, or `null` when the input isn't a colour —
 *  the only shape the rest of this module (and the database) ever handles. */
export function normalizeHex(input: string | null | undefined): string | null {
  if (!input) return null;
  const m = HEX_RE.exec(input.trim());
  if (!m) return null;
  const body = m[1].toLowerCase();
  const full = body.length === 3 ? body.split("").map((c) => c + c).join("") : body;
  return `#${full}`;
}

function channels(hex: string): [number, number, number] {
  const h = normalizeHex(hex) ?? DEFAULT_PAGE_BACKGROUND;
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
}

/** WCAG 2.1 relative luminance. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 contrast ratio, 1–21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export interface ContrastReport {
  body: number;
  muted: number;
  /** Body text clears WCAG AA — the hard requirement for saving. */
  readable: boolean;
  /** Muted text (dates, captions, hints) also clears AA. Advisory only. */
  mutedReadable: boolean;
}

export function contrastReport(background: string): ContrastReport {
  const body = contrastRatio(TEXT_BODY_COLOR, background);
  const muted = contrastRatio(TEXT_MUTED_COLOR, background);
  return { body, muted, readable: body >= MIN_BODY_CONTRAST, mutedReadable: muted >= 4.5 };
}

export function isDefaultBackground(hex: string): boolean {
  return (normalizeHex(hex) ?? DEFAULT_PAGE_BACKGROUND) === DEFAULT_PAGE_BACKGROUND;
}

/**
 * The four surface tokens plus one border token, derived from the single
 * chosen colour with `color-mix()` so every shade keeps the chosen hue
 * instead of reverting to the design system's cool grey:
 *
 *  - `--surface-page`   the colour itself (page + `<body>`)
 *  - `--surface-card`   pulled toward white, so cards still lift off the page
 *  - `--surface-subtle` / `--surface-sunken`  progressively darker bands,
 *    used by alternating sections and inset panels
 *  - `--border-subtle`  the default hairline, tinted just enough not to read
 *    as a stray blue-grey line on a warm background
 *
 * Only these five are overridden. Brand, text, status and scrim tokens are
 * left exactly as designed — a background picker must not quietly restyle
 * buttons, badges or the Hero's gradients.
 *
 * Returns `null` for the default white, so the site ships with no override
 * at all rather than a no-op `:root` block on every page.
 */
export function backgroundTokens(hex: string): Record<string, string> | null {
  const bg = normalizeHex(hex) ?? DEFAULT_PAGE_BACKGROUND;
  if (bg === DEFAULT_PAGE_BACKGROUND) return null;
  return {
    "--surface-page": bg,
    "--surface-card": `color-mix(in srgb, ${bg} 35%, #ffffff)`,
    "--surface-subtle": `color-mix(in srgb, ${bg} 93%, #000000)`,
    "--surface-sunken": `color-mix(in srgb, ${bg} 87%, #000000)`,
    "--border-subtle": `color-mix(in srgb, ${bg} 78%, #000000)`,
  };
}

/**
 * The override as a stylesheet. Rendered into `(site)/layout.tsx` after
 * `globals.css`, so it wins on document order at equal specificity — no
 * `!important`, no specificity war with the design system.
 */
export function backgroundCss(hex: string, selector = ":root"): string {
  const tokens = backgroundTokens(hex);
  if (!tokens) return "";
  const body = Object.entries(tokens)
    .map(([k, v]) => `${k}:${v};`)
    .join("");
  return `${selector}{${body}}`;
}
