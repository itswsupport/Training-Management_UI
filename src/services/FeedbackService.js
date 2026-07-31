/**
 * Course feedback — both the learner's form and the officer's question bank
 * (`etms_training_feedback_template`).
 *
 * Submitting the form is the only live transition to Completed: `/feedback/save`
 * sets every submit_exam row for the module to status 2, sets
 * `etms_alotted_emp.status = 2`, and calculates the employee's grade.
 */

import { api, sendForm, unwrap } from "@/config/api";
import { clean } from "@/utils/etmsFormat";
import { getAssignmentCount } from "./AssignmentService";
import { COURSE_STATUS, getUserCourses } from "./UserCourseService";

/** A question with no options is an open-ended (free-text) one. */
export const isOpenEnded = (question) => question.options.length === 0;

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
 * `/emodule/assignment/get_count` returns 1 once every section's assignment is
 * submitted — but it keeps returning 1 afterwards, so it alone can't say
 * whether the feedback has already been given. The course landing in the
 * employee's Completed list is what `/feedback/save` actually sets, so that is
 * what clears the prompt.
 */
export async function isFeedbackDue(empCode, emoduleId) {
  const [count, completed] = await Promise.all([
    getAssignmentCount(empCode, emoduleId),
    getUserCourses(empCode, COURSE_STATUS.COMPLETED),
  ]);
  if (count !== 1) return false;
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
