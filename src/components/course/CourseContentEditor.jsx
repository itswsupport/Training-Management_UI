"use client";

import React, { useCallback, useImperativeHandle, useRef, useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";

import { alerts } from "@/lib/alerts";
import { apiErrorMessage } from "@/config/api";
import { useAuth } from "@/context/AuthContext";
import { getEmpCode } from "@/lib/permissions";
import {
  clearLectureFile,
  clearLectureVideo,
  deleteQuizQuestion,
  getSectionQuestions,
  getSections,
  pickedMaterialRun,
  saveQuizQuestion,
  saveSection,
  updateQuizQuestion,
  updateSection,
} from "@/services/ModuleService";
import { fileName } from "@/utils/etmsFormat";

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".ogg", ".mov", ".avi", ".mkv", ".wmv", ".m4v"];
const FILE_EXTENSIONS = [".pdf", ".xls", ".xlsx", ".csv", ".jpg", ".jpeg", ".png"];
const VIDEO_ACCEPT = `video/*,${VIDEO_EXTENSIONS.join(",")}`;
const FILE_ACCEPT = FILE_EXTENSIONS.join(",");
const FILE_LABEL = "PDF, Excel, CSV, JPG, PNG";

const hasAllowedExtension = (file, extensions) => {
  const name = (file?.name ?? "").toLowerCase();
  return extensions.some((ext) => name.endsWith(ext));
};

const labelCls = "mb-1 block text-[12px] font-bold text-[#3482AE] uppercase";
const subLabelCls =
  "mb-1 block text-[11px] font-semibold tracking-wide text-gray-600 uppercase";
const inputCls =
  "w-full rounded border border-gray-300 bg-white px-3 py-2 text-[12px] text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#3482AE] focus:ring-2 focus:ring-[#3482AE]/30";
const fileInputCls =
  "w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-[12px] text-gray-500 file:mr-2 file:cursor-pointer file:rounded file:border-0 file:bg-[#3482AE] file:px-2.5 file:py-1 file:text-[12px] file:font-semibold file:text-white hover:file:bg-[#2a6a8f]";
const addMoreBase =
  "inline-flex cursor-pointer items-center gap-2 rounded border border-dashed border-[#3482AE]/60 text-[12px] font-semibold tracking-wide text-[#3482AE] uppercase transition";
/** Sized to sit inside a heading row rather than under the list it adds to. */
const addMoreInlineCls = `${addMoreBase} bg-[#eaf3f9]/60 px-3 py-1.5 hover:bg-[#eaf3f9]`;
/** …the same, for a heading row that is itself tinted and needs contrast. */
const addMoreOnTintCls = `${addMoreBase} bg-white px-3 py-1.5 hover:bg-white/70`;
/** …and for the solid blue card header, where a dashed outline would vanish. */
const addOnHeaderCls =
  "inline-flex shrink-0 cursor-pointer items-center gap-2 rounded bg-white px-3 py-1.5 text-[12px] font-bold tracking-wide text-[#2a6a8f] uppercase shadow-sm transition hover:bg-white/90";

/**
 * A lecture in edit state: existing material paths plus any newly picked file.
 *
 * The two nonces exist only to remount the file inputs. A file input holds its
 * own DOM value, and clearing our state does not clear that — without the
 * remount the browser goes on showing the old filename and, worse, re-picking
 * the same file fires no change event at all.
 */
const toEditableLecture = (lecture) => ({
  id: lecture.id ?? 0,
  name: lecture.name ?? "",
  link: lecture.link ?? "",
  existingVideo: lecture.materialVideo ?? null,
  existingFile: lecture.materialFile ?? null,
  video: null,
  file: null,
  videoNonce: 0,
  fileNonce: 0,
  // Set when the X takes a stored upload off. Saving a section can only put
  // material on, so a removal is its own call and has to be remembered.
  clearedVideo: false,
  clearedFile: false,
});

const emptyLecture = () => ({
  id: 0,
  name: "",
  link: "",
  existingVideo: null,
  existingFile: null,
  video: null,
  file: null,
  videoNonce: 0,
  fileNonce: 0,
  clearedVideo: false,
  clearedFile: false,
});

/**
 * One lecture's file picker: the input, whatever is attached now, and an X to
 * take it off.
 *
 * The X clears in two steps, least destructive first. With a file just picked
 * it drops that pick and the stored one shows through again; with nothing
 * picked it clears the stored one, which is what actually removes the material
 * when the section is saved.
 */
