/**
 * Employee-side assignment ("PRE" exam) reads and writes.
 *
 * The backend authors and grades an assignment one question at a time: every
 * radio click POSTs to `/submit_exam/save`, which re-scores the attempt on the
 * spot. There is no bulk submit — `/exam_marks` only stamps the attempt as done
 * and returns the running total.
 */

import { api, sendForm, unwrap } from "@/config/api";
import { DEFAULT_EXAM_TYPE } from "@/lib/examType";
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
 * `withAnswerKey` is the one exception, and it is deliberately opt-in per call
 * rather than a property of the endpoint: a training officer reviewing somebody
 * else's finished attempt needs the key to mark it, and that page is the only
 * caller that passes it. Every learner-facing call leaves it off and gets the
 * same stripped question it always did.
 *
 * @param {number|string} emoduleId
 * @param {number|string} sectionId
 * @param {string} [examType] which paper — "PRE" or "POST"
 * @param {{withAnswerKey?: boolean}} [options]
 */
export async function getAssignmentQuestions(
  emoduleId,
  sectionId,
  examType = DEFAULT_EXAM_TYPE,
  { withAnswerKey = false } = {}
) {
  const list =
    unwrap(
      await api.get("/quiz/list", {
        // lowercase "id" — the backend's @RequestParam name.
        params: { emoduleid: emoduleId, sectionId, examType },
      }),
      []
    ) ?? [];

  return list
    .filter((q) => q.id != null)
    .map((q) => ({
      id: q.id,
      // What the row says, not what was asked for.
      examType: q.quaType || DEFAULT_EXAM_TYPE,
      // Null on questions written before assignments were lecture-wise — those
      // belong to the section as a whole.
      lectureId: q.lectureId ?? null,
      // The correct option's 1-based ordinal — the same shape as an option's
      // `value` below, so the two compare directly. 0 on a question saved
      // without a key, which can then mark nothing right. Absent entirely
      // unless the caller asked for it.
      ...(withAnswerKey ? { answer: Number(q.quaAnswer) || 0 } : {}),
      text: clean(q.quaName),
      options: [q.optionsOne, q.optionsTwo, q.optionsThree, q.optionsFour]
        // A blank option is skipped, so ordinals can have gaps — keep the
        // original index as `value` rather than re-numbering after the filter.
        .map((label, i) => ({ value: String(i + 1), label: clean(label) }))
        .filter((o) => o.label.length > 0),
    }));
}

/**
 * The answers this learner already submitted for one section, keyed by question.
 *
 * `/submit_exam/save` records each answer as it is clicked, but nothing could
 * read them back — so a submitted assignment was a dead end and the learner
 * could not see what they had actually answered. The endpoint is scoped to the
 * caller's own attempt and carries no correct answers, since the paper is shown
 * read-only and cannot be sat again.
 *
 * @returns {Promise<Object<string, string>>} `{questionId: answer}`, empty when
 *   nothing has been submitted
 */
export async function getSubmittedAnswers(emoduleId, sectionId, empCode) {
  const list =
    unwrap(
      await api.get("/submit_exam/answers", {
        params: { emoduleId, sectionId, empCode },
      }),
      []
    ) ?? [];

  const byQuestion = {};
  list.forEach((row) => {
    if (row?.questionId == null) return;
    byQuestion[row.questionId] = {
      // The options are matched on their 1-based ordinal as a string, the same
      // shape `getAssignmentQuestions` gives each option's `value`.
      answer: String(row.answer ?? ""),
      // Whether the paper this answer belongs to was actually handed in — not
      // the same as the answer existing. See isPaperSubmitted.
      submitted: Boolean(row.submitted),
    };
  });
  return byQuestion;
}

/**
 * Has this learner HANDED IN one paper?
 *
 * The per-paper stand-in for `isAssignmentSubmitted`, which cannot tell the two
 * apart. A question id belongs to exactly one paper, so the paper is found by
 * its questions — but every question having an answer is not enough on its own.
 *
 * Answers are written to the server on each radio click, so they exist from the
 * first question onwards; the attempt is only marked handed in when the learner
 * presses SUBMIT. Reading "every question has an answer" as submitted meant a
 * one-question paper counted as sat the instant it was touched, which marked
 * its section complete and, on a course returned after a grade C, made the
 * retake look finished before it had been started. So both are required: every
 * question answered, on an attempt that was actually handed in.
 *
 * @param {Array<{id: number}>} questions one paper's questions
 * @param {Object<string, {answer: string, submitted: boolean}>} answered from
 *   `getSubmittedAnswers`
 */
export function isPaperSubmitted(questions, answered) {
  if (!questions?.length || !answered) return false;
  return questions.every((q) => {
    const given = answered[q.id];
    return Boolean(given?.submitted) && given.answer !== "";
  });
}

/**
 * True once the employee has finalised an attempt on this section.
 *
 * SECTION-WIDE, not per paper: `/submit_exam/by_sectionid` takes no `type` and
 * ignores one if sent (verified against a real attempt — `type=PRE`, `type=POST`
 * and no type all return the same answer). So it cannot say WHICH paper was
 * handed in, and the pre / post rows in the course content work out their own
 * state from `getSubmittedAnswers` instead, whose rows carry question ids that
 * do belong to one paper or the other.
 */
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
  examType = DEFAULT_EXAM_TYPE,
}) {
  unwrap(
    await sendForm("/submit_exam/save", {
      questionid: questionId,
      answer_id: answer,
      empCode,
      emoduleId,
      sectionId,
      type: examType,
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
export async function submitAssignment({
  emoduleId,
  sectionId,
  empCode,
  examType = DEFAULT_EXAM_TYPE,
}) {
  const { regDate, regTime } = nowStamp();

  const result = unwrap(
    await api.get("/exam_marks", {
      params: {
        emodule_id: emoduleId,
        sectionId,
        emp_code: empCode,
        type: examType,
        status: 1,
        regDate,
        regTime,
      },
    })
  );

  // 1 = every paper of every section is now in, so the course feedback form is
  // mandatory. It counts papers, not sections, so a course carrying both a pre
  // and a post assignment only reaches 1 once the post one has been handed in
  // too — which is what keeps the pre assignment from closing a course off.
  const count = await getAssignmentCount(empCode, emoduleId);

  return { marks: result?.marks ?? 0, feedbackRequired: count === 1 };
}

/**
 * 1 once every paper of every section — pre and post alike — has been submitted
 * for this module. Keeps returning 1 afterwards, so it cannot alone tell whether
 * the feedback form is still outstanding — see FeedbackService.isFeedbackDue.
 */
export async function getAssignmentCount(empCode, emoduleId) {
  return unwrap(
    await api.get("/emodule/assignment/get_count", {
      params: { emp_code: empCode, emoduleId },
    }),
    0
  );
}
