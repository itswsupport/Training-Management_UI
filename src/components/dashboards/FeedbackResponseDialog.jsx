"use client";

import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";

import { apiErrorMessage } from "@/config/api";
import { getSubmittedFeedback } from "@/services/FeedbackService";

/**
 * One employee's submitted feedback for one course, read by the officer.
 *
 * A panel rather than a route: the officer is working down a list of hundreds
 * of rows, and a page they had to navigate back from would lose their place in
 * it — along with the year, quarter and status they filtered it by.
 *
 * For a scored question the whole scale is shown with the chosen point marked,
 * not just the answer. "Clear" on its own says nothing about whether that was
 * the best of five or the middle of three, and comparing two employees means
 * knowing where each answer sat.
 *
 * @param {object} props
 * @param {{empCode: string, moduleId: number, empName: string,
 *   course: string}} props.row the Course Status row being viewed
 * @param {() => void} props.onClose
 */
export default function FeedbackResponseDialog({ row, onClose }) {
  const [state, setState] = useState({ status: "loading" });
  const panelRef = useRef(null);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /**
   * The panel takes the keyboard while it is open and hands it back on close.
   *
   * Without this, focus is still on the VIEW button behind the backdrop, so Tab
   * walks the grid underneath the panel and a screen reader reads the table
   * rather than the feedback. The page is frozen too: a modal that scrolls the
   * list behind it loses the officer the row they opened.
   */
  useEffect(() => {
    const previous = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    return () => {
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const feedback = await getSubmittedFeedback(row.empCode, row.moduleId);
        if (cancelled) return;
        setState(
          feedback
            ? { status: "ready", feedback }
            : { status: "empty" }
        );
      } catch (err) {
        if (cancelled) return;
        setState({
          status: "error",
          message: apiErrorMessage(err, "Could not load this feedback."),
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [row.empCode, row.moduleId]);

  const feedback = state.status === "ready" ? state.feedback : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
      // A click on the backdrop closes; one inside the card must not, so the
      // panel below stops the event rather than the backdrop testing its target.
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Submitted feedback"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        // The same entrance every other panel in the app uses.
        className="animate-fadeInUp flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-md bg-white shadow-2xl outline-none"
      >
        <div className="flex shrink-0 items-start gap-3 bg-[#20c997] px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[13px] font-bold text-white uppercase">
              Feedback — {feedback?.employeeName || row.empName || row.empCode}
            </h2>
            <p className="mt-0.5 truncate text-[11px] text-white/90 normal-case">
              {feedback?.courseName || row.course}
              {feedback?.submittedOn?.date
                ? ` · submitted ${feedback.submittedOn.date} ${feedback.submittedOn.time}`
                : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-white transition hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {state.status === "loading" ? (
            <div className="flex justify-center p-8">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#20c997]" />
            </div>
          ) : state.status === "error" ? (
            <p className="p-4 text-center text-[12px] text-red-500">
              {state.message}
            </p>
          ) : state.status === "empty" ? (
            <p className="p-4 text-center text-[12px] text-gray-500 normal-case">
              This employee has not submitted the feedback form for this course.
            </p>
          ) : (
            // Ruled between questions rather than only spaced: on a form of a
            // dozen, a wrapped question and the scale under the one above it
            // otherwise run together.
            <ol className="divide-y divide-gray-100">
              {feedback.answers.map((entry, index) => (
                <li key={entry.id} className="py-3 first:pt-0 last:pb-0">
                  <p className="mb-2 text-[12px] font-semibold text-gray-800 normal-case">
                    {index + 1}. {entry.question}
                  </p>

                  {entry.openEnded ? (
                    <p className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-[12px] whitespace-pre-wrap text-gray-700 normal-case">
                      {entry.answer || "— no answer given —"}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {entry.options.map((option) => {
                        const chosen = option === entry.answer;
                        return (
                          <span
                            key={option}
                            className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] normal-case ${
                              chosen
                                ? "border-[#20c997] bg-[#20c997] font-semibold text-white shadow-sm"
                                : "border-gray-200 bg-gray-50 text-gray-500"
                            }`}
                          >
                            {chosen ? (
                              <Check className="h-3 w-3 shrink-0" />
                            ) : null}
                            {option}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-4 py-2.5">
          <p className="truncate text-[11px] text-gray-500 normal-case">
            {feedback
              ? `${feedback.answers.length} question${
                  feedback.answers.length === 1 ? "" : "s"
                }`
              : ""}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 cursor-pointer rounded bg-white px-4 py-1.5 text-[11px] font-bold tracking-wide text-gray-700 uppercase ring-1 ring-gray-300 transition hover:bg-gray-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
