"use client";

import React, { useCallback, useState } from "react";

import PageOverlay from "@/components/ui/common/PageOverlay";
import { apiErrorMessage } from "@/config/api";
import { alerts } from "@/lib/alerts";
import {
  addFeedbackQuestion,
  updateFeedbackQuestion,
} from "@/services/FeedbackService";

const OPTION_LETTERS = ["A", "B", "C", "D", "E"];

// payroll form styling: teal uppercase labels over grey-bordered 12px fields.
const labelCls = "mb-1 block text-[12px] font-bold text-[#3482AE] uppercase";
const inputCls =
  "w-full rounded border border-gray-300 bg-white px-3 py-2 text-[12px] text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#3482AE] focus:ring-2 focus:ring-[#3482AE]/30";
const SUBMIT_BTN =
  "px-6 py-2 bg-[#3482AE] text-white text-sm font-semibold rounded shadow hover:bg-[#2a6a8f] transition-colors cursor-pointer disabled:opacity-60";
const CANCEL_BTN =
  "px-6 py-2 bg-[#f23a4c] text-white text-sm font-semibold rounded shadow hover:bg-[#d92e3f] transition-colors cursor-pointer disabled:opacity-60";

/** payroll's card header bar, with the step number in a translucent circle. */
function SectionHeader({ n, title }) {
  return (
    <div className="bg-[#3482AE] px-4 py-2 flex items-center gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20 text-white font-bold">
        {n}
      </span>
      <h2 className="text-white font-bold uppercase tracking-wide">{title}</h2>
    </div>
  );
}

/**
 * Add / edit one feedback question, as a full-page overlay matching the
 * Training Module form.
 *
 * A question is either multiple-choice (five options) or open-ended (free
 * text) — the backend stores the latter as a question with no options.
 */
export default function FeedbackQuestionForm({ open, initial, onClose, onSaved }) {
  const isEdit = Boolean(initial);

  const [openEnded, setOpenEnded] = useState(
    isEdit ? initial.options.length === 0 : false
  );
  const [question, setQuestion] = useState(initial?.question ?? "");
  const [options, setOptions] = useState(() => {
    const base = initial?.options ?? [];
    return Array.from({ length: 5 }, (_, i) => base[i] ?? "");
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  /** BACK, Esc and CANCEL all close the overlay outright — no confirmation. */
  const handleBack = useCallback(() => onClose?.(), [onClose]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    // payroll surfaces a validation miss as a warning popup, not just inline
    // text, so the officer sees it without scrolling back up the form.
    const reject = (message, title) => {
      setError(message);
      alerts.warning(message, title);
    };

    if (!question.trim()) {
      return reject("Please enter the question.", "Missing question");
    }
    const payloadOptions = openEnded ? [] : options.map((o) => o.trim());
    if (!openEnded && payloadOptions.some((o) => !o)) {
      return reject(
        "Please fill all five options, or switch to open-ended.",
        "Missing options"
      );
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        await updateFeedbackQuestion(initial.id, question.trim(), payloadOptions);
      } else {
        await addFeedbackQuestion(question.trim(), payloadOptions);
      }
      await alerts.success(
        isEdit ? "Question updated successfully." : "Question added successfully."
      );
      onSaved?.();
    } catch (err) {
      const message = apiErrorMessage(err, "Could not save the question.");
      setError(message);
      await alerts.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageOverlay
      open={open}
      title={isEdit ? "Update Feedback Question" : "Add Feedback Question"}
      onBack={handleBack}
      // Opened from within the Feedback Form overlay, so it sits above it.
      zIndex={60}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 1. ANSWER TYPE */}
        <section className="bg-white rounded shadow border border-gray-200 overflow-hidden text-[12px]">
          <SectionHeader n={1} title="Answer Type" />
          <div className="p-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  open: false,
                  label: "MULTIPLE CHOICE",
                  hint: "The learner picks one of five options",
                },
                {
                  open: true,
                  label: "OPEN-ENDED",
                  hint: "The learner answers in free text",
                },
              ].map((choice) => (
                <label
                  key={choice.label}
                  className={`flex cursor-pointer items-start gap-2.5 rounded border px-4 py-3 transition-colors ${
                    openEnded === choice.open
                      ? "border-[#3482AE] bg-[#eaf3f9]"
                      : "border-gray-300 hover:border-[#3482AE]"
                  }`}
                >
                  <input
                    type="radio"
                    name="questionType"
                    className="mt-0.5 w-4 h-4 accent-[#3482AE]"
                    checked={openEnded === choice.open}
                    onChange={() => setOpenEnded(choice.open)}
                  />
                  <span className="min-w-0">
                    <span className="block font-bold text-gray-800">
                      {choice.label}
                    </span>
                    <span className="block normal-case text-gray-500">
                      {choice.hint}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </section>

        {/* 2. QUESTION DETAILS */}
        <section className="bg-white rounded shadow border border-gray-200 overflow-hidden text-[12px]">
          <SectionHeader n={2} title="Question Details" />
          <div className="p-3 space-y-4">
            <div>
              <label htmlFor="feedback-question" className={labelCls}>
                Question:<span className="text-red-500 ml-1">*</span>
              </label>
              <textarea
                id="feedback-question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={3}
                placeholder="e.g. How would you rate the trainer's subject knowledge?"
                className={`${inputCls} resize-y normal-case`}
              />
            </div>

            {!openEnded ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                {options.map((option, i) => (
                  <div
                    key={i}
                    // Balance the odd fifth option across the full width.
                    className={i === options.length - 1 ? "md:col-span-2" : ""}
                  >
                    <label htmlFor={`feedback-option-${i}`} className={labelCls}>
                      Option {OPTION_LETTERS[i]}:
                      <span className="text-red-500 ml-1">*</span>
                    </label>
                    <input
                      id={`feedback-option-${i}`}
                      value={option}
                      onChange={(e) =>
                        setOptions((prev) =>
                          prev.map((o, j) => (j === i ? e.target.value : o))
                        )
                      }
                      placeholder={`Option ${OPTION_LETTERS[i]}`}
                      className={inputCls}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-md border border-dashed border-gray-300 bg-[#f4f6f9] px-4 py-6 text-center text-[12px] text-gray-500">
                Open-ended questions have no options — the learner types their
                own answer.
              </p>
            )}

            {error ? (
              <p className="text-[11px] font-semibold text-[#f23a4c]">{error}</p>
            ) : null}

            {/* payroll puts the Apply/Cancel pair centred at the foot of a form. */}
            <div className="flex items-center justify-center gap-4 border-t border-gray-200 pt-4">
              <button type="submit" disabled={submitting} className={SUBMIT_BTN}>
                {submitting ? "SUBMITTING..." : isEdit ? "UPDATE" : "SAVE"}
              </button>
              <button
                type="button"
                onClick={handleBack}
                disabled={submitting}
                className={CANCEL_BTN}
              >
                CANCEL
              </button>
            </div>
          </div>
        </section>
      </form>
    </PageOverlay>
  );
}