function MaterialField({
  label,
  accept,
  picked,
  existing,
  nonce,
  onPick,
  onClear,
}) {
  const attached = picked
    ? picked.name
    : existing
      ? `Current: ${fileName(existing)}`
      : "";

  return (
    <div>
      <span className={subLabelCls}>{label}</span>
      <input
        // Remounts on clear; see toEditableLecture.
        key={nonce}
        type="file"
        accept={accept}
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        className={fileInputCls}
      />
      <p className="mt-1 flex items-center gap-1.5 text-[11px] normal-case text-gray-500">
        <span className="min-w-0 truncate">{attached || "None"}</span>
        {attached ? (
          <button
            type="button"
            onClick={onClear}
            title={picked ? "Remove this selection" : "Remove this material"}
            aria-label={`Remove ${label}`}
            className="shrink-0 cursor-pointer rounded-full p-0.5 text-gray-400 transition hover:bg-[#dc3545]/10 hover:text-[#dc3545]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </p>
    </div>
  );
}

const OPTION_LETTERS = ["A", "B", "C", "D"];

const emptyQuestion = (key, lectureIndex) => ({
  key,
  id: 0,
  name: "",
  options: ["", "", "", ""],
  // No option is correct until the officer says so — defaulting to A would
  // silently grade everyone against the wrong key.
  answer: 0,
  lectureIndex,
  isNew: true,
  dirty: true,
});

const toEditableSection = (section) => ({
  id: section.id ?? 0,
  name: section.name ?? "",
  lectures: (section.lectures ?? []).map(toEditableLecture),
});

/**
 * A question belongs to a lecture by its POSITION in the section, not by that
 * lecture's id.
 *
 * The id is the obvious key but it is the wrong one here: a question can be
 * written against a lecture the officer has only just typed in, which has no id
 * until the section is saved. Positions exist immediately, survive the save
 * (the endpoint rewrites a section's lectures in the order they are sent), and
 * are turned back into ids at the last moment, once the server has assigned
 * them. That is what lets a brand-new lecture carry questions straight away.
 */
const questionsInSlot = (section, slot) =>
  section.questions.filter((q) => q.lectureIndex === slot);

/**
 * Puts each question the server returned under a lecture position.
 *
 * A question stored against a lecture lands on it. Questions written before
 * assignments were lecture-wise carry no lecture at all; they are spread across
 * the lectures in order, any left over going under the last one, which is where
 * they have always been shown.
 */
function withLectureSlots(questions, lectures) {
  let loose = 0;
  const lastSlot = Math.max(lectures.length - 1, 0);
  return questions.map((q) => {
    const known = lectures.findIndex((l) => l.id && l.id === q.lectureId);
    return {
      ...q,
      lectureIndex: known >= 0 ? known : Math.min(loose++, lastSlot),
    };
  });
}

/**
 * How a question is named on screen: numbering restarts at 1 under each
 * lecture, so "question 2" means the second question of that lecture rather
 * than the second of the whole section.
 */
function questionLabel(section, question) {
  const slot = question.lectureIndex;
  const position = questionsInSlot(section, slot).indexOf(question) + 1;
  return slot >= 0
    ? `Lecture ${slot + 1}, question ${position}`
    : `Question ${position}`;
}

/** Checks one question. Returns the first problem, or null when it is good. */
function validateQuestion(question, label) {
  if (!question.name.trim()) return `${label} needs text.`;
  if (question.options.some((o) => !o.trim()))
    return `${label} needs all four options.`;
  if (!question.answer) return `${label}: mark the correct option.`;
  return null;
}

/** "lecture 1" / "lectures 1–3", for the message below. */
const lecturesUpTo = (last) =>
  last === 1 ? "lecture 1" : `lectures 1–${last}`;

/**
 * What a section that is already on the server cannot be asked to do.
 *
 * Editing one goes to `/emodule/section/update`, which rewrites the rows the
 * section already holds — it cannot grow or shrink that list, and it writes
 * material positionally from the first lecture down. Saying so here beats the
 * alternative the endpoint leaves: falling back to the insert path, which is
 * what used to bury a second copy of the whole section at the foot of the
 * course.
 */
function validateSavedShape(section) {
  const saved = section.savedLectureCount ?? section.lectures.length;
  if (section.lectures.length > saved) {
    return `A lecture cannot be added to a section that is already saved — the training service only rewrites the ${saved} it already holds. Put the new lecture in a new section.`;
  }
  if (section.lectures.length < saved) {
    return "A lecture cannot be removed from a section that is already saved — the training service has no way to delete one.";
  }
  for (const kind of ["video", "file"]) {
    const run = pickedMaterialRun(section.lectures, kind);
    const last = section.lectures.reduce((at, l, i) => (l[kind] ? i : at), -1);
    if (last >= run) {
      return `Lecture ${last + 1}: a saved section's ${kind}s are rewritten in order from the first lecture, so re-attach the ${kind} for ${lecturesUpTo(last)} as well.`;
    }
  }
  return null;
}

function validateSection(section) {
  if (!section.name.trim()) return "Please enter a section name.";
  if (section.lectures.length === 0) return "A section needs at least one lecture.";
  for (let i = 0; i < section.lectures.length; i += 1) {
    const l = section.lectures[i];
    if (!l.name.trim()) return `Lecture ${i + 1} needs a name.`;
    if (l.video && !hasAllowedExtension(l.video, VIDEO_EXTENSIONS))
      return `Lecture ${i + 1}: the video must be a video file.`;
    if (l.file && !hasAllowedExtension(l.file, FILE_EXTENSIONS))
      return `Lecture ${i + 1}: the file must be one of ${FILE_LABEL}.`;
    const hasMaterial =
      l.video || l.file || l.link.trim() || l.existingVideo || l.existingFile;
    if (!hasMaterial) return `Lecture ${i + 1} needs a video, a file, or a link.`;
  }
  return section.isNew ? null : validateSavedShape(section);
}

/**
 * One section's editor. It holds no state of its own — the whole list lives in
 * CourseContentEditor so the page's single SAVE can write every touched section.
 */
/**
 * One assignment question's editor.
 *
 * The lecture dropdown offers every lecture in the section by position, so a
 * question can be moved onto one that has not been saved yet.
 */
function QuestionCard({ index, question, lectures, onPatch, onRemove }) {
  return (
    <div className="rounded border border-gray-200 bg-[#f8f9fa] p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[12px] font-bold tracking-wide text-gray-600 uppercase">
          Question {index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="rounded px-2 py-1 text-[12px] font-semibold tracking-wide text-[#dc3545] uppercase transition hover:bg-[#dc3545]/10"
        >
          Remove
        </button>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <span className={subLabelCls}>Question Text</span>
          <input
            value={question.name}
            onChange={(e) => onPatch({ name: e.target.value })}
            placeholder={`Question ${index + 1}`}
            className={`${inputCls} normal-case`}
          />
        </div>
        <div>
          <span className={subLabelCls}>Lecture</span>
          <select
            value={question.lectureIndex ?? 0}
            onChange={(e) => onPatch({ lectureIndex: Number(e.target.value) })}
            className={inputCls}
          >
            {lectures.map((l, li) => (
              <option key={l.id || `new-${li}`} value={li}>
                {l.name || `Lecture ${li + 1}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <span className={subLabelCls}>Options (select the correct one)</span>
      {/* All four on one line, each taking an equal share of the width and
          wrapping only when the row can no longer hold them. */}
      <div className="flex flex-wrap gap-2">
        {[0, 1, 2, 3].map((oi) => {
          const chosen = question.answer === oi + 1;
          return (
            <label
              key={oi}
              title={chosen ? "The correct answer" : "Mark as correct answer"}
              className={`flex min-w-[150px] flex-1 items-center gap-2 rounded border px-2 py-1.5 transition ${
                chosen
                  ? "border-[#20c997] bg-[#20c997]/10"
                  : "border-gray-300 bg-white"
              }`}
            >
              <input
                type="radio"
                name={`answer-${question.key}`}
                checked={chosen}
                onChange={() => onPatch({ answer: oi + 1 })}
                className="h-4 w-4 shrink-0 accent-[#20c997]"
              />
              <span className="w-3 shrink-0 font-bold text-[#1f5f86]">
                {OPTION_LETTERS[oi]}
              </span>
              <input
                value={question.options[oi]}
                onChange={(e) =>
                  onPatch({
                    options: question.options.map((o, j) =>
                      j === oi ? e.target.value : o
                    ),
                  })
                }
                placeholder={`Option ${OPTION_LETTERS[oi]}`}
                className="w-full min-w-0 border-0 bg-transparent p-0 text-[12px] normal-case text-gray-800 outline-none placeholder:text-gray-400"
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}

function SectionCard({
  index,
  section,
  error,
  busy,
  onPatch,
  onToggle,
  onDiscard,
  onPatchQuestion,
  onAddQuestion,
  onRemoveQuestion,
}) {
  const { open, isNew } = section;

  // Which lectures have their assignment block folded away. Kept here rather
  // than in the section state because it is pure display — collapsing a block
  // must never mark the section dirty and pull it into the next save. Keyed on
  // the lecture's own id so removing a lecture doesn't hand its folded state to
  // the one that takes its place; unsaved lectures fall back to position.
  const [foldedAssignments, setFoldedAssignments] = useState(() => new Set());
  const assignmentKey = (lecture, i) => (lecture.id ? `l${lecture.id}` : `i${i}`);
  const toggleAssignment = (key) =>
    setFoldedAssignments((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const patch = onPatch;
  const updateLecture = (i, changes) =>
    patch({
      lectures: section.lectures.map((l, j) => (j === i ? { ...l, ...changes } : l)),
    });

  /** The questions shown under the lecture at position `i`. */
  const questionsFor = (i) => questionsInSlot(section, i);

  /**
   * Takes one material off a lecture — the freshly picked file if there is one,
   * otherwise the one already on the server. The nonce bump remounts the input
   * so the browser stops showing a filename we no longer hold.
   */
  const clearMaterial = (i, kind) => {
    const lecture = section.lectures[i];
    const [pick, stored, nonce, cleared] =
      kind === "video"
        ? ["video", "existingVideo", "videoNonce", "clearedVideo"]
        : ["file", "existingFile", "fileNonce", "clearedFile"];
    const droppingPick = Boolean(lecture[pick]);

    updateLecture(i, {
      [droppingPick ? pick : stored]: null,
      [nonce]: (lecture[nonce] ?? 0) + 1,
      // Only taking the stored one off is work for the server; dropping a pick
      // that was never sent is not.
      ...(droppingPick ? null : { [cleared]: true }),
    });
  };

  /**
   * Removes lecture `i` and keeps the questions lined up with what is left.
   *
   * Its own questions go with it — the lecture they ask about is gone — and
   * every question below shuffles up a place, or they would silently re-attach
   * themselves to whichever lecture slid into the vacated position.
   */
  const removeLecture = (i) => {
    const doomed = section.questions.filter((q) => q.lectureIndex === i);
    patch({
      lectures: section.lectures.filter((_, j) => j !== i),
      questions: section.questions
        .filter((q) => q.lectureIndex !== i)
        .map((q) =>
          q.lectureIndex > i ? { ...q, lectureIndex: q.lectureIndex - 1 } : q
        ),
      // One that was never saved simply disappears; a saved one has to be
      // deleted on the server when this section is written.
      removedQuestionIds: [
        ...section.removedQuestionIds,
        ...doomed.filter((q) => !q.isNew).map((q) => q.id),
      ],
    });
  };

  return (
    <li className="overflow-hidden rounded border border-gray-200 bg-white">
      <div className="flex items-center justify-between gap-3 bg-[#f8f9fa] px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
        >
          <span className="bg-[#3482AE] text-white px-2 py-1 rounded text-xs font-semibold shrink-0">
            {index + 1}
          </span>
          <span className="min-w-0">
            <strong className="text-gray-800">
              {section.name || (isNew ? "NEW SECTION" : "UNTITLED SECTION")}
            </strong>
            <span className="ml-2 text-gray-500">
              {section.lectures.length} lecture(s)
            </span>
          </span>
          <ChevronDown
            className={`ml-auto h-3.5 w-3.5 shrink-0 text-[#3482AE] transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>

      {open ? (
        <div className="border-t border-gray-200 p-4 space-y-6">
          <div>
            <span className={labelCls}>SECTION NAME:</span>
            <div className="flex items-center gap-2">
              <input
                value={section.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="e.g. Introduction to Workplace Safety"
                className={inputCls}
              />
              {/* A saved section can no longer be deleted from here. A draft
                  that was never saved still needs a way out, or an empty one
                  would block the whole form on validation. */}
              {isNew ? (
                <button
                  type="button"
                  onClick={onDiscard}
                  disabled={busy}
                  className="shrink-0 rounded border border-[#dc3545]/40 px-3 py-2 text-[12px] font-semibold tracking-wide text-[#dc3545] uppercase transition hover:bg-[#dc3545]/10 disabled:opacity-60"
                >
                  Discard
                </button>
              ) : null}
            </div>
          </div>

          <div>
            {/* Add Lecture sits here, at the head of the list, rather than at
                its foot — a section with several lectures (each carrying its
                own assignment questions) ran long enough that the button was a
                scroll away. */}
            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-gray-200 pb-2">
              <span className="block text-[12px] font-bold text-[#3482AE] uppercase">
                Lectures
              </span>
              <span className="text-[12px] text-gray-500">
                {section.lectures.length} lecture(s)
              </span>
              {/* Only a section that has not been written yet can change its
                  lecture count: an update rewrites the rows the section already
                  holds, and the training service has no call that inserts or
                  drops one. Saying so here beats letting the officer type a
                  lecture in and lose it at save. */}
              {isNew ? (
                <button
                  type="button"
                  onClick={() =>
                    patch({ lectures: [...section.lectures, emptyLecture()] })
                  }
                  className={`ml-auto ${addMoreInlineCls}`}
                >
                  <Plus className="w-3.5 h-3.5" /> Add Lecture
                </button>
              ) : (
                <span
                  title="A saved section keeps the lectures it has. Add a new section for new lectures."
                  className="ml-auto text-[11px] normal-case text-gray-500"
                >
                  Add new lectures in a new section
                </span>
              )}
            </div>

            <div className="space-y-3">
              {section.lectures.map((lecture, i) => (
                <div key={i} className="rounded border border-gray-200 bg-[#f8f9fa] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="bg-[#3482AE] text-white px-2 py-1 rounded text-xs font-semibold">
                        {i + 1}
                      </span>
                      <span className="text-[12px] font-bold tracking-wide text-gray-600 uppercase">
                        Lecture {i + 1}
                      </span>
                    </span>
                    {isNew && section.lectures.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeLecture(i)}
                        className="rounded px-2 py-1 text-[12px] font-semibold tracking-wide text-[#dc3545] uppercase transition hover:bg-[#dc3545]/10"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>

                  <div className="space-y-3">
                    {/* Name and link share a row — both are single-line text,
                        and the two file pickers below line up under them. */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <span className={subLabelCls}>Lecture Name</span>
                        <input
                          value={lecture.name}
                          onChange={(e) => updateLecture(i, { name: e.target.value })}
                          placeholder={`Lecture ${i + 1} name`}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <span className={subLabelCls}>Link</span>
                        <input
                          value={lecture.link}
                          onChange={(e) => updateLecture(i, { link: e.target.value })}
                          placeholder="https://…"
                          className={inputCls}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <MaterialField
                        label="Video (MP4, MOV, AVI, MKV)"
                        accept={VIDEO_ACCEPT}
                        picked={lecture.video}
                        existing={lecture.existingVideo}
                        nonce={lecture.videoNonce ?? 0}
                        onPick={(f) => updateLecture(i, { video: f })}
                        onClear={() => clearMaterial(i, "video")}
                      />
                      <MaterialField
                        label={`File (${FILE_LABEL})`}
                        accept={FILE_ACCEPT}
                        picked={lecture.file}
                        existing={lecture.existingFile}
                        nonce={lecture.fileNonce ?? 0}
                        onPick={(f) => updateLecture(i, { file: f })}
                        onClear={() => clearMaterial(i, "file")}
                      />
                    </div>
                  </div>

                  {/* This lecture's assignment questions sit with it, so the
                      section reads lecture 1, its questions, lecture 2, and so
                      on rather than a pile of questions at the foot. Each block
                      folds away on its own — with four options per question a
                      single lecture's assignment is taller than everything
                      above it, and an officer editing the material shouldn't
                      have to scroll past questions they aren't changing. */}
                  {(() => {
                    const key = assignmentKey(lecture, i);
                    const assignmentOpen = !foldedAssignments.has(key);
                    // Questions are written against the lecture's position, so
                    // a lecture typed in a moment ago can carry them too — the
                    // ids are resolved when the section is saved.
                    const canAddQuestion = !section.questionsLoading;

                    return (
                      <div className="mt-4 overflow-hidden rounded border border-gray-200 bg-white">
                        {/* A tinted bar, like the section header above it, so
                            the fold reads as a control rather than a caption. */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-[#eaf3f9] px-3 py-2">
                          <button
                            type="button"
                            onClick={() => toggleAssignment(key)}
                            aria-expanded={assignmentOpen}
                            className="flex min-w-0 cursor-pointer items-center gap-2 text-[11px] font-bold tracking-wide text-[#1f5f86] uppercase"
                          >
                            <ChevronDown
                              className={`h-4 w-4 shrink-0 text-[#3482AE] transition-transform ${
                                assignmentOpen ? "" : "-rotate-90"
                              }`}
                            />
                            <span className="truncate">
                              Assignment — Lecture {i + 1}
                            </span>
                            <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-600 normal-case">
                              {questionsFor(i).length} question(s)
                            </span>
                          </button>
                          {canAddQuestion ? (
                            <button
                              type="button"
                              onClick={() => {
                                // A new question in a folded block would land
                                // out of sight — open it as we add.
                                setFoldedAssignments((prev) => {
                                  if (!prev.has(key)) return prev;
                                  const next = new Set(prev);
                                  next.delete(key);
                                  return next;
                                });
                                onAddQuestion(i);
                              }}
                              className={`ml-auto ${addMoreOnTintCls}`}
                            >
                              <Plus className="w-3.5 h-3.5" /> Add Question
                            </button>
                          ) : null}
                        </div>

                        {!assignmentOpen ? null : (
                          <div className="border-t border-gray-200 p-3">
                            {section.questionsLoading ? (
                              <p className="text-[12px] normal-case text-gray-500">
                                Loading questions…
                              </p>
                            ) : questionsFor(i).length === 0 ? (
                              <p className="text-[12px] normal-case text-gray-500">
                                No questions yet for this lecture.
                              </p>
                            ) : (
                              <div className="space-y-3">
                                {/* `qi` is the position within THIS lecture, so
                                    every lecture's questions number from 1. */}
                                {questionsFor(i).map((question, qi) => (
                                  <QuestionCard
                                    key={question.key}
                                    index={qi}
                                    question={question}
                                    lectures={section.lectures}
                                    onPatch={(changes) =>
                                      onPatchQuestion(question.key, changes)
                                    }
                                    onRemove={() => onRemoveQuestion(question.key)}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          </div>

          {error ? (
            <p className="text-[11px] font-semibold text-[#f23a4c]">{error}</p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/**
 * The officer's editor for a course's sections and lectures.
 *
 * There is no save button here. The page's single SAVE calls `save()` on the
 * ref, which writes only the sections the officer actually touched — an
 * untouched section is never re-sent, so its uploads can't be cleared by a save
 * meant for something else. A saved section cannot be deleted from here at all;
 * only a draft that was never saved can be discarded.
 */
export default function CourseContentEditor({ course, ref }) {
  // Who is editing — recorded against the change in the module history.
  const { user } = useAuth();
  const actionBy = getEmpCode(user);

  const [sections, setSections] = useState(() =>
    course.sections.map((s, i) => ({
      ...toEditableSection(s),
      key: `s${s.id || i}`,
      isNew: false,
      // How many lectures the server holds for this section. An update rewrites
      // exactly those rows, so the count is what the editor is allowed to send.
      savedLectureCount: (s.lectures ?? []).length,
      open: false,
      dirty: false,
      // Questions are fetched the first time a section is opened — a course
      // with a dozen sections should not pay for all of them up front.
      questions: [],
      questionsLoaded: false,
      questionsLoading: false,
      removedQuestionIds: [],
    }))
  );
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const draftSeq = useRef(0);
  const questionSeq = useRef(0);

  const patchOne = (key, changes) =>
    setSections((prev) =>
      prev.map((s) => (s.key === key ? { ...s, ...changes } : s))
    );

  /** Reads a section's questions once, the first time it is opened. */
  const loadQuestions = useCallback(
    async (key) => {
      const target = sections.find((s) => s.key === key);
      if (!target || target.isNew || target.questionsLoaded || target.questionsLoading) {
        return;
      }
      patchOne(key, { questionsLoading: true });
      try {
        const list = await getSectionQuestions(course.id, target.id);
        setSections((prev) =>
          prev.map((s) =>
            s.key === key
              ? {
                  ...s,
                  // Slots are worked out against the lectures as they stand
                  // now, so a question lands under the lecture it names.
                  questions: withLectureSlots(
                    list.map((q) => ({
                      ...q,
                      key: `q${q.id}`,
                      isNew: false,
                      dirty: false,
                    })),
                    s.lectures
                  ),
                  questionsLoaded: true,
                  questionsLoading: false,
                }
              : s
          )
        );
      } catch (err) {
        patchOne(key, { questionsLoading: false });
        alerts.toast.error(
          apiErrorMessage(err, "Could not load this section's questions.")
        );
      }
    },
    [sections, course.id]
  );

  const patchQuestion = (sectionKey, questionKey, changes) =>
    setSections((prev) =>
      prev.map((s) =>
        s.key === sectionKey
          ? {
              ...s,
              questions: s.questions.map((q) =>
                q.key === questionKey ? { ...q, ...changes, dirty: true } : q
              ),
            }
          : s
      )
    );

  const addQuestion = (sectionKey, lectureIndex) => {
    questionSeq.current += 1;
    const key = `q-new-${questionSeq.current}`;
    setSections((prev) =>
      prev.map((s) =>
        s.key === sectionKey
          ? { ...s, questions: [...s.questions, emptyQuestion(key, lectureIndex)] }
          : s
      )
    );
  };

  /** A saved question is queued for deletion; an unsaved one just disappears. */
  const removeQuestion = (sectionKey, questionKey) =>
    setSections((prev) =>
      prev.map((s) => {
        if (s.key !== sectionKey) return s;
        const target = s.questions.find((q) => q.key === questionKey);
        return {
          ...s,
          questions: s.questions.filter((q) => q.key !== questionKey),
          removedQuestionIds:
            target && !target.isNew
              ? [...s.removedQuestionIds, target.id]
              : s.removedQuestionIds,
        };
      })
    );

  const patchSection = (key, changes) =>
    setSections((prev) =>
      prev.map((s) => (s.key === key ? { ...s, ...changes, dirty: true } : s))
    );

  const toggleSection = (key) => {
    const target = sections.find((s) => s.key === key);
    if (target && !target.open) loadQuestions(key);
    setSections((prev) =>
      prev.map((s) => (s.key === key ? { ...s, open: !s.open } : s))
    );
  };

  const addSection = () => {
    draftSeq.current += 1;
    const key = `draft-${draftSeq.current}`;
    setSections((prev) => [
      ...prev,
      {
        key,
        id: 0,
        name: "",
        lectures: [emptyLecture()],
        isNew: true,
        savedLectureCount: 0,
        open: true,
        dirty: true,
        questions: [],
        questionsLoaded: true,
        questionsLoading: false,
        removedQuestionIds: [],
      },
    ]);
  };

  /** Drops a draft that was never saved — it only ever existed in the browser. */
  const discardDraft = (key) =>
    setSections((prev) => prev.filter((s) => s.key !== key));

  /** Writes every touched section. Returns true only when all of them went in. */
  const saveAll = async () => {
    const pending = sections.filter((s) => s.dirty);
    // A question can be edited without touching the section it belongs to, so
    // question work is collected separately from the dirty-section list.
    const questionWork = sections.filter(
      (s) => s.questions.some((q) => q.dirty) || s.removedQuestionIds.length > 0
    );
    if (pending.length === 0 && questionWork.length === 0) return true;

    const nextErrors = {};
    for (const section of pending) {
      const problem = validateSection(section);
      if (problem) nextErrors[section.key] = problem;
    }
    for (const section of questionWork) {
      if (nextErrors[section.key]) continue;
      const dirtyQuestions = section.questions.filter((q) => q.dirty);
      for (let i = 0; i < dirtyQuestions.length; i += 1) {
        const problem = validateQuestion(
          dirtyQuestions[i],
          questionLabel(section, dirtyQuestions[i])
        );
        if (problem) {
          nextErrors[section.key] = problem;
          break;
        }
      }
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      // Open the offending sections so the officer can see what is wrong.
      setSections((prev) =>
        prev.map((s) => (nextErrors[s.key] ? { ...s, open: true } : s))
      );
      alerts.warning(Object.values(nextErrors)[0], "Incomplete section");
      return false;
    }
    setErrors({});

    if (pending.length === 0) {
      // Only questions changed — no section has to be written at all.
      return saveQuestions(questionWork);
    }

    setBusy(true);
    let saved = {};
    try {
      for (const section of pending) {
        // A section that is already on the server is rewritten where it stands.
        // Sending it to the insert path instead is what used to leave the
        // course holding both the original and an edited copy of it.
        if (section.id) {
          await updateSection(course.id, section, actionBy);
          await clearRemovedMaterial(section);
        } else {
          await saveSection(course.id, section, actionBy);
        }
      }
      // A new section and its lectures are given their ids by the insert, so
      // they are only knowable by reading them back — and the questions below
      // need them. An updated section keeps the ids it already had.
      saved = await readBackIds(pending);
      setSections((prev) =>
        prev.map((s) => {
          if (!s.dirty) return s;
          const match = saved[s.key];
          return {
            ...s,
            dirty: false,
            isNew: false,
            // Writing the ids back matters beyond the questions: without them a
            // second save would send sectionId 0 again and create the section
            // twice over.
            id: match?.id ?? s.id,
            savedLectureCount: s.lectures.length,
            lectures: s.lectures.map((l, i) => ({
              ...l,
              id: match?.lectures?.[i]?.id ?? l.id,
              // The removals have been made; a second save must not repeat them.
              clearedVideo: false,
              clearedFile: false,
            })),
          };
        })
      );
    } catch (err) {
      const message = apiErrorMessage(err, "Could not save the course content.");
      await alerts.error(message, "Could not save");
      setBusy(false);
      return false;
    }
    setBusy(false);
    return questionWork.length > 0 ? saveQuestions(questionWork, saved) : true;
  };

  /**
   * Applies the X pressed on a saved lecture's upload.
   *
   * Updating a section can only put material on — every part it carries writes
   * a file — so taking one off is a call of its own, against the lecture's id.
   */
  const clearRemovedMaterial = async (section) => {
    for (const lecture of section.lectures) {
      if (!lecture.id) continue;
      // A re-attached upload has already replaced the old one; only a lecture
      // left with nothing needs clearing.
      if (lecture.clearedVideo && !lecture.video) {
        await clearLectureVideo(lecture.id);
      }
      if (lecture.clearedFile && !lecture.file) {
        await clearLectureFile(lecture.id);
      }
    }
  };

  /**
   * The server-side ids for the sections just written, keyed by editor key.
   *
   * An existing section is found by its own id. A brand-new one has none yet,
   * so it is matched on name among the sections not already claimed — the same
   * way the create form finds the sections it has just written.
   */
  const readBackIds = async (editorSections) => {
    const serverSections = await getSections(course.id);
    const claimed = new Set();
    const byKey = {};

    for (const section of editorSections) {
      const match =
        (section.id && serverSections.find((s) => s.id === section.id)) ||
        serverSections.find(
          (s) => !claimed.has(s.id) && s.name === section.name.trim()
        );
      if (match) {
        claimed.add(match.id);
        byKey[section.key] = match;
      }
    }
    return byKey;
  };

  /**
   * Writes the question adds, edits and removals queued against each section.
   *
   * `saved` carries the ids read back after the sections were written. A
   * section that was not touched is not in there and does not need to be — its
   * own lectures already hold the ids the questions point at.
   */
  const saveQuestions = async (sectionsWithWork, saved = {}) => {
    setBusy(true);
    try {
      for (const section of sectionsWithWork) {
        const target = saved[section.key];
        const sectionId = target?.id || section.id;
        const lectures = target?.lectures ?? section.lectures;

        for (const id of section.removedQuestionIds) {
          await deleteQuizQuestion(id);
        }
        for (const question of section.questions) {
          if (!question.dirty) continue;
          const payload = {
            // The position the card was shown at, turned into the id the
            // server gave that lecture — this is what lets a question be
            // written for a lecture that did not exist a moment ago.
            lectureId: lectures[question.lectureIndex]?.id ?? null,
            name: question.name.trim(),
            options: question.options.map((o) => o.trim()),
            answer: question.answer,
            regBy: actionBy,
          };
          if (question.isNew) {
            // Nothing to hang it on — the section save must have failed to
            // come back. Better to skip than to write an orphan.
            if (!sectionId) continue;
            await saveQuizQuestion({
              ...payload,
              emoduleId: course.id,
              sectionId,
            });
          } else {
            await updateQuizQuestion({ ...payload, id: question.id });
          }
        }
      }
      // The new questions now exist on the server; the page reloads the course
      // after a successful save, and reopening a section re-reads them.
      setSections((prev) =>
        prev.map((s) => ({
          ...s,
          removedQuestionIds: [],
          questionsLoaded: false,
          questions: s.questions.map((q) => ({ ...q, dirty: false })),
        }))
      );
      return true;
    } catch (err) {
      const message = apiErrorMessage(err, "Could not save the assignment questions.");
      await alerts.error(message, "Could not save");
      return false;
    } finally {
      setBusy(false);
    }
  };

  useImperativeHandle(ref, () => ({ save: saveAll }));

  return (
    <section className="bg-white rounded shadow border border-gray-200 text-[12px]">
      {/* Header. Add Section rides in it, on the right — the same move as Add
          Lecture and Add Question, so every "add" on this screen is at the head
          of the thing it adds to rather than a scroll below it. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 bg-[#3482AE] px-4 py-2">
        <h2 className="text-white font-bold uppercase tracking-wide">
          Edit Course Content
        </h2>
        <button type="button" onClick={addSection} className={addOnHeaderCls}>
          <Plus className="w-3.5 h-3.5" /> Add Section
        </button>
      </div>

      <div className="p-3 space-y-4">
        <ul className="space-y-2">
          {sections.map((section, i) => (
            <SectionCard
              key={section.key}
              index={i}
              section={section}
              error={errors[section.key] ?? null}
              busy={busy}
              onPatch={(changes) => patchSection(section.key, changes)}
              onToggle={() => toggleSection(section.key)}
              onDiscard={() => discardDraft(section.key)}
              onPatchQuestion={(questionKey, changes) =>
                patchQuestion(section.key, questionKey, changes)
              }
              onAddQuestion={(lectureIndex) =>
                addQuestion(section.key, lectureIndex)
              }
              onRemoveQuestion={(questionKey) =>
                removeQuestion(section.key, questionKey)
              }
            />
          ))}
        </ul>

        {sections.length === 0 ? (
          <p className="px-1 py-2 text-[12px] normal-case text-gray-500">
            This course has no sections yet — use ADD SECTION above to start one.
          </p>
        ) : null}
      </div>
    </section>
  );
}
