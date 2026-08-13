"use client";

import { DEFAULT_EXAM_TYPE } from "@/lib/examType";

/**
 * What a learner scored on one of a section's papers, kept per browser.
 *
 * Keyed by paper as well as section: the pre and post assignments are scored
 * separately, and without the paper in the key handing in the second one would
 * overwrite the first one's score.
 *
 * A submitted assignment is not shown again — the questions come off the screen
 * and the score is reported in an alert instead — so the score has to survive
 * leaving the page. The backend has nowhere to read it back from: `/exam_marks`
 * is the only endpoint that returns marks and it is a write, restamping the
 * attempt's status and date every time it is called, so asking it again on a
 * revisit would rewrite the record of when the paper was actually handed in.
 *
 * Stored the same way as the answered-question set in AssignmentForm, and with
 * the same tolerance: a blocked or full localStorage costs the score line in the
 * alert, nothing more.
 */

const scoreKey = (empCode, emoduleId, sectionId, examType, attempt) =>
  `etms:score:${empCode || "anon"}:${emoduleId}:${sectionId}:${examType}:${attempt}`;

/**
 * Records a finished attempt.
 *
 * @param {{marks: number, total: number}} score
 */
export function rememberScore(
  empCode,
  emoduleId,
  sectionId,
  { marks, total },
  examType = DEFAULT_EXAM_TYPE,
  attempt = 0
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      scoreKey(empCode, emoduleId, sectionId, examType, attempt),
      JSON.stringify({ marks, total })
    );
  } catch {
    /* storage is full or blocked — the alert simply omits the score */
  }
}

/**
 * The remembered score, or null when this browser never saw the attempt — a
 * learner who submitted on their phone and reopened the course on a desktop.
 * Callers must handle that: the assignment still counts as submitted.
 *
 * @returns {{marks: number, total: number}|null}
 */
export function readScore(
  empCode,
  emoduleId,
  sectionId,
  examType = DEFAULT_EXAM_TYPE,
  attempt = 0
) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(
      scoreKey(empCode, emoduleId, sectionId, examType, attempt)
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // A hand-edited or half-written entry reads back as "not known" rather than
    // putting "You scored undefined out of NaN" in front of the learner.
    if (!Number.isFinite(parsed?.marks) || !Number.isFinite(parsed?.total)) {
      return null;
    }
    return { marks: parsed.marks, total: parsed.total };
  } catch {
    return null;
  }
}

/**
 * A finished attempt as a percentage, rounded to a whole number.
 *
 * Guarded against a paper with no questions: that cannot be submitted, but the
 * stored shape is only as trustworthy as the browser it came from, and a
 * division by zero here would put "NaN%" in front of the learner.
 */
export const scorePercent = ({ marks, total }) =>
  total > 0 ? Math.round((marks / total) * 100) : 0;

/**
 * "You scored 4 out of 5 questions (80%)." — one wording for both screens, the
 * alert shown on submit and the one shown on reopening a submitted paper.
 *
 * The percentage is what the course grade is banded from, so it is the number
 * the learner actually needs; the raw count stays because a bare "80%" gives
 * them no way to check it against the paper they just sat.
 *
 * Deliberately no letter grade. The A/B/C on the certificate is written by the
 * backend at completion and is course-wide, not per section — announcing a
 * grade here from one section's marks would contradict the certificate for any
 * course with more than one paper.
 */
export const scoreLine = ({ marks, total }) =>
  `You scored ${marks} out of ${total} question${total === 1 ? "" : "s"} (${scorePercent({ marks, total })}%).`;
