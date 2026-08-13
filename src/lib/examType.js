/**
 * The two papers a section can carry.
 *
 * The backend has always stored this: every question row has a `quaType`, and
 * `/quiz/list` exact-matches it against the `examType` parameter. The front end
 * simply never sent anything but "PRE", so half the column was unreachable —
 * an officer had no way to write a post-test and no way to see one.
 *
 * `quaType` is a free-text column, not an enum, so these strings are the
 * contract. Keep them uppercase and exact: `/quiz/list?examType=post` matches
 * nothing.
 */

export const EXAM_TYPES = {
  PRE: "PRE",
  POST: "POST",
};

/** The default for anything written before there was a choice. */
export const DEFAULT_EXAM_TYPE = EXAM_TYPES.PRE;

/**
 * In the order they are sat, which is the order the toggle shows them in.
 * `short` is for a count pill or a badge, where the full label will not fit.
 */
export const EXAM_TYPE_LIST = [
  { value: EXAM_TYPES.PRE, label: "Pre Assignment", short: "Pre" },
  { value: EXAM_TYPES.POST, label: "Post Assignment", short: "Post" },
];

/** A question's paper, defaulting anything unmarked to PRE. */
export const examTypeOf = (question) => question?.examType || DEFAULT_EXAM_TYPE;

/** "Pre assignment" / "Post assignment", for a message or a heading. */
export const examTypeLabel = (type) =>
  type === EXAM_TYPES.POST ? "Post assignment" : "Pre assignment";
