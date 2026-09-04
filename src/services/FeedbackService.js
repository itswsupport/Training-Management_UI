/**
 * Course feedback — both the learner's form and the officer's question bank
 * (`etms_training_feedback_template`).
 *
 * Submitting the form is the only live transition to Completed: `/feedback/save`
 * sets every submit_exam row for the module to status 2, sets
 * `etms_alotted_emp.status = 2`, and calculates the employee's grade.
 */

import { api, sendForm, unwrap } from "@/config/api";
import { clean, displayStamp } from "@/utils/etmsFormat";
import { areAllPapersSubmitted } from "./AssignmentService";
import { COURSE_STATUS, getUserCourses } from "./UserCourseService";

/** A question with no options is an open-ended (free-text) one. */
export const isOpenEnded = (question) => question.options.length === 0;

/**
 * One employee's submitted feedback for one course, for the officer's review.
 *
 * The stored rows are self-contained: `/feedback/save` writes the question and
 * all five of its options alongside the answer, so what comes back is the form
 * as it stood when it was filled in. That matters — editing the question bank
 * afterwards does not rewrite what anyone answered, and reading the answers
 * against today's template would misreport every older submission.
 *
 * `selectedAnswer` is the chosen option's own text, not its index, so an answer
 * is readable without matching it back to a list.
 *
 * @param {string|number} empCode
 * @param {string|number} moduleId
 * @returns {Promise<{employeeName: string, courseName: string,
 *   submittedOn: {date: string, time: string},
 *   answers: {id: number, question: string, answer: string,
 *     options: string[], openEnded: boolean}[]}|null>} null when they have
 *   submitted nothing
 */
export async function getSubmittedFeedback(empCode, moduleId) {
  const rows =
    unwrap(
      await api.get("/feedback/by_emoduleId/byempcode", {
        params: { empCode, moduleId },
      }),
      []
    ) ?? [];

  if (rows.length === 0) return null;

  const [first] = rows;
  return {
    employeeName: clean(first.employeeName),
    courseName: clean(first.moduleName),
    submittedOn: displayStamp(first.regDate, first.regTime),
    answers: rows.map((row, index) => {
      const options = [
        row.optionOne,
        row.optionTwo,
        row.optionThree,
        row.optionFour,
        row.optionFive,
      ]
        .map(clean)
        .filter(Boolean);

      return {
        id: row.id ?? index,
        question: clean(row.question),
        answer: clean(row.selectedAnswer),
        options,
        // The same rule the form itself uses: no options means free text, and
        // the answer is whatever the employee typed.
        openEnded: options.length === 0,
      };
    }),
  };
}

/** The whole feedback form template, in display order. */
export async function getFeedbackQuestions() {
  const list = unwrap(await api.get("/feedback/quiz/list"), []) ?? [];
  return list.map((q) => ({
    id: q.id,
    question: clean(q.quaName),
    options: [
      q.optionsOne,
      q.optionsTwo,
      q.optionsThree,
      q.optionsFour,
      q.optionsFive,
    ]
      .map(clean)
      .filter((o) => o.length > 0),
  }));
}

/**
 * True when this employee still owes the course feedback form.
 *
 * Two halves, and neither answers it alone. `areAllPapersSubmitted` says the
 * assignments are finished, but stays true for ever afterwards, so it cannot
 * tell a course that owes feedback from one that has already given it. The
 * course landing in the employee's Completed list is what `/feedback/save`
 * actually sets, so that is what clears the prompt.
 *
 * This used to ask `/emodule/assignment/get_count` for the first half. It no
 * longer can — see `AssignmentService.areAllPapersSubmitted`.
 */
export async function isFeedbackDue(empCode, emoduleId) {
  const [finished, completed] = await Promise.all([
    areAllPapersSubmitted(empCode, emoduleId),
    getUserCourses(empCode, COURSE_STATUS.COMPLETED),
  ]);
  if (!finished) return false;
  return !completed.some((course) => String(course.id) === String(emoduleId));
}

/**
 * Submits the learner's feedback and completes the course.
 *
 * NOT idempotent — a second call recalculates the grade and writes a second set
 * of feedback rows, so callers must confirm `isFeedbackDue` first.
 *
 * @param {string} empCode
 * @param {number|string} emoduleId
 * @param {Record<string|number, string>} answers questionId → "1".."5" for an
 *   MCQ, or the free text for an open-ended question
 */
export async function submitFeedback(empCode, emoduleId, answers) {
  const entries = Object.entries(answers);
  if (entries.length === 0) {
    throw new Error("Please answer the feedback questions.");
  }

  // One param per answer rather than comma-joined (as the legacy form did):
  // Spring binds repeated params straight into the List<String>, so a comma
  // typed into a free-text answer cannot split it and misalign the questionIds.
  const questionIds = [];
  const selectedAnswers = [];
  entries.forEach(([questionId, answer]) => {
    const text = typeof answer === "string" ? answer.trim() : "";
    if (!text) throw new Error("Please answer every question.");
    questionIds.push(questionId);
    selectedAnswers.push(text);
  });

  unwrap(
    await sendForm("/feedback/save", {
      empCode,
      moduleId: emoduleId,
      questionIds,
      selectedAnswers,
    })
  );
}

/** Normalises a question into the backend's optionsOne..Five params. */
const toQuestionParams = (question, options) => {
  const five = Array.from({ length: 5 }, (_, i) => (options[i] ?? "").trim());
  return {
    quaName: question.trim(),
    optionsOne: five[0],
    optionsTwo: five[1],
    optionsThree: five[2],
    optionsFour: five[3],
    optionsFive: five[4],
  };
};

/** Officer: append a question to the feedback form. */
export async function addFeedbackQuestion(question, options = []) {
  unwrap(await sendForm("/feedback/quiz/save", toQuestionParams(question, options)));
}

/**
 * Officer: edit an existing question.
 *
 * Note: the backend's update ignores `optionsFive` (a known backend bug); it is
 * still sent so behaviour matches the legacy client exactly.
 */
export async function updateFeedbackQuestion(id, question, options = []) {
  unwrap(
    await sendForm(
      "/feedback/quiz/update",
      { id, ...toQuestionParams(question, options) },
      "put"
    )
  );
}

/** Officer: remove a question. The backend exposes delete as a GET. */
export async function deleteFeedbackQuestion(id) {
  unwrap(await api.get("/feedback/quiz/delete", { params: { id } }));
}
