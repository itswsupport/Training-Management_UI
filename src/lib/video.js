/**
 * What the app can play inside a page, and what it has to hand to a new tab.
 *
 * Shared because two screens have to agree on it: the course content list
 * decides whether clicking a lecture plays it in the preview card, and the
 * preview card decides how to render whatever arrives. If those two disagreed,
 * a lecture would look playable and then open nothing.
 */

/** Pulls the 11-char video id out of any YouTube URL shape (else null). */
export function youTubeId(url) {
  const match = String(url ?? "").match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([A-Za-z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

/**
 * A URL the browser can play itself — an .mp4/.webm/… rather than a page.
 *
 * The extension is looked for anywhere a query or fragment may follow, because
 * an uploaded lecture arrives as `/trainingMaterial/file?file_name=intro.mp4…`
 * rather than as a plain path.
 */
export const isFileVideoUrl = (url) =>
  /\.(mp4|webm|ogg|ogv|mov|m4v)(\?|&|#|$)/i.test(String(url ?? ""));

/** Can this play inside the page, rather than being handed to a new tab? */
export const isEmbeddableVideo = (url) =>
  Boolean(youTubeId(url)) || isFileVideoUrl(url);
