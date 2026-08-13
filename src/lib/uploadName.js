/**
 * Cleaning special characters out of an uploaded material's file name.
 *
 * The name a lecture is uploaded with is not just a label — the backend stores
 * the file under it and hands it back through `/trainingMaterial/file`, which
 * looks the material up BY NAME when the recorded path no longer leads anywhere
 * (see `ModuleService.materialUrl`). So a name carrying `#`, `%`, `&`, `?`, a
 * quote or a path separator is a file that uploads fine and then cannot be
 * opened again — and `../` in one is a path the server has no business
 * resolving at all.
 *
 * Rather than refuse the upload over a character the officer did not choose
 * (it usually arrives from whatever exported the file), the name is cleaned as
 * it is picked and the field says so. `isSafeFileName` backs that up in the
 * section validators, so nothing can reach the multipart builder uncleaned.
 */

/** Letters, digits, dot, dash and underscore, starting on a letter or digit. */
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** Longest base name kept, before the extension. */
const MAX_BASE = 80;

/** True when this name needs no cleaning. */
export const isSafeFileName = (name) => SAFE_NAME.test(String(name ?? ""));

/**
 * The same name with every special character replaced by an underscore.
 *
 * The extension is split off first and lower-cased, so `REPORT #3.PDF` becomes
 * `REPORT_3.pdf`. That casing is not cosmetic: `/trainingMaterial/file` decides
 * whether to serve a document inline on its own `.pdf` check, and the course
 * page mirrors it — an upload named `.PDF` downloaded behind an empty panel
 * instead of opening in the reader.
 *
 * @param {string} name
 * @returns {string} a name `isSafeFileName` accepts, never empty
 */
export function safeFileName(name) {
  const raw = String(name ?? "")
    // A path separator is stripped before anything else: only the last segment
    // is a file name, and the rest is a directory this has no say over.
    .split(/[\\/]/)
    .pop()
    .trim();

  const dot = raw.lastIndexOf(".");
  // A leading dot is the whole name of a hidden file, not an extension.
  const hasExt = dot > 0;
  const rawBase = hasExt ? raw.slice(0, dot) : raw;
  const rawExt = hasExt ? raw.slice(dot + 1) : "";

  const base =
    rawBase
      // An accent is dropped rather than blanked out, so "résumé" cleans to
      // "resume" instead of "r_sum".
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9-]+/g, "_")
      // A run of specials ("my   file!!.pdf") is one underscore, not five.
      .replace(/_{2,}/g, "_")
      .replace(/^[_.-]+|[_.-]+$/g, "")
      .slice(0, MAX_BASE) || "file";

  const ext = rawExt.replace(/[^A-Za-z0-9]+/g, "").toLowerCase();

  return ext ? `${base}.${ext}` : base;
}

/**
 * One picked upload with its name cleaned.
 *
 * Returns the file untouched when the name is already safe, so an ordinary
 * upload is not needlessly copied. When it is not, a new `File` is returned
 * carrying the same bytes under the clean name, with `renamedFrom` set to what
 * was picked — that is what lets the field explain the change rather than
 * silently swapping the name behind the officer.
 *
 * @param {File|null} file
 * @returns {File|null}
 */
export function sanitizeUpload(file) {
  if (!file) return null;
  if (isSafeFileName(file.name)) return file;

  const cleaned = new File([file], safeFileName(file.name), {
    type: file.type,
    lastModified: file.lastModified,
  });
  // FormData reads only the bytes and the name, so an extra property here is
  // carried purely for the UI and never reaches the request.
  cleaned.renamedFrom = file.name;
  return cleaned;
}
