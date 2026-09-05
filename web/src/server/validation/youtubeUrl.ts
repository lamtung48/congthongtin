/**
 * Brief section 2's "Dán URL/Video ID" — parses whatever a CMS editor
 * pastes (a raw video id, or one of the several URL shapes YouTube itself
 * generates when you hit "Share") into a canonical 11-character video id.
 * Pure and dependency-free so it's trivially unit-testable without any
 * mocking; `youtubeService.linkExistingVideo` is the only caller, and it
 * still verifies the resulting id against the real YouTube API afterward
 * (a syntactically valid id that doesn't actually exist is a normal, not
 * exceptional, outcome this function has no way to detect on its own).
 */

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

function isYoutubeHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\.|^m\.|^music\./, "");
  return host === "youtube.com" || host === "youtu.be" || host === "youtube-nocookie.com";
}

/** Returns the 11-character video id, or `null` if the input is neither a
 *  bare id nor a recognizable YouTube URL. */
export function parseYoutubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (VIDEO_ID_PATTERN.test(trimmed)) return trimmed;

  let url: URL;
  try {
    // A bare id already returned above; anything else must parse as a URL
    // (with or without a scheme — `youtube.com/watch?v=...` pasted without
    // `https://` is common).
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  if (!isYoutubeHost(url.hostname)) return null;

  const fromQuery = url.searchParams.get("v");
  if (fromQuery && VIDEO_ID_PATTERN.test(fromQuery)) return fromQuery;

  const segments = url.pathname.split("/").filter(Boolean);
  if (url.hostname.toLowerCase().replace(/^www\.|^m\.|^music\./, "") === "youtu.be") {
    const id = segments[0];
    return id && VIDEO_ID_PATTERN.test(id) ? id : null;
  }
  // /embed/<id>, /shorts/<id>, /v/<id>
  const markerIndex = segments.findIndex((s) => s === "embed" || s === "shorts" || s === "v");
  if (markerIndex !== -1) {
    const id = segments[markerIndex + 1];
    return id && VIDEO_ID_PATTERN.test(id) ? id : null;
  }
  return null;
}
