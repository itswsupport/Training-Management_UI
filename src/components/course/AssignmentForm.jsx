"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { alerts } from "@/lib/alerts";
import { apiErrorMessage } from "@/config/api";
import { encodeId } from "@/lib/courseId";
import { grantCourseAccess } from "@/lib/courseGrant";
import { rememberScore, scoreLine, scorePercent } from "@/lib/assignmentScore";
import { withReviewEmp } from "@/lib/courseReview";
import { DEFAULT_EXAM_TYPE, examTypeLabel } from "@/lib/examType";
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
const answeredKey = (empCode, emoduleId, sectionId, examType, attempt) =>
  `etms:answered:${empCode || "anon"}:${emoduleId}:${sectionId}:${examType}:${attempt}`;

function readAnswered(empCode, emoduleId, sectionId, examType, attempt) {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(
      answeredKey(empCode, emoduleId, sectionId, examType, attempt)
    );
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

/**
 * @param {boolean} [readOnly] a training officer checking the paper
 * @param {boolean} [submitted] this paper has already been handed in. The form
 *   still renders — with the answers given, and nothing clickable — so a
 *   learner can read back what they answered.
 * @param {Object<string, string>} [savedAnswers] `{questionId: answer}` as
 *   already submitted, which is what a paper in that state opens with
 * @param {boolean} [overdue] the course's quarter has lapsed; the paper can be
 *   read but no longer answered or submitted
 * @param {string} [reviewEmpCode] a training officer reading ONE employee's
 *   attempt, reached from COURSE STATUS. Set only on a read-only preview, and
 *   what turns the paper from a blank copy into a marked script
 * @param {Object<string, string>} [answerKey] `{questionId: correct ordinal}`,
 *   sent for a review and never otherwise — see AssignmentService
 */
export default function AssignmentForm({
  emoduleId,
  sectionId,
  empCode,
  examType = DEFAULT_EXAM_TYPE,
  questions,
  allQuestions,
  readOnly = false,
  submitted = false,
  savedAnswers = null,
  overdue = false,
  attempt = 0,
  reviewEmpCode = "",
  answerKey = null,
}) {
  const router = useRouter();

  /**
   * An officer marking somebody else's paper rather than anyone sitting one.
   *
   * The answers shown are that employee's, every option the key marks is called
   * out right or wrong, and the header carries the total. It is a stricter thing
   * than `readOnly`: an officer opening a module from ALL MODULES is read-only
   * too, but there is no attempt behind it to mark.
   */
  const review = Boolean(reviewEmpCode);
  /** Only where the key actually came through — see the page's `answerKey`. */
  const marking = review && Boolean(answerKey);

  // Falls back to the shown questions when the page did not narrow to a lecture.
  const sectionQuestions = allQuestions ?? questions;

  // Nothing can be answered or sent in any of these: an officer is checking the
  // paper, a learner looking back has already sat it, and an overdue course's
  // quarter has closed.
  const inert = readOnly || submitted || overdue;

  /**
   * A paper already handed in opens with its own answers marked; one being sat
   * opens blank.
   *
   * Only for a paper that is finished. Restoring a half-answered one would put
   * ticks against questions the learner is still working through, and the count
   * behind the SUBMIT button reads this — it would report the section as
   * answered when the answers came from the server rather than from this
   * sitting. `answeredBefore` below is what tracks that case.
   */
  const [answers, setAnswers] = useState(() =>
    // A review shows what was given whether or not the paper was ever handed
    // in: a half-answered attempt is exactly the thing an officer opens this
    // to look at, and blanking it would report it as untouched.
    (submitted || review) && savedAnswers ? { ...savedAnswers } : {}
  );
  const [answeredBefore, setAnsweredBefore] = useState(() =>
    readAnswered(empCode, emoduleId, sectionId, examType, attempt)
  );
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const answered = Object.keys(answers).length;

  /**
   * What the reviewed employee scored on this paper, or null when nobody is
   * being reviewed.
   *
   * Counted here against the key rather than read from `/exam_marks`. That
   * endpoint returns the same number, but it is a write dressed as a GET — it
   * restamps the attempt's status and date on every call — so asking it would
   * rewrite the record of when the paper was handed in every time an officer
   * merely looked at it.
   *
   * Over the whole paper, not the questions on screen: the section is what is
   * scored, and the marks column on COURSE STATUS totals the same thing, so a
   * lecture-narrowed view must not quietly report a different denominator.
   */
  const score = marking
    ? {
        marks: sectionQuestions.filter(
          (q) => answerKey[q.id] && answers[q.id] === answerKey[q.id]
        ).length,
        total: sectionQuestions.length,
      }
    : null;

  /**
   * A lapsed quarter is said once, in a dialog, rather than as a red band the
   * learner reads past on the way to a form that will not take their answers.
   *
   * The ref is what keeps it to once: React runs mount effects twice in
   * development, and `overdue` cannot change without a fresh page load.
   */
  const overdueTold = useRef(false);
  useEffect(() => {
    if (!overdue || overdueTold.current) return;
    overdueTold.current = true;
    alerts.warning(
      "Its quarter has closed, so this assignment can be read but no longer answered or submitted.",
      "Course overdue"
    );
  }, [overdue]);

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
            answeredKey(empCode, emoduleId, sectionId, examType, attempt),
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
        await saveAnswer({
          emoduleId,
          sectionId,
          questionId,
          answer,
          empCode,
          examType,
        });
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
    // A review carries whose attempt it is back to the course, or the papers
    // there would go back to reading the officer's own — which is nobody's.
    router.push(withReviewEmp(`/course/${encodeId(emoduleId)}`, reviewEmpCode));
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
      const result = await submitAssignment({
        emoduleId,
        sectionId,
        empCode,
        examType,
      });

      // The score, which `/exam_marks` returns and this screen used to throw
      // away. It is the whole section's running total — the backend re-scores
      // the attempt on every saved answer — so it is reported out of every
      // question in the section, not just the lecture that was on screen.
      const paperLabel = examTypeLabel(examType);
      const total = sectionQuestions.length;
      const score = scoreLine({ marks: result.marks, total });

      // Kept because this is the only moment the score is readable: the alert
      // below is the last time the paper is shown at all, and reopening a
      // submitted assignment reports the score from here rather than sitting
      // it again. See lib/assignmentScore.
      rememberScore(
        empCode,
        emoduleId,
        sectionId,
        { marks: result.marks, total },
        examType,
        attempt
      );

      // The dialog is awaited, so the learner reads their score before the page
      // moves on; where it moves to depends on whether this was the module's
      // last assignment. Handing in the pre assignment of a course that also has
      // a post assignment is never that — it used to be, which sent a learner
      // straight to the feedback form with half the course still ahead of them.
      if (result.feedbackRequired) {
        await alerts.success(
          `${score} That was the last assignment for this course.`,
          `${paperLabel} submitted`
        );
        grantCourseAccess(emoduleId);
        router.push(`/course/${encodeId(emoduleId)}/feedback`);
      } else {
        await alerts.success(
          `${score} Your answers have been submitted successfully.`,
          `${paperLabel} submitted`
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
          above, and CANCEL below returns to the course. The course name is not
          repeated: the page was reached from that course and its own header
          names it. */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#3482AE] px-4 py-2">
        <h2 className="text-white font-bold tracking-wide uppercase">
          {examTypeLabel(examType)}
        </h2>
        {/* The paper's total, on the right of the header. It is the one number
            a marked script is read for, and the marks columns on COURSE STATUS
            give it per course rather than per paper — so this is the only place
            the two papers are scored apart. */}
        {score ? (
          <span className="shrink-0 rounded bg-white/15 px-2.5 py-1 text-[12px] font-bold tracking-wide text-white ring-1 ring-white/25">
            Total marks {score.marks} / {score.total} ({scorePercent(score)}%)
          </span>
        ) : null}
      </div>

      <ol>
        {questions.map((question) => (
          <li key={question.id} className="border-t border-gray-200 px-4 py-3.5">
            {/* No lecture name over the question. The paper is the section's,
                and naming the lecture each question came from put a second
                heading above the first one and read as a group label for
                everything under it. */}
            <p className="mb-3 text-[12px] leading-snug font-bold text-gray-800 uppercase">
              {question.text}
            </p>

            {/* A / B on the first row, C / D on the second — the legacy form
                lays the four options out row-major across two columns. */}
            <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 md:grid-cols-2">
              {question.options.map((option) => {
                const chosen = answers[question.id] === option.value;
                /**
                 * The three states a marked script has: the right option, the
                 * wrong one that was picked, and everything else.
                 *
                 * `isKey` is drawn whether or not it was the one chosen — an
                 * officer reading a wrong answer needs to see what the right
                 * one was, which is the whole reason the key is fetched.
                 */
                const isKey =
                  marking && String(answerKey[question.id] ?? "") === option.value;
                const isWrong = marking && chosen && !isKey;
                // On a paper already handed in, the answer given is called out
                // rather than left to a greyed-out radio. A disabled radio is
                // the one control a browser draws faintest, which is exactly
                // backwards here: reading back what was answered is the whole
                // reason the paper is on screen. Stands down where the script
                // is being marked — right and wrong say more than "yours", and
                // three highlights on one row would say nothing at all.
                const marked = !marking && submitted && chosen;

                // Every highlighted row is boxed the same way, so right, wrong
                // and "your answer" differ only in colour. w-fit so the box
                // hugs the answer instead of stretching the width of the
                // column, and negative margins that undo its own padding —
                // without them a marked option's text would sit 8px right of
                // the ones beside it and knock the row out of line.
                const box = "w-fit -mx-2 -my-1 border px-2 py-1";
                const rowCls = isKey
                  ? `${box} border-[#20c997] bg-[#20c997]/10`
                  : isWrong
                    ? `${box} border-[#f23a4c] bg-[#f23a4c]/10`
                    : marked
                      ? `${box} border-[#3482AE] bg-[#eaf3f9]`
                      : "";
                const labelCls = isKey
                  ? "font-bold text-[#158765]"
                  : isWrong
                    ? "font-bold text-[#c92a3a]"
                    : marked
                      ? "font-bold text-[#2a6a8f]"
                      : "font-semibold text-[#3086b5]";

                return (
                  <label
                    key={option.value}
                    className={`flex items-start gap-2 rounded text-[12px] leading-snug uppercase ${
                      inert ? "cursor-default" : "cursor-pointer"
                    } ${rowCls}`}
                  >
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      value={option.value}
                      checked={chosen}
                      onChange={() => pick(question.id, option.value)}
                      disabled={inert}
                      className="mt-0.5 shrink-0 accent-[#3482AE]"
                    />
                    <span className="font-bold text-[#1f5f86]">
                      {OPTION_LETTERS[Number(option.value) - 1]})
                    </span>
                    <span className={labelCls}>{option.label}</span>
                    {/* A dot rather than a worded badge: the row is already
                        bordered and filled, so this only has to confirm which
                        one it is. The title carries the words for anyone who
                        needs them. */}
                    {marked ? (
                      <span
                        title="Your answer"
                        aria-label="Your answer"
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#3482AE]"
                      />
                    ) : isKey || isWrong ? (
                      // Worded rather than a dot, unlike the learner's own copy:
                      // there are two marks to tell apart here, and a green and
                      // a red dot on the same question is a legend the officer
                      // would have to be taught.
                      <span
                        className={`ml-1 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide whitespace-nowrap text-white ${
                          isKey ? "bg-[#20c997]" : "bg-[#f23a4c]"
                        }`}
                      >
                        {isKey
                          ? chosen
                            ? "Correct"
                            : "Correct answer"
                          : "Wrong answer"}
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
            {/* A question left blank on a paper that was handed in. Said
                plainly — an option row with nothing marked reads as a display
                fault otherwise. */}
            {(submitted || review) && !answers[question.id] ? (
              <p className="mt-2 text-[11px] normal-case text-gray-500">
                No answer was recorded for this question.
              </p>
            ) : null}
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
