import { z } from "zod";

/**
 * Validates + trims the `Article.heroConfig` payload the Hero editor
 * (`ArticleEditor` → `HeroPanel`) sends. Anything that matches a default is
 * dropped so a slide that's been "reset to auto" stores `null`, not an
 * object full of default values. See `lib/view/heroSlide.ts` for how the
 * kept values are consumed and `docs/HERO.md` for the shape.
 */
const focal = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
});

/** Desktop text-block placement/size (all optional; mobile always uses the
 *  stacked panel, so only `scale` affects it). `x`/`w` are % of the
 *  container's inner width, `y` is % of the Hero's height (block top). */
const textBox = z.object({
  x: z.number().min(0).max(100).optional(),
  y: z.number().min(0).max(100).optional(),
  w: z.number().min(22).max(78).optional(),
  scale: z.number().min(0.7).max(1.45).optional(),
});

export const HeroConfigSchema = z
  .object({
    focalDesktop: focal.optional(),
    focalMobile: focal.optional(),
    overlay: z.enum(["soft", "medium", "strong"]).optional(),
    /** Which side the dark end of the horizontal gradient sits on. */
    overlaySide: z.enum(["left", "right"]).optional(),
    theme: z.enum(["light", "dark"]).optional(),
    caption: z.string().max(180).optional(),
    titleAccent: z.string().max(140).optional(),
    text: textBox.optional(),
  })
  .strip();

/** Defaults the Hero falls back to when `text` (or a field of it) is unset. */
export const HERO_TEXT_DEFAULT = { x: 1, y: 26, w: 47, scale: 1 } as const;

export type HeroConfigInput = z.infer<typeof HeroConfigSchema>;

function roundFocal(f: { x: number; y: number }) {
  return { x: Math.round(f.x), y: Math.round(f.y) };
}

/** Returns a cleaned object, or `null` when it holds nothing but defaults. */
export function normalizeHeroConfig(raw: unknown): HeroConfigInput | null {
  if (raw == null || (typeof raw === "object" && Object.keys(raw).length === 0)) return null;
  const parsed = HeroConfigSchema.safeParse(raw);
  if (!parsed.success) return null;
  const v = parsed.data;
  const out: HeroConfigInput = {};
  if (v.focalDesktop && (v.focalDesktop.x !== 50 || v.focalDesktop.y !== 42)) out.focalDesktop = roundFocal(v.focalDesktop);
  if (v.focalMobile) out.focalMobile = roundFocal(v.focalMobile);
  if (v.overlay && v.overlay !== "medium") out.overlay = v.overlay;
  if (v.overlaySide === "right") out.overlaySide = "right";
  if (v.theme && v.theme !== "dark") out.theme = v.theme;
  if (v.caption?.trim()) out.caption = v.caption.trim();
  if (v.titleAccent?.trim()) out.titleAccent = v.titleAccent.trim();
  if (v.text) {
    const t: NonNullable<HeroConfigInput["text"]> = {};
    const round1 = (n: number) => Math.round(n * 100) / 100;
    if (v.text.x !== undefined && Math.round(v.text.x) !== HERO_TEXT_DEFAULT.x) t.x = Math.round(v.text.x);
    if (v.text.y !== undefined && Math.round(v.text.y) !== HERO_TEXT_DEFAULT.y) t.y = Math.round(v.text.y);
    if (v.text.w !== undefined && Math.round(v.text.w) !== HERO_TEXT_DEFAULT.w) t.w = Math.round(v.text.w);
    if (v.text.scale !== undefined && round1(v.text.scale) !== HERO_TEXT_DEFAULT.scale) t.scale = round1(v.text.scale);
    if (Object.keys(t).length) out.text = t;
  }
  return Object.keys(out).length ? out : null;
}
