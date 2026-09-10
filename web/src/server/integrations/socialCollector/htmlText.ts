import "server-only";
import { parse } from "node-html-parser";

/**
 * HTML (or entity-encoded plain text) → the plain text a human reads.
 *
 * Real Vietnamese feeds do not hand out clean UTF-8 text. Thanh Niên's
 * RSS, for example, wraps each item in CDATA and then encodes every
 * accented base letter as an HTML entity:
 *
 *   <title><![CDATA[Trung ương Đo&agrave;n trao quyết định]]></title>
 *
 * CDATA means the XML parser hands that string back untouched, so anything
 * that only knows the five XML entities (`&amp; &lt; &gt; &quot; &#39;`)
 * leaves `Đo&agrave;n` sitting in the title — which is what reached the
 * Social Inbox and looked like a charset/font bug. The fix is a real HTML
 * entity decoder, not a longer list of `.replace()` calls: `&agrave;` is
 * one of ~2,200 named entities, and feeds also emit decimal (`&#7899;`)
 * and hex (`&#x1F600;`) references.
 *
 * `node-html-parser` (already a dependency, and what `articleExtractor`
 * uses for full-body extraction — which is why that path never showed the
 * bug) does both jobs at once: it drops markup and decodes every entity
 * form. Whitespace is collapsed because the result is stored as
 * `contentText`/`title`, never rendered as HTML.
 */
export function htmlToPlainText(input: string | undefined | null): string {
  if (!input) return "";
  // `parse()` on entity-only text with no tags returns it decoded, so the
  // same call covers both a <description> full of markup and a bare <title>.
  return parse(input).structuredText.replace(/\s+/g, " ").trim();
}
