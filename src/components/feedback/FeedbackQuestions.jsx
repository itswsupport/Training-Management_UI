"use client";

import React, { useState } from "react";
import { Chip } from "@mui/material";
import { Pencil, Plus, Trash2 } from "lucide-react";

import FeedbackQuestionForm from "./FeedbackQuestionForm";
import { alerts } from "@/lib/alerts";
import { apiErrorMessage } from "@/config/api";
import { deleteFeedbackQuestion, isOpenEnded } from "@/services/FeedbackService";

const OPTION_LETTERS = ["A", "B", "C", "D", "E"];

export default function FeedbackQuestions({
  data = [],
  loading = false,
  error = null,
  onRetry,
  onChanged,
}) {
  const [editing, setEditing] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const handleDelete = async (question) => {
    const confirmed = await alerts.confirm(
      "You will not be able to recover this question.",
      { title: "Delete this question?", confirmText: "Delete", danger: true }
    );
    if (!confirmed) return;

    setBusyId(question.id);
    setActionError(null);
    try {
      await deleteFeedbackQuestion(question.id);
      alerts.toast.success("Question deleted");
      onChanged?.();
    } catch (err) {
      const message = apiErrorMessage(err, "Could not delete the question.");
      setActionError(message);
      await alerts.error(message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-white rounded shadow border border-gray-200 overflow-hidden text-[12px]">
      {/* Header */}
      <div className="bg-[#dc3545] px-4 py-2 flex items-center justify-between">
        <h2 className="text-white font-bold uppercase tracking-wide">
          Feedback Questions
        </h2>
        <button
          onClick={() => setEditing({ mode: "add" })}
          className="flex items-center gap-2 px-4 py-1.5 bg-white text-[#dc3545] text-sm font-semibold rounded shadow hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          ADD QUESTION
        </button>
      </div>

      <div className="p-3 space-y-4">
        {actionError ? (
          <div className="text-red-500 p-4 text-center">{actionError}</div>
        ) : null}

        {loading ? (
          <div className="flex justify-center items-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#dc3545]"></div>
          </div>
        ) : error ? (
          <div className="text-red-500 p-4 text-center">
            {error}
            {onRetry ? (
              <button onClick={onRetry} className="ml-2 text-blue-600 hover:underline">
                Retry
              </button>
            ) : null}
          </div>
        ) : data.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            No feedback questions found
          </div>
        ) : (
          <div className="border border-gray-200 rounded overflow-hidden">
            {data.map((question, index) => (
              <article
                key={question.id}
                className="flex gap-3 border-b border-gray-200 last:border-b-0 p-3"
              >
                {/* The number is the question's position on the form. */}
                <span className="bg-[#3482AE] text-white px-2 py-1 rounded text-xs font-semibold h-fit shrink-0">
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-3">
                    {/* The question is a sentence, so it opts out of the global
                        uppercase and renders as the officer typed it. */}
                    <h3 className="min-w-0 flex-1 font-semibold normal-case text-gray-800 leading-relaxed">
                      {question.question}
                    </h3>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => setEditing({ mode: "edit", question })}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded shadow hover:bg-blue-700 transition-colors cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" />
                        EDIT
                      </button>
                      <button
                        disabled={busyId === question.id}
                        onClick={() => handleDelete(question)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-[#f23a4c] text-white text-sm font-semibold rounded shadow hover:bg-[#d92e3f] transition-colors cursor-pointer disabled:opacity-60"
                      >
                        <Trash2 className="w-4 h-4" />
                        {busyId === question.id ? "DELETING..." : "DELETE"}
                      </button>
                    </div>
                  </div>

                  {isOpenEnded(question) ? (
                    <Chip
                      label="OPEN-ENDED — FREE TEXT"
                      size="small"
                      sx={{
                        marginTop: "8px",
                        backgroundColor: "#f3f4f6",
                        color: "#6b7280",
                        fontWeight: 600,
                        fontSize: "11px",
                        fontFamily: "Exo",
                        border: "1px solid #6b7280",
                      }}
                    />
                  ) : (
                    <ul className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                      {question.options.map((option, i) => (
                        <li key={i} className="flex items-baseline gap-2 text-gray-600">
                          <span aria-hidden className="font-bold text-[#3482AE]">
                            {OPTION_LETTERS[i]}
                          </span>
                          <span className="min-w-0">{option}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* `key` remounts the form per target, so its fields reset between an
          Add and an Edit of different questions. */}
      {editing ? (
        <FeedbackQuestionForm
          key={editing.mode === "edit" ? editing.question.id : "add"}
          open
          initial={editing.mode === "edit" ? editing.question : null}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged?.();
          }}
        />
      ) : null}
    </div>
  );
}
