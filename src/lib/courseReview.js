"use client";

/**
 * Whose attempt an officer is looking at.
 *
 * COURSE STATUS lists one row per employee per course, so what it links to is
 * somebody's ATTEMPT at a module and not just the module. The course page and
 * the assignment pages under it have no other way to know that — they are the
 * same routes a learner opens for themselves — so the employee code rides in
 * the URL as `?emp=` and is threaded down to the paper links.
 *
 * A code in the URL is not authority. Every page that reads one still requires
 * the viewer to hold the officer's read-only preview of the course, which
 * useCourseAccess decides; for anyone else the parameter is ignored and the
 * page reads their own attempt exactly as before. What it buys the officer is
 * the answers that were actually given, marked against the key — the review of
 * a finished paper that COURSE STATUS's marks columns can only total.
 */
export function reviewEmpFromUrl() {
  if (typeof window === "undefined") return "";
  try {
    return (new URLSearchParams(window.location.search).get("emp") || "").trim();
  } catch {
    return "";
  }
}

/** The same course, still carrying whose attempt is being read. */
export function withReviewEmp(href, empCode) {
  if (!empCode) return href;
  return `${href}${href.includes("?") ? "&" : "?"}emp=${encodeURIComponent(empCode)}`;
}
