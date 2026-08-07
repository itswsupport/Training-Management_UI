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
 * Kept in localStorage rather than sessionStorage because the lecture player
 * opens in a new tab (see CoursePreviewCard) and a new tab starts with an empty
 * sessionStorage — the record has to survive that hop.
 *
 * This is a browser-side record and anyone with devtools can write one. It
 * stops URL tampering, which is what it is for; it is not a substitute for the
 * backend binding `/emodule` to the caller.
 */

const KEY = "etms:active-course";

/**
 * Records that this course was reached by following the app's own navigation,
 * replacing whichever course was active before.
 *
 * @param {number|string} emoduleId
 */
export function grantCourseAccess(emoduleId) {
  if (typeof window === "undefined") return;
  const id = Number(emoduleId);
  if (!Number.isFinite(id)) return;

  try {
    window.localStorage.setItem(KEY, String(id));
  } catch {
    // A full or blocked storage quota must not wedge navigation.
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
  if (typeof window === "undefined") return false;
  const id = Number(emoduleId);
  if (!Number.isFinite(id)) return false;

  try {
    return window.localStorage.getItem(KEY) === String(id);
  } catch {
    return false;
  }
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
