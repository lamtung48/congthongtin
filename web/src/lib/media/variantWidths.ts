/** The widths `/api/media/[mediaId]?w=` will generate. Lives here rather than
 *  in `server/media/imageVariants.ts` because `MediaImage` is a Client
 *  Component and that module is `server-only`; the server module imports this
 *  list so the two can never drift. */
export const VARIANT_WIDTHS = [320, 480, 768, 1200] as const;

export type VariantWidth = (typeof VARIANT_WIDTHS)[number];
