"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { alerts } from "@/lib/alerts";
import { apiErrorMessage } from "@/config/api";
import { encodeId } from "@/lib/courseId";
import { grantCourseAccess } from "@/lib/courseGrant";
import { saveAnswer, submitAssignment } from "@/services/AssignmentService";

const OPTION_LETTERS = ["A", "B", "C", "D"];

// payroll's form action pair: a teal Apply and a red Cancel.
const SUBMIT_BTN =
  "px-6 py-2 bg-[#3482AE] text-white text-sm font-semibold rounded shadow hover:bg-[#2a6a8f] transition-colors cursor-pointer disabled:opacity-60";
const CANCEL_BTN =
  "px-6 py-2 bg-[#f23a4c] text-white text-sm font-semibold rounded shadow hover:bg-[#d92e3f] transition-colors cursor-pointer disabled:opacity-60";

/**
 * Which of the section's questions this learner has already answered.
 *
 * The backend scores each answer as it arrives but offers no way to read the
 * saved answers back, and finalising is per section — so a learner working
 * through one lecture at a time would otherwise submit a half-answered section
 * and lock themselves out of the rest. The set is kept per browser, the same
 * way the watched-lecture ticks are.
 */
const answeredKey = (empCode, emoduleId, sectionId) =>
  `etms:answered:${empCode || "anon"}:${emoduleId}:${sectionId}`;

