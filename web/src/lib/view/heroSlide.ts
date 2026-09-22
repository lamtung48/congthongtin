import type { HeroSlide, HeroFocalPoint, HeroOverlayStrength, HeroTheme } from "@/domain/homepage";
import type { MediaAsset } from "@/domain/media";

/**
 * Turns a source article (or the dev fixture) into one `HeroSlide` for the
 * homepage Editorial Image Canvas, filling every visual knob from safe
 * auto-defaults unless the article's `heroConfig` JSON overrides it. The
 * Hero editor (Phase 2) writes that JSON; nothing writes it today, so every
 * slide currently renders from the defaults here.
 */

export interface HeroConfigOverrides {
  focalDesktop?: HeroFocalPoint;
  focalMobile?: HeroFocalPoint;
  overlay?: HeroOverlayStrength;
  overlaySide?: "left" | "right";
  theme?: HeroTheme;
  caption?: string;
  titleAccent?: string;
  text?: { x?: number; y?: number; w?: number; scale?: number };
}

const TEXT_DEFAULT = { x: 1, y: 26, w: 47, scale: 1 };

const DEFAULT_FOCAL_X = 50;

function clampPct(n: unknown, fallback: number): number {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : fallback;
}

function parseFocal(raw: unknown): HeroFocalPoint | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  if (o.x === undefined && o.y === undefined) return undefined;
  return { x: clampPct(o.x, 50), y: clampPct(o.y, 50) };
}

/** Reads and validates an `Article.heroConfig` value (untyped JSON). */
export function parseHeroConfig(raw: unknown): HeroConfigOverrides {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const overlay =
    o.overlay === "soft" || o.overlay === "medium" || o.overlay === "strong" ? (o.overlay as HeroOverlayStrength) : undefined;
  const overlaySide = o.overlaySide === "left" || o.overlaySide === "right" ? (o.overlaySide as "left" | "right") : undefined;
  const theme = o.theme === "light" || o.theme === "dark" ? (o.theme as HeroTheme) : undefined;
  const str = (k: string) => (typeof o[k] === "string" && (o[k] as string).trim() ? (o[k] as string).trim() : undefined);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  let text: HeroConfigOverrides["text"];
  if (o.text && typeof o.text === "object") {
    const t = o.text as Record<string, unknown>;
    text = { x: num(t.x), y: num(t.y), w: num(t.w), scale: num(t.scale) };
  }
  return {
    focalDesktop: parseFocal(o.focalDesktop),
    focalMobile: parseFocal(o.focalMobile),
    overlay,
    overlaySide,
    theme,
    caption: str("caption"),
    titleAccent: str("titleAccent"),
    text,
  };
}

export interface HeroSlideInput {
  id: string;
  category: string;
  title: string;
  summary: string;
  ctaLabel?: string;
  articleUrl: string;
  media: MediaAsset;
  mobileMedia?: MediaAsset;
  alt: string;
  publishedAt: string;
  author?: string;
  readingTimeMinutes?: number;
  overrides?: HeroConfigOverrides;
}

export function buildHeroSlide(input: HeroSlideInput): HeroSlide {
  const ov = input.overrides ?? {};

  const ar =
    input.media.aspectRatio ??
    (input.media.width && input.media.height ? input.media.width / input.media.height : 1.6);
  // Portrait/near-square sources: pull the focus up so faces clear the copy
  // band at the bottom-left. Landscape: a touch above centre.
  const autoFocalY = ar < 1.15 ? 32 : 42;

  const focalDesktop: HeroFocalPoint = {
    x: ov.focalDesktop?.x ?? DEFAULT_FOCAL_X,
    y: ov.focalDesktop?.y ?? autoFocalY,
  };
  const focalMobile: HeroFocalPoint = {
    x: ov.focalMobile?.x ?? focalDesktop.x,
    y: ov.focalMobile?.y ?? Math.max(18, focalDesktop.y - 8),
  };

  const metaCaption = input.media.metadata?.locationLabel;

  return {
    id: input.id,
    category: input.category,
    title: input.title,
    titleAccent: ov.titleAccent,
    summary: input.summary,
    ctaLabel: input.ctaLabel ?? "Đọc bài viết",
    articleUrl: input.articleUrl,
    media: input.media,
    mobileMedia: input.mobileMedia,
    alt: input.alt || input.media.alt || input.title,
    focalDesktop,
    focalMobile,
    overlay: ov.overlay ?? "medium",
    overlaySide: ov.overlaySide === "right" ? "right" : "left",
    theme: ov.theme ?? "dark",
    text: (() => {
      const w = Math.min(78, Math.max(22, ov.text?.w ?? TEXT_DEFAULT.w));
      // When the dark side is on the right, the copy defaults to the right
      // half so it stays over the readable area.
      const defaultX = ov.overlaySide === "right" ? Math.max(0, 100 - w) : TEXT_DEFAULT.x;
      return {
        x: clampPct(ov.text?.x, defaultX),
        y: clampPct(ov.text?.y, TEXT_DEFAULT.y),
        w,
        scale: Math.min(1.45, Math.max(0.7, ov.text?.scale ?? TEXT_DEFAULT.scale)),
      };
    })(),
    caption: ov.caption ?? (typeof metaCaption === "string" ? metaCaption : undefined),
    publishedAt: input.publishedAt,
    author: input.author,
    readingTimeMinutes: input.readingTimeMinutes,
  };
}
