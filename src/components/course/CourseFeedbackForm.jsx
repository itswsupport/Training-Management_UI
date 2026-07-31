"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { alerts } from "@/lib/alerts";
import { apiErrorMessage } from "@/config/api";
import { isOpenEnded, submitFeedback } from "@/services/FeedbackService";

const OPTION_LETTERS = ["A", "B", "C", "D", "E"];

// payroll's form action pair: a teal Apply and a red Cancel.
const SUBMIT_BTN =
  "px-6 py-2 bg-[#3482AE] text-white text-sm font-semibold rounded shadow hover:bg-[#2a6a8f] transition-colors cursor-pointer disabled:opacity-60";
const CANCEL_BTN =
  "px-6 py-2 bg-[#f23a4c] text-white text-sm font-semibold rounded shadow hover:bg-[#d92e3f] transition-colors cursor-pointer disabled:opacity-60";

export default function CourseFeedbackForm({
  emoduleId,
  empCode,
  courseName,
  questions,
}) {
  const router = useRouter();

  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const back = () => router.push(`/course/${emoduleId}`);
  const set = (questionId, value) =>
    setAnswers((prev) => ({ ...prev, [questionId]: value }));

  const handleSubmit = async () => {
    setError(null);

    const missing = questions.find((q) => !(answers[q.id] ?? "").trim());
    if (missing) {
      const message = isOpenEnded(missing)
        ? "Please provide feedback for the open-ended question."
        : "Please answer all questions before submitting.";
      setError(message);
      alerts.warning(message, "Incomplete form");
      return;
    }

    setSubmitting(true);
    try {
      await submitFeedback(empCode, emoduleId, answers);
      // The dialog is awaited, so the learner reads it before the page moves —
      // and it says the one thing this submit was for. It used to hand over to
      // a card that said the same and held a single link to the dashboard, so
      // finishing a course took one more click than it had any reason to.
      await alerts.success(
        "Your feedback has been submitted and this course is now complete. Your grade has been recorded.",
        "Course completed"
      );
      router.push("/UserDashboard");
    } catch (err) {
      const message = apiErrorMessage(err, "Could not submit the feedback form.");
      setError(message);
      // Only released on failure. `/feedback/save` is not idempotent — a second
      // submit writes another set of rows and re-grades the course — so the
      // button stays down while the dashboard loads.
      setSubmitting(false);
      await alerts.error(message);
    }
  };

  return (
    <div className="bg-white rounded shadow border border-gray-200 overflow-hidden text-[12px]">
      {/* Header — no BACK button here: the course layout already provides one
          above, and CANCEL below returns to the course. */}
      <div className="bg-[#3482AE] px-4 py-2">
        <h2 className="text-white font-bold uppercase tracking-wide">
          Training Feedback Form
        </h2>
      </div>

      <div className="m-2 bg-[#cfe4f2] px-3 py-2 font-bold tracking-wide text-[#2f6685] uppercase">
        Course Name : {courseName}
      </div>

      <p className="border-b border-gray-200 px-4 py-3 text-xs normal-case leading-relaxed text-gray-700">
        Dear Trainees,
        <br />
        Thank you for participating in our online training program. Your feedback
        is valuable to us and will help us improve our training modules. Please
        take a few moments to complete this feedback form.
      </p>

      <ol>
        {questions.map((question, index) => (
          <li key={question.id} className="border-b border-gray-200 px-4 py-3.5">
            <p className="mb-3 text-[12px] leading-snug font-bold text-gray-800 uppercase">
              {index + 1})&nbsp;&nbsp;{question.question}
            </p>

            {isOpenEnded(question) ? (
              <textarea
                rows={3}
                value={answers[question.id] ?? ""}
                onChange={(e) => set(question.id, e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-xs normal-case text-gray-800 outline-none focus:border-[#3482AE]"
              />
            ) : (
              // A/B then C/D then E — options run row-major down two columns,
              // the way the legacy form lays them out.
              <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 md:grid-cols-2">
                {question.options.map((option, i) => {
                  const value = String(i + 1);
                  return (
                    <label
                      key={i}
                      className="flex cursor-pointer items-start gap-2 text-[12px] leading-snug uppercase"
                    >
                      <input
                        type="radio"
                        name={`question-${question.id}`}
                        value={value}
                        checked={answers[question.id] === value}
                        onChange={() => set(question.id, value)}
                        className="mt-0.5 shrink-0 accent-[#3482AE]"
                      />
                      <span className="font-bold text-[#1f5f86]">
                        {OPTION_LETTERS[i]})
                      </span>
                      <span className="font-semibold text-[#3086b5]">{option}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </li>
        ))}
      </ol>

      {error ? (
        <p className="border-b border-[#dc3545]/30 bg-[#dc3545]/5 px-4 py-2.5 text-[12px] normal-case text-[#dc3545]">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-center gap-4 p-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className={SUBMIT_BTN}
        >
          {submitting ? "SUBMITTING..." : "SUBMIT"}
        </button>
        <button type="button" onClick={back} className={CANCEL_BTN}>
          CANCEL
        </button>
      </div>
    </div>
  );
}
