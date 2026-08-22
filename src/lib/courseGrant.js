"use client";

/**
 * Records which single course the app itself navigated the user to.
 *
 * The course routes carry their module id in the URL, so "may this person open
 * this course?" cannot be answered from the URL alone — anyone can type one.
 * Checking that the course is the learner's own is not enough either: a
 * training officer's ALL MODULES list legitimately links every module in the
 * system, and a learner with several courses allotted would still be able to
 * type a second one's id while sitting on the first.
 *
 * What actually separates a real visit from a tampered URL is how the user got
 * there. Following a link inside the app records the course here; typing or
 * editing an address does not.
 *
 * Exactly one course is held, not a set. A set let a course stay openable by
 * hand for as long as its entry lived, so a learner who had legitimately opened
 * course A could go back to typing A's id later — the very thing this is meant
 * to stop. Opening any course now displaces the last one, which also matches
 * how the app is used: one course at a time.
 *
 * The record also carries WHICH dashboard the course was opened from. A
 * training officer is an employee too: courses are allotted to them and they
 * sit them like anyone else, so "may they edit this?" and "does watching this
 * count?" cannot be answered from their authority alone — only from the list
 * they came in through. The officer's module list links with ?from=officer;
 * their own learner dashboard does not. Storing it beside the id is what
 * carries that answer to /watch and /assignment, whose links have no room to
 * repeat it.
 *
 * Kept in localStorage rather than sessionStorage because the lecture player
 * opens in a new tab (see CoursePreviewCard) and a new tab starts with an empty
 * sessionStorage — the record has to survive that hop.
 *
 * This is a browser-side record and anyone with devtools can write one. It
 * stops URL tampering, which is what it is for; it is not a substitute for the
 * backend binding `/emodule` to the caller.
 */

const KEY = "etms:active-course";

/** The stored record, or null if there is none this browser can read. */
function readGrant() {
  if (typeof window === "undefined") return null;

  let raw;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  // Records written before the mode was stored are the bare id. They read as
  // the learner view, which is the safe way round: the worst it costs is an
  // officer mid-course losing their EDIT button until they open the course
  // again from their module list.
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const id = Number(parsed.id);
      return Number.isFinite(id) ? { id, officer: parsed.officer === true } : null;
    }
  } catch {
    // Not JSON — fall through to the bare-id form below.
  }

  const id = Number(raw);
  return Number.isFinite(id) ? { id, officer: false } : null;
}

/**
 * Records that this course was reached by following the app's own navigation,
 * replacing whichever course was active before.
 *
 * @param {number|string} emoduleId
 * @param {{officer?: boolean}} [options] `officer` says the course was opened
 *   from the Training Officer Dashboard's module list — to be managed, not
 *   sat. Omit it to keep whatever the course is already open as: only the
 *   links that enter a course decide the mode, and the ones inside it
 *   (a lecture, a paper, the feedback form) must not silently change it.
 */
export function grantCourseAccess(emoduleId, options) {
  if (typeof window === "undefined") return;
  const id = Number(emoduleId);
  if (!Number.isFinite(id)) return;

  const current = readGrant();
  const officer =
    typeof options?.officer === "boolean"
      ? options.officer
      : current?.id === id && current.officer;

  try {
    window.localStorage.setItem(KEY, JSON.stringify({ id, officer }));
  } catch {
    // A full or blocked storage quota must not wedge navigation.
  }
}

/**
 * Was this course opened to be managed rather than sat?
 *
 * True only for a training officer who came in through their module list. The
 * same officer opening a course allotted to them, from their own dashboard,
 * gets false — and with it the lecture ticks, the papers and the grade that
 * every other learner gets.
 *
 * @param {number|string} emoduleId
 * @returns {boolean}
 */
export function isOfficerCourseView(emoduleId) {
  const id = Number(emoduleId);
  if (!Number.isFinite(id)) return false;
  const grant = readGrant();
  return grant?.id === id && grant.officer;
}

/**
 * Is the page being read one the officer's module list linked to?
 *
 * The course page itself is reached with ?from=officer on it, which survives a
 * reload of that page — the stored mode does too, so this only has to answer
 * for the case where the two disagree: a record written before the mode was
 * stored, or one displaced by another tab.
 *
 * @returns {boolean}
 */
export function hasOfficerQuery() {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("from") === "officer";
  } catch {
    return false;
  }
}

/**
 * Is this the course the app last navigated to?
 *
 * No expiry: the learner may sit on one course for hours and must still be able
 * to reload it. What ends the record is opening a different course, or signing
 * out.
 *
 * @param {number|string} emoduleId
 * @returns {boolean}
 */
export function hasCourseGrant(emoduleId) {
  const id = Number(emoduleId);
  if (!Number.isFinite(id)) return false;
  return readGrant()?.id === id;
}

/** Clears the record — called when the session ends. */
export function clearCourseGrants() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to do; an unreadable store grants nothing.
  }
}