function readAnswered(empCode, emoduleId, sectionId) {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(
      answeredKey(empCode, emoduleId, sectionId)
    );
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

/**
 * @param {boolean} [readOnly] a training officer checking the paper
 * @param {boolean} [submitted] the learner looking back at a paper they have
 *   already sat — the same inert form, but their own answers are filled in
 * @param {boolean} [overdue] the course's quarter has lapsed; the paper can be
 *   read but no longer answered or submitted
 * @param {Object<string, string>} [initialAnswers] what they answered, keyed by
 *   question id
 */
export default function AssignmentForm({
  emoduleId,
  sectionId,
  empCode,
  courseName,
  questions,
  allQuestions,
  lectureNames = {},
  lectureName = "",
  readOnly = false,
  submitted = false,
  overdue = false,
  initialAnswers = null,
}) {
  const router = useRouter();

  // Falls back to the shown questions when the page did not narrow to a lecture.
  const sectionQuestions = allQuestions ?? questions;

  // Nothing can be answered or sent in any of these: an officer is checking the
  // paper, a learner looking back has already sat it, and an overdue course's
  // quarter has closed.
  const inert = readOnly || submitted || overdue;

  const [answers, setAnswers] = useState(() => initialAnswers ?? {});
  const [answeredBefore, setAnsweredBefore] = useState(() =>
    readAnswered(empCode, emoduleId, sectionId)
  );
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const answered = Object.keys(answers).length;

  /**
   * Saves are chained rather than fired per click. `/submit_exam/save` creates
   * the attempt row with a read-then-insert and no unique constraint, so two
   * clicks in flight at once both insert. The attempt is then permanently
   * broken: the backend looks it up into an Optional, two rows make that throw,
   * and every later save comes back 501.
   */
  const queue = useRef(Promise.resolve());

  /** Records that one question now has an answer on the server. */
  const rememberAnswered = (questionId) => {
    setAnsweredBefore((prev) => {
      if (prev.has(questionId)) return prev;
      const next = new Set(prev);
      next.add(questionId);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(
            answeredKey(empCode, emoduleId, sectionId),
            JSON.stringify([...next])
          );
        } catch {
          // A full or blocked storage quota must not break the assignment.
        }
      }
      return next;
    });
  };

  /**
   * Finalising stamps the whole section, so it is only offered once every
   * question in it has an answer. Until then this lecture's answers are saved
   * and the learner carries on with the next lecture.
   */
  const outstanding = sectionQuestions.filter(
    (q) => !answeredBefore.has(q.id) && !answers[q.id]
  ).length;
  const canFinalise = outstanding === 0;

  /**
   * The backend scores each answer as it arrives, so a click is saved
   * immediately. The radio still updates optimistically — a failed save is
   * surfaced as an error and re-clicking retries it.
   */
  const pick = (questionId, answer) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
    setError(null);
    setSaving(true);

    queue.current = queue.current.then(async () => {
      try {
        await saveAnswer({ emoduleId, sectionId, questionId, answer, empCode });
        rememberAnswered(questionId);
      } catch (err) {
        setAnswers((prev) => {
          const next = { ...prev };
          delete next[questionId];
          return next;
        });
        const message = apiErrorMessage(
          err,
          "Could not save that answer. Please try again."
        );
        setError(message);
        alerts.toast.error(message);
      } finally {
        setSaving(false);
      }
    });
  };

  const back = () => {
    grantCourseAccess(emoduleId);
    router.push(`/course/${encodeId(emoduleId)}`);
  };

  const handleSubmit = async () => {
    setError(null);
    if (answered < questions.length) {
      const message = "Please answer all questions before submitting.";
      setError(message);
      alerts.warning(message, "Incomplete assignment");
      return;
    }

    // Other lectures in this section still have questions waiting. The answers
    // just given are already saved, so this only has to see the learner back.
    if (!canFinalise) {
      await queue.current;
      alerts.toast.success("Answers saved. Continue with the next lecture.");
      back();
      return;
    }

    setSubmitting(true);
    try {
      // Let any in-flight answer land first — /exam_marks only stamps the
      // attempt as done and reads back the running total.
      await queue.current;
      const result = await submitAssignment({ emoduleId, sectionId, empCode });

      // Marks are intentionally NOT shown to the employee — only that it went
      // in. The dialog is awaited, so the learner reads it before the page
      // moves on; where it moves to depends on whether this was the module's
      // last assignment.
      if (result.feedbackRequired) {
        await alerts.success(
          "This was the last assignment. The feedback form is mandatory — until you submit it, this course will not be marked completed.",
          "Assignment submitted"
        );
        grantCourseAccess(emoduleId);
        router.push(`/course/${encodeId(emoduleId)}/feedback`);
      } else {
        await alerts.success(
          "Your answers have been submitted successfully.",
          "Assignment submitted"
        );
        back();
      }
    } catch (err) {
      const message = apiErrorMessage(err, "Could not submit the assignment.");
      setError(message);
      // Only a failure puts the button back — after a successful submit it
      // stays disabled until the next page arrives, so the assignment cannot
      // be sent twice in that gap.
      setSubmitting(false);
      await alerts.error(message);
    }
  };

  return (
    <div className="bg-white rounded shadow border border-gray-200 overflow-hidden text-[12px]">
      {/* Header — no BACK button here: the course layout already provides one
          above, and CANCEL below returns to the course. */}
      <div className="bg-[#3482AE] px-4 py-2">
        <h2 className="text-white font-bold uppercase tracking-wide">Assignment</h2>
      </div>

      <div className="m-2 bg-[#cfe4f2] px-3 py-2 font-bold tracking-wide text-[#2f6685] uppercase">
        Course Name : {courseName}
        {lectureName ? <span> &nbsp;|&nbsp; Lecture : {lectureName}</span> : null}
      </div>

      {/* Says plainly why the button reads SAVE & CONTINUE rather than SUBMIT. */}
      {!inert && !canFinalise ? (
        <p className="mx-2 rounded border border-[#3482AE]/30 bg-[#eaf3f9] px-3 py-2 text-[12px] normal-case text-[#2f6685]">
          {outstanding} question{outstanding === 1 ? "" : "s"} in other lectures
          of this section are still unanswered. Your answers here are saved as
          you go; the section is submitted once they are all done.
        </p>
      ) : null}

      {/* Every inert case says why, because a form that quietly refuses to take
          a click reads as broken. The SUBMIT / CANCEL pair is not rendered for
          any of them. Overdue is checked first: a lapsed quarter is the reason
          nothing can be sent, whatever else is also true of the paper. */}
      {overdue ? (
        <p className="mx-2 rounded border border-[#dc3545] bg-[#dc3545]/10 px-3 py-2.5 text-[12px] normal-case text-[#c2384a]">
          This course is overdue. Its quarter has closed, so the assignment can
          be read but no longer answered or submitted. Please speak to your
          training officer.
        </p>
      ) : submitted ? (
        <p className="mx-2 rounded border border-[#20c997] bg-[#20c997]/10 px-3 py-2.5 text-[12px] normal-case text-[#158765]">
          You have already submitted this assignment. Your answers are shown
          below for reference — it cannot be answered again.
        </p>
      ) : readOnly ? (
        <p className="mx-2 rounded border border-[#ffc107] bg-[#ffc107]/10 px-3 py-2.5 text-[12px] normal-case text-[#a17200]">
          Preview only. This assignment is filled in by the employees the course
          is assigned to, so no answers can be saved or submitted here.
        </p>
      ) : null}

      <ol>
        {questions.map((question) => (
          <li key={question.id} className="border-t border-gray-200 px-4 py-3.5">
            {/* Questions written before assignments were lecture-wise carry no
                lecture, so the label is simply left off for those. */}
            {lectureNames[question.lectureId] ? (
              <p className="mb-1 text-[11px] font-semibold tracking-wide text-[#3482AE] uppercase">
                {lectureNames[question.lectureId]}
              </p>
            ) : null}
            <p className="mb-3 text-[12px] leading-snug font-bold text-gray-800 uppercase">
              {question.text}
            </p>

            {/* A / B on the first row, C / D on the second — the legacy form
                lays the four options out row-major across two columns. */}
            <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 md:grid-cols-2">
              {question.options.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-start gap-2 text-[12px] leading-snug uppercase ${
                    inert ? "cursor-default" : "cursor-pointer"
                  }`}
                >
                  <input
                    type="radio"
                    name={`question-${question.id}`}
                    value={option.value}
                    checked={answers[question.id] === option.value}
                    onChange={() => pick(question.id, option.value)}
                    disabled={inert}
                    className="mt-0.5 shrink-0 accent-[#3482AE]"
                  />
                  <span className="font-bold text-[#1f5f86]">
                    {OPTION_LETTERS[Number(option.value) - 1]})
                  </span>
                  <span className="font-semibold text-[#3086b5]">{option.label}</span>
                </label>
              ))}
            </div>
          </li>
        ))}
      </ol>

      {error ? (
        <p className="border-t border-[#dc3545]/30 bg-[#dc3545]/5 px-4 py-2.5 text-[12px] normal-case text-[#dc3545]">
          {error}
        </p>
      ) : null}

      <div className="h-16 border-t border-gray-200" />

      {inert ? null : (
        <div className="flex items-center justify-center gap-4 border-t border-gray-200 p-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || saving}
            className={SUBMIT_BTN}
          >
            {submitting
            ? "SUBMITTING..."
            : canFinalise
              ? "SUBMIT"
              : "SAVE & CONTINUE"}
          </button>
          <button type="button" onClick={back} className={CANCEL_BTN}>
            CANCEL
          </button>
        </div>
      )}
    </div>
  );
}
