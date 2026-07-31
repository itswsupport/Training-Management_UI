/**
 * Employee-side assignment ("PRE" exam) reads and writes.
 *
 * The backend authors and grades an assignment one question at a time: every
 * radio click POSTs to `/submit_exam/save`, which re-scores the attempt on the
 * spot. There is no bulk submit — `/exam_marks` only stamps the attempt as done
 * and returns the running total.
 */

import { api, sendForm, unwrap } from "@/config/api";
import { clean, nowStamp } from "@/utils/etmsFormat";

/**
 * The section's questions, with each option's 1-based ordinal as its value —
 * that ordinal, not the text, is what the backend grades.
 *
 * NOTE: `/quiz/list` serialises the raw JPA entity, so the payload includes
 * `quaAnswer` (the correct option). It is dropped here so the answer key never
 * enters component state or the rendered page. It is still present on the wire;
 * hiding it properly requires a backend projection.
 *
 * @param {number|string} emoduleId
 * @param {number|string} sectionId
 */
export async function getAssignmentQuestions(emoduleId, sectionId) {
  const list =
    unwrap(
      await api.get("/quiz/list", {
        // lowercase "id" — the backend's @RequestParam name.
        params: { emoduleid: emoduleId, sectionId, examType: "PRE" },
      }),
      []
    ) ?? [];

  return list
    .filter((q) => q.id != null)
    .map((q) => ({
      id: q.id,
      // Null on questions written before assignments were lecture-wise — those
      // belong to the section as a whole.
      lectureId: q.lectureId ?? null,
      text: clean(q.quaName),
      options: [q.optionsOne, q.optionsTwo, q.optionsThree, q.optionsFour]
        // A blank option is skipped, so ordinals can have gaps — keep the
        // original index as `value` rather than re-numbering after the filter.
        .map((label, i) => ({ value: String(i + 1), label: clean(label) }))
        .filter((o) => o.label.length > 0),
    }));
}

/** True once the employee has submitted this section's assignment. */
export async function isAssignmentSubmitted(emoduleId, sectionId, empCode) {
  const result = unwrap(
    await api.get("/submit_exam/by_sectionid", {
      params: { emoduleId, sectionId, empCode },
    }),
    0
  );
  return result === 1;
}

/**
 * Records one answer. The backend grades as it goes — `/submit_exam/save`
 * re-scores the whole attempt on every call, including when an employee changes
 * their mind — so the form saves each radio click instead of batching.
 *
 * Callers must serialise these: the endpoint creates the attempt row with a
 * read-then-insert and no unique constraint, so two calls in flight at once
 * both insert, and every later save then fails with 501.
 */
export async function saveAnswer({
  emoduleId,
  sectionId,
  questionId,
  answer,
  empCode,
}) {
  unwrap(
    await sendForm("/submit_exam/save", {
      questionid: questionId,
      answer_id: answer,
      empCode,
      emoduleId,
      sectionId,
      type: "PRE",
    })
  );
}

/**
 * Finalises the attempt: stamps it as submitted and reads back the score.
 *
 * `/exam_marks` is a GET on the backend but it mutates (it writes status and
 * regDate and propagates completion to the employee's module row), so callers
 * should only reach it from an explicit submit action.
 *
 * @returns {Promise<{marks: number, feedbackRequired: boolean}>}
 */
export async function submitAssignment({ emoduleId, sectionId, empCode }) {
  const { regDate, regTime } = nowStamp();

  const result = unwrap(
    await api.get("/exam_marks", {
      params: {
        emodule_id: emoduleId,
        sectionId,
        emp_code: empCode,
        type: "PRE",
        status: 1,
        regDate,
        regTime,
      },
    })
  );

  // 1 = that was the module's last outstanding assignment, so the course
  // feedback form is now mandatory.
  const count = await getAssignmentCount(empCode, emoduleId);

  return { marks: result?.marks ?? 0, feedbackRequired: count === 1 };
}

/**
 * 1 once every section's assignment for this module has been submitted.
 * Keeps returning 1 afterwards, so it cannot alone tell whether the feedback
 * form is still outstanding — see FeedbackService.isFeedbackDue.
 */
export async function getAssignmentCount(empCode, emoduleId) {
  return unwrap(
    await api.get("/emodule/assignment/get_count", {
      params: { emp_code: empCode, emoduleId },
    }),
    0
  );
}
