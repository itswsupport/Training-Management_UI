/**
 * A learner's per-browser "watched" ticks — which materials of a course they
 * have opened and worked through. See CourseContent for why these live in the
 * browser rather than on the server.
 *
 * One home for the key, because more than one tab writes it: the course page,
 * and the lecture and reading pages that OPEN IN NEW TAB leads to. Storage is
 * shared across the tabs of one origin, so a tick written in the new tab is
 * there when the learner goes back to the course.
 *
 * Keyed on the attempt as well, so a course handed back after a grade C starts
 * from nothing.
 */
export const watchedStorageKey = (empCode, emoduleId, attempt) =>
  `etms:watched:${empCode || "anon"}:${emoduleId}:${attempt}`;

/** The stored ticks, or an empty set where there are none this browser can read. */
export function readWatched(empCode, emoduleId, attempt) {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(
      watchedStorageKey(empCode, emoduleId, attempt)
    );
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

/**
 * Stores `ticks` merged with whatever is already there.
 *
 * Merged rather than overwritten: another tab may have added a tick since this
 * one last read, and writing a stale set over it would quietly take it away.
 * Ticks are only ever added, so the union is always right.
 */
export function writeWatched(empCode, emoduleId, attempt, ticks) {
  if (typeof window === "undefined") return;
  const merged = readWatched(empCode, emoduleId, attempt);
  ticks.forEach((tick) => merged.add(tick));
  try {
    window.localStorage.setItem(
      watchedStorageKey(empCode, emoduleId, attempt),
      JSON.stringify([...merged])
    );
  } catch {
    // A full or blocked storage quota must not break the page.
  }
}

/**
 * The tick for one material of a lecture, as the course page builds it for
 * every lecture the backend gave both ids — which is every modern lecture.
 *
 * @param {"link"|"video"|"file"} materialId
 */
export const materialTick = (sectionId, lectureId, materialId) =>
  `${sectionId}:${lectureId}::${materialId}`;
