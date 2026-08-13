"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Plus, Trash2, X } from "lucide-react";

import ExamTypeToggle from "@/components/course/ExamTypeToggle";
import useAudienceOptions from "@/hooks/useAudienceOptions";
import MultiSelect from "@/components/ui/common/MultiSelect";
import SearchableSelect from "@/components/ui/common/SearchableSelect";
import YearPicker from "@/components/ui/common/YearPicker";
import { alerts } from "@/lib/alerts";
import { apiErrorMessage } from "@/config/api";
import {
  DEFAULT_EXAM_TYPE,
  EXAM_TYPES,
  EXAM_TYPE_LIST,
  examTypeLabel,
  examTypeOf,
} from "@/lib/examType";
import { isSafeFileName, sanitizeUpload } from "@/lib/uploadName";
import {
  QUARTER_OPTIONS,
  currentFinancialYear,
  instructorName,
  isQuarterClosed,
  plantLabel,
  quarterMeta,
} from "@/services/MasterDataService";
import {
  getSections,
  saveModule,
  saveQuizQuestion,
  saveSection,
  submitModule,
} from "@/services/ModuleService";

/**
 * The two nonces exist only to remount the file inputs. A file input holds its
 * own DOM value, and clearing our state does not clear that — without the
 * remount the browser goes on showing the old filename and, worse, re-picking
 * the same file fires no change event at all.
 */
const emptyLecture = () => ({
  name: "",
  video: null,
  file: null,
  link: "",
  videoNonce: 0,
  fileNonce: 0,
});

/**
 * What each lecture upload accepts. The `accept` attribute only filters the
 * file dialog — a user can still pick anything via drag-and-drop or by
 * switching the dialog's filter — so `validateSection` re-checks the extension
 * before the section is added.
 */
const VIDEO_EXTENSIONS = [".mp4", ".webm", ".ogg", ".mov", ".avi", ".mkv", ".wmv", ".m4v"];
const FILE_EXTENSIONS = [".pdf", ".xls", ".xlsx", ".csv", ".jpg", ".jpeg", ".png"];

const VIDEO_ACCEPT = `video/*,${VIDEO_EXTENSIONS.join(",")}`;
const FILE_ACCEPT = FILE_EXTENSIONS.join(",");

/** True when `file` carries one of `extensions`. */
const hasAllowedExtension = (file, extensions) => {
  const name = (file?.name ?? "").toLowerCase();
  return extensions.some((ext) => name.endsWith(ext));
};

/** "PDF, Excel, JPG, PNG" — the human list shown in the field's heading. */
const FILE_LABEL = "PDF, Excel, CSV, JPG, PNG";

const emptyQuestion = (examType = DEFAULT_EXAM_TYPE) => ({
  name: "",
  options: ["", "", "", ""],
  // No option is correct by default — the officer must pick one, otherwise the
  // answer key would silently default to Option A and grade everyone wrong.
  answer: 0,
  // Which lecture of this section the question is about. Held as a position
  // rather than an id: the lectures have no ids until the section is saved, and
  // they can still be added, removed or renamed before that happens.
  lectureIndex: 0,
  // Which paper it belongs to — the pre-test or the post-test. Stored as the
  // row's `quaType`; see lib/examType.
  examType,
});

// payroll-ui form styling: bold teal uppercase labels, gray-bordered 12px
// fields with a blue focus ring, a teal primary button and a red cancel.
// nowrap: these labels head narrow columns, and "APPLICABLE QUARTER:" breaking
// over two lines pushed its field a line lower than the one beside it. They are
// all short enough to hold a single line at any width the form is used at.
const labelCls =
  "mb-1 block text-[12px] font-bold whitespace-nowrap text-[#3482AE] uppercase";
const groupLabelCls = "block text-[12px] font-bold text-[#3482AE] uppercase";
const inputCls =
  "w-full rounded border border-gray-300 bg-white px-3 py-2 text-[12px] text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#3482AE] focus:ring-2 focus:ring-[#3482AE]/30";
const subLabelCls =
  "mb-1 block text-[11px] font-semibold tracking-wide text-gray-600 uppercase";
const fileInputCls =
  "w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-[12px] text-gray-500 file:mr-2 file:cursor-pointer file:rounded file:border-0 file:bg-[#3482AE] file:px-2.5 file:py-1 file:text-[12px] file:font-semibold file:text-white hover:file:bg-[#2a6a8f]";
/**
 * The three "add" actions, as real buttons rather than dashed outlines. A
 * dashed box reads as an empty slot waiting to be filled — which is what the
 * empty-state panel under the section list already is, so the button beside it
 * was saying the same thing twice and neither looked clickable.
 *
 * They are deliberately not identical. Add Section builds the course, Add
 * Lecture builds a section and Add Question builds a lecture, so each step down
 * that order drops a level of weight — and Add Section is white because it
 * rides in the solid brand header of the card it adds to, where a brand-filled
 * button would disappear.
 */
const addBtnBase =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-md font-bold tracking-wide uppercase transition-colors active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2";
const addSectionCls = `${addBtnBase} shrink-0 bg-white px-3.5 py-1.5 text-[11.5px] text-[#2a6a8f] shadow-sm hover:bg-white/90 focus-visible:outline-white`;
const addLectureCls = `${addBtnBase} border border-[#3482AE] bg-white px-3.5 py-1.5 text-[11.5px] text-[#3482AE] hover:bg-[#eaf3f9] focus-visible:outline-[#3482AE]`;
const addQuestionCls = `${addBtnBase} bg-[#20c997] px-3 py-1.5 text-[11px] text-white shadow-sm hover:bg-[#1aa179] focus-visible:outline-[#20c997]`;

/**
 * Remove, on a lecture or a question.
 *
 * Outlined rather than solid: it sits in the same heading row as the block's
 * own number, and a filled red button there pulls the eye before the thing it
 * would delete. It fills on hover, so the weight arrives at the point the
 * pointer is actually over it — and the label stays a word, not a bare ×, since
 * this removes a written lecture rather than clearing a field.
 */
const removeBtnCls =
  "inline-flex cursor-pointer items-center gap-1 rounded-md border border-[#dc3545]/40 bg-white px-2.5 py-1 text-[11px] font-bold tracking-wide text-[#dc3545] uppercase transition-colors active:translate-y-px hover:bg-[#dc3545] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#dc3545]";
// payroll's form action pair: a teal Apply and a red Cancel.
const SUBMIT_BTN =
  "px-6 py-2 bg-[#3482AE] text-white text-sm font-semibold rounded shadow hover:bg-[#2a6a8f] transition-colors cursor-pointer disabled:opacity-60";
const CANCEL_BTN =
  "px-6 py-2 bg-[#f23a4c] text-white text-sm font-semibold rounded shadow hover:bg-[#d92e3f] transition-colors cursor-pointer disabled:opacity-60";

/**
 * The picked file's name with an X to take it off again.
 *
 * Without this the only way out of a wrong pick was to choose another file —
 * there was no way at all to go back to none, so a lecture that was meant to
 * carry just a link kept whatever had been attached by mistake.
 */
function PickedFile({ file, label, onClear }) {
  if (!file) return null;

  return (
    <>
      <p className="mt-1 flex items-center gap-1.5 text-[11px] normal-case text-gray-500">
        <span className="min-w-0 truncate">{file.name}</span>
        <button
          type="button"
          onClick={onClear}
          title="Remove this selection"
          aria-label={`Remove ${label}`}
          className="shrink-0 cursor-pointer rounded-full p-0.5 text-gray-400 transition hover:bg-[#dc3545]/10 hover:text-[#dc3545]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </p>
      {/* Said out loud rather than done quietly: the name above is not the one
          that was picked, and the officer has to be able to see why. */}
      {file.renamedFrom ? (
        <p className="mt-0.5 text-[11px] normal-case text-[#a17200]">
          Special characters removed from “{file.renamedFrom}”.
        </p>
      ) : null}
    </>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <span className={labelCls}>{label}</span>
      {children}
    </div>
  );
}

/**
 * payroll's card header bar (`bg-[COLOR] px-4 py-2` + white bold uppercase h2).
 */
function SectionHeader({ title, headerColor = "#3482AE", action = null }) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-2"
      style={{ backgroundColor: headerColor }}
    >
      <h2 className="text-white font-bold uppercase tracking-wide">{title}</h2>
      {action}
    </div>
  );
}

/**
 * Validates one section. Returns the first problem as a message, or null when
 * the section is good. Shared so the Add Section dialog and the inline editor
 * enforce exactly the same rules.
 */
function validateSection(section) {
  if (!section.name.trim()) return "Please enter a section name.";
  for (let i = 0; i < section.lectures.length; i += 1) {
    const l = section.lectures[i];
    if (!l.name.trim()) return `Lecture ${i + 1} needs a name.`;
    if (!l.video && !l.file && !l.link.trim())
      return `Lecture ${i + 1} needs a video, a file, or a link.`;
    if (l.video && !hasAllowedExtension(l.video, VIDEO_EXTENSIONS))
      return `Lecture ${i + 1}: the video must be a video file (${VIDEO_EXTENSIONS.join(", ")}).`;
    if (l.file && !hasAllowedExtension(l.file, FILE_EXTENSIONS))
      return `Lecture ${i + 1}: the file must be one of ${FILE_LABEL}.`;
    // Names are cleaned as the file is picked, so this only catches one that
    // reached the section some other way. It matters because the backend both
    // stores and looks the material up by its name — a special character in
    // one is a file that uploads and then cannot be opened again.
    for (const [kind, upload] of [["video", l.video], ["file", l.file]]) {
      if (upload && !isSafeFileName(upload.name)) {
        return `Lecture ${i + 1}: the ${kind} name "${upload.name}" has special characters in it. Re-attach it, or rename the file to letters, digits, dots, dashes and underscores only.`;
      }
    }
  }
  // Each paper is numbered on its own, the same way the cards on screen are —
  // "post assignment question 2" has to point at the second card of the post
  // tab, not the second question of the section.
  for (const type of EXAM_TYPE_LIST) {
    const paper = section.questions.filter((q) => examTypeOf(q) === type.value);
    for (let i = 0; i < paper.length; i += 1) {
      const q = paper[i];
      const label = `${examTypeLabel(type.value)} question ${i + 1}`;
      if (!q.name.trim()) return `${label} needs text.`;
      if (q.options.some((o) => !o.trim()))
        return `${label} needs all four options.`;
      // The correct answer is the grading key — it must be chosen deliberately.
      if (!q.answer)
        return `${label}: mark the correct option (click the radio next to it).`;
      // A lecture removed after the question was written leaves it pointing at
      // nothing, which would save the question against the wrong lecture.
      if ((q.lectureIndex ?? 0) >= section.lectures.length)
        return `${label}: pick the lecture it belongs to.`;
    }
  }
  return null;
}

/** Trims a section's free-text fields before it is stored or submitted. */
function trimSection(section) {
  return {
    name: section.name.trim(),
    lectures: section.lectures.map((l) => ({
      ...l,
      name: l.name.trim(),
      link: l.link.trim(),
    })),
    questions: section.questions.map((q) => ({
      ...q,
      name: q.name.trim(),
      options: q.options.map((o) => o.trim()),
    })),
  };
}

/**
 * The section editor — name, lectures and assignment questions.
 *
 * Rendered both inside the Add Section dialog and inline when an existing
 * section is expanded, so a section is edited through exactly the same fields
 * it was created with.
 */
function SectionFields({ section, onChange, idPrefix }) {
  const { lectures, questions } = section;

  /**
   * Which paper each lecture's block is showing, by lecture position.
   *
   * Local to the editor and never written into the section: switching tabs is
   * looking, not editing, and it must not change what gets saved. Anything not
   * in here is on the pre paper, which is where a block opens.
   */
  const [openPaper, setOpenPaper] = useState({});
  const paperFor = (lectureIndex) =>
    openPaper[lectureIndex] ?? DEFAULT_EXAM_TYPE;

  const updateLecture = (i, patch) =>
    onChange({ lectures: lectures.map((l, j) => (j === i ? { ...l, ...patch } : l)) });

  const updateQuestion = (i, patch) =>
    onChange({ questions: questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });

  /**
   * The questions written against one lecture, by its position in the list —
   * narrowed to one paper when a type is given.
   */
  const questionsFor = (lectureIndex, examType = null) =>
    questions.filter(
      (q) =>
        (q.lectureIndex ?? 0) === lectureIndex &&
        (examType === null || examTypeOf(q) === examType)
    );

  /** How many questions each paper of one lecture holds, for the toggle. */
  const paperCounts = (lectureIndex) =>
    Object.fromEntries(
      EXAM_TYPE_LIST.map((t) => [
        t.value,
        questionsFor(lectureIndex, t.value).length,
      ])
    );

  /** Questions left pointing past the end of the list by a deleted lecture. */
  const orphanQuestions = questions.filter(
    (q) => (q.lectureIndex ?? 0) >= lectures.length
  );

  return (
    <div className="space-y-6">
      <div>
        <span className={labelCls}>SECTION NAME:</span>
        <input
          value={section.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g. Introduction to Workplace Safety"
          className={inputCls}
        />
      </div>

      {/* Lectures */}
      <div>
        <div className="mb-3 flex items-center justify-between border-b border-gray-200 pb-2">
          <span className={groupLabelCls}>LECTURES</span>
          <span className="text-[12px] text-gray-500">
            {lectures.length} lecture(s)
          </span>
        </div>

        <div className="space-y-3">
          {lectures.map((lecture, i) => (
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
                {lectures.length > 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      onChange({ lectures: lectures.filter((_, j) => j !== i) })
                    }
                    className={removeBtnCls}
                    aria-label={`Remove lecture ${i + 1}`}
                  >
                    <Trash2 className="h-3 w-3" /> Remove
                  </button>
                ) : null}
              </div>

              <div className="space-y-3">
                <div>
                  <span className={subLabelCls}>Lecture Name</span>
                  <input
                    value={lecture.name}
                    onChange={(e) => updateLecture(i, { name: e.target.value })}
                    placeholder={`Lecture ${i + 1} name`}
                    className={inputCls}
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <span className={subLabelCls}>Video (MP4, MOV, AVI, MKV)</span>
                    <input
                      // Remounts on clear; see emptyLecture.
                      key={lecture.videoNonce ?? 0}
                      type="file"
                      accept={VIDEO_ACCEPT}
                      onChange={(e) =>
                        updateLecture(i, {
                          video: sanitizeUpload(e.target.files?.[0] ?? null),
                        })
                      }
                      className={fileInputCls}
                    />
                    <PickedFile
                      file={lecture.video}
                      label="video"
                      onClear={() =>
                        updateLecture(i, {
                          video: null,
                          videoNonce: (lecture.videoNonce ?? 0) + 1,
                        })
                      }
                    />
                  </div>
                  <div>
                    <span className={subLabelCls}>File ({FILE_LABEL})</span>
                    <input
                      key={lecture.fileNonce ?? 0}
                      type="file"
                      accept={FILE_ACCEPT}
                      onChange={(e) =>
                        updateLecture(i, {
                          file: sanitizeUpload(e.target.files?.[0] ?? null),
                        })
                      }
                      className={fileInputCls}
                    />
                    <PickedFile
                      file={lecture.file}
                      label="file"
                      onClear={() =>
                        updateLecture(i, {
                          file: null,
                          fileNonce: (lecture.fileNonce ?? 0) + 1,
                        })
                      }
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
              </div>

              {/* This lecture's questions sit with it, so the section reads
                  lecture 1, its assignment, lecture 2, its assignment. The two
                  papers — pre and post — share this block and are switched
                  between rather than stacked: they hold the same kind of card,
                  and showing both at once doubled an already long lecture. */}
              {(() => {
                const paper = paperFor(i);
                const shown = questionsFor(i, paper);

                return (
                  <div className="mt-4 border-t border-gray-200 pt-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                      <span className="text-[11px] font-bold tracking-wide text-[#3482AE] uppercase">
                        Assignment — Lecture {i + 1}
                      </span>
                      <ExamTypeToggle
                        value={paper}
                        counts={paperCounts(i)}
                        onChange={(type) =>
                          setOpenPaper((prev) => ({ ...prev, [i]: type }))
                        }
                      />
                    </div>

                    <div className="space-y-3">
                      {shown.length === 0 ? (
                        <p className="text-[11px] normal-case text-gray-500">
                          No {examTypeLabel(paper).toLowerCase()} questions for
                          this lecture yet.
                        </p>
                      ) : (
                        // `qi` numbers within THIS paper; the second argument is
                        // the question's index in the section, which is what an
                        // edit or a removal has to act on.
                        shown.map((q, qi) =>
                          renderQuestion(q, questions.indexOf(q), qi)
                        )
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          questions: [
                            ...questions,
                            // Onto the paper that is open, so the button always
                            // adds to what the officer is looking at.
                            { ...emptyQuestion(paper), lectureIndex: i },
                          ],
                        })
                      }
                      className={`mt-3 ${addQuestionCls}`}
                    >
                      <Plus className="h-3.5 w-3.5" /> Add{" "}
                      {examTypeLabel(paper)} Question
                    </button>
                  </div>
                );
              })()}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onChange({ lectures: [...lectures, emptyLecture()] })}
          className={`mt-3 ${addLectureCls}`}
        >
          <Plus className="h-3.5 w-3.5" /> Add Lecture
        </button>
      </div>

      {/* Questions whose lecture was deleted after they were written — shown so
          they can be pointed at a lecture rather than silently blocking submit. */}
      {orphanQuestions.length > 0 ? (
        <div>
          <div className="mb-2 border-b border-gray-200 pb-2">
            <span className={groupLabelCls}>QUESTIONS NEEDING A LECTURE</span>
          </div>
          <div className="space-y-3">
            {orphanQuestions.map((q, oi) =>
              renderQuestion(q, questions.indexOf(q), oi)
            )}
          </div>
        </div>
      ) : null}
    </div>
  );

  /**
   * @param {number} qi the question's index in the whole section — what an edit
   *   or a removal acts on
   * @param {number} [shownIndex] its position within the paper it is shown
   *   under, which is how the card is numbered
   */
  function renderQuestion(q, qi, shownIndex = qi) {
    const paper = examTypeOf(q);
    return (
            <div key={qi} className="rounded border border-gray-200 bg-[#f8f9fa] p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="text-[12px] font-bold tracking-wide text-gray-600 uppercase">
                    Question {shownIndex + 1}
                  </span>
                  {/* Which paper this card belongs to. Redundant under the
                      toggle, which already says it — but the orphan list below
                      mixes both, and a question there has no other clue. */}
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ${
                      paper === EXAM_TYPES.POST
                        ? "bg-[#ffc107]/20 text-[#8a6100]"
                        : "bg-[#3482AE]/10 text-[#2a6a8f]"
                    }`}
                  >
                    {examTypeLabel(paper)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onChange({ questions: questions.filter((_, j) => j !== qi) })
                  }
                  className={removeBtnCls}
                  aria-label={`Remove ${examTypeLabel(paper).toLowerCase()} question ${shownIndex + 1}`}
                >
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              </div>

              <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <span className={subLabelCls}>Question Text</span>
                  <input
                    value={q.name}
                    onChange={(e) => updateQuestion(qi, { name: e.target.value })}
                    placeholder={`Question ${shownIndex + 1}`}
                    className={inputCls}
                  />
                </div>
                <div>
                  <span className={subLabelCls}>Lecture</span>
                  <select
                    value={q.lectureIndex ?? 0}
                    onChange={(e) =>
                      updateQuestion(qi, { lectureIndex: Number(e.target.value) })
                    }
                    className={inputCls}
                  >
                    {lectures.map((l, li) => (
                      <option key={li} value={li}>
                        {l.name.trim() || `Lecture ${li + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <span className={subLabelCls}>Options (select the correct one)</span>
              {/* All four on one line, each taking an equal share of the width
                  and wrapping only when the row can no longer hold them. */}
              <div className="flex flex-wrap gap-2">
                {[0, 1, 2, 3].map((oi) => {
                  const chosen = q.answer === oi + 1;
                  return (
                    <label
                      key={oi}
                      className={`flex min-w-[150px] flex-1 items-center gap-2 rounded border px-2 py-1.5 transition ${
                        chosen
                          ? "border-[#20c997] bg-[#20c997]/10"
                          : "border-gray-300 bg-white"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`${idPrefix}-answer-${qi}`}
                        checked={chosen}
                        // onChange selects; onClick lets a click on the
                        // already-selected option clear it back to "none".
                        onChange={() => updateQuestion(qi, { answer: oi + 1 })}
                        onClick={() => {
                          if (chosen) updateQuestion(qi, { answer: 0 });
                        }}
                        title={chosen ? "Click again to unmark" : "Mark as correct answer"}
                        className="h-4 w-4 shrink-0 accent-[#20c997]"
                      />
                      <input
                        value={q.options[oi]}
                        onChange={(e) =>
                          updateQuestion(qi, {
                            options: q.options.map((o, k) =>
                              k === oi ? e.target.value : o
                            ),
                          })
                        }
                        placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                        className="w-full min-w-0 border-0 bg-transparent p-0 text-[12px] text-gray-800 outline-none placeholder:text-gray-400"
                      />
                    </label>
                  );
                })}
              </div>
              <p
                className={`mt-2 text-[12px] normal-case ${
                  q.answer ? "text-[#20c997]" : "text-[#f23a4c]"
                }`}
              >
                {q.answer
                  ? `Correct answer: Option ${String.fromCharCode(64 + q.answer)}`
                  : "Required: click the radio next to the correct option — this is the grading key."}
              </p>
            </div>
    );
  }
}

/**
 * One row in the Course Material list: a summary bar that expands into the full
 * section editor, so lectures and questions can be corrected without deleting
 * and re-adding the section.
 */
function SectionRow({ index, section, onChange }) {
  const [open, setOpen] = useState(false);

  return (
    <li className="overflow-hidden rounded border border-gray-200 bg-white">
      <div className="bg-[#f8f9fa] px-4 py-3">
        {/* The whole summary is the toggle — a bigger target than a lone caret. */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full min-w-0 cursor-pointer items-center gap-3 text-left"
        >
          <span className="min-w-0">
            <strong className="text-gray-800">{section.name}</strong>
            {/* Both papers are counted, so a section whose post-test is still
                empty says so from the collapsed row. */}
            <span className="ml-2 text-gray-500">
              {section.lectures.length} lecture(s) ·{" "}
              {EXAM_TYPE_LIST.map(
                (t) =>
                  `${section.questions.filter((q) => examTypeOf(q) === t.value).length} ${t.short.toLowerCase()}`
              ).join(" · ")}{" "}
              question(s)
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
        <div className="border-t border-gray-200 p-4">
          <SectionFields
            section={section}
            onChange={onChange}
            idPrefix={`section-${index}`}
          />
        </div>
      ) : null}
    </li>
  );
}

function SectionModal({ onClose, onAdd }) {
  const [draft, setDraft] = useState({
    name: "",
    lectures: [emptyLecture()],
    questions: [],
  });
  const [error, setError] = useState(null);

  const handleAdd = () => {
    setError(null);
    const problem = validateSection(draft);
    if (problem) {
      setError(problem);
      alerts.warning(problem, "Incomplete section");
      return;
    }
    onAdd(trimSection(draft));
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Height is capped against the padded backdrop rather than set to a
          share of the viewport. `h-[92vh]` plus the backdrop's own p-4 came to
          more than the screen, and a centred panel spills that excess equally
          top and bottom — so ADD SECTION and CLOSE sat below the bottom edge
          with no way to scroll to them. `max-h-full` also lets a one-lecture
          section open as a short panel instead of a near-full-screen one. */}
      <div className="bg-white rounded shadow border border-gray-200 overflow-hidden text-[12px] flex max-h-full w-full max-w-4xl flex-col">
        {/* Header */}
        <div className="bg-[#3482AE] px-4 py-2 flex items-center justify-between shrink-0">
          <h2 className="text-white font-bold uppercase tracking-wide">Add Section</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-6 w-6 items-center justify-center rounded-full text-white transition hover:bg-white/20"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 text-gray-700">
          <SectionFields
            section={draft}
            onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
            idPrefix="new-section"
          />
          {error ? (
            <p className="mt-3 text-[11px] font-semibold text-[#f23a4c]">{error}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 justify-center gap-4 border-t border-gray-200 bg-[#f8f9fa] p-3">
          {/* Named for what they do, not SUBMIT / CANCEL: that pair belongs to
              the module form behind this dialog, and repeating it here left two
              SUBMIT buttons on one screen meaning different things. */}
          <button type="button" onClick={handleAdd} className={SUBMIT_BTN}>
            ADD SECTION
          </button>
          <button type="button" onClick={onClose} className={CANCEL_BTN}>
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * @param {object} props
 * @param {Function} [props.onSuccess] called after a successful submit; defaults
 *   to routing back to the officer dashboard (used by the standalone page).
 * @param {Function} [props.onCancel] called by the Cancel button; defaults to
 *   `router.back()`.
 */
export default function ModuleForm({
  options,
  empCode,
  officerName,
  onSuccess,
  onCancel,
}) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [financialYear, setFinancialYear] = useState(
    options.defaultFinancialYear
  );
  const [quarter, setQuarter] = useState(options.defaultQuarter);

  // The financial year cannot run backwards from here: a course raised for a
  // year that has ended has no window left to be completed in.
  const earliestYear = useMemo(() => currentFinancialYear(), []);

  /**
   * Only the quarters still open in the chosen year.
   *
   * A quarter that has closed cannot be trained in — its validTill is already
   * past, so the course would be created expired and every employee it went to
   * would find it overdue on the day it arrived. Which quarters those are
   * depends on the year: pick next year and all four are open again.
   */
  const quarterChoices = useMemo(
    () =>
      QUARTER_OPTIONS.filter(
        (option) =>
          !isQuarterClosed(quarterMeta(option.value, financialYear).validTill)
      ),
    [financialYear]
  );

  // Changing the year can retire the quarter that was chosen — Q1 is open for
  // next year and closed for this one. Resolved while rendering rather than
  // corrected afterwards in an effect: a state write for something already
  // known costs a second render, and for one of those renders the form would
  // be holding a quarter it is not offering.
  const selectedQuarter = quarterChoices.some((o) => o.value === quarter)
    ? quarter
    : (quarterChoices[0]?.value ?? "");
  const [objectives, setObjectives] = useState([""]);
  const [plantIds, setPlantIds] = useState([]);
  const [deptIds, setDeptIds] = useState([]);
  const [gradeIds, setGradeIds] = useState([]);
  const [empCodes, setEmpCodes] = useState([]);
  const [sections, setSections] = useState([]);

  /**
   * The departments to offer for the chosen plants, and the people the three
   * filters above SELECT USER currently resolve to. Shared with the officer's
   * edit form, which narrows the same four filters the same way.
   */
  const { departments, audienceOptions, audienceLoading } = useAudienceOptions({
    allDepartments: options.departments,
    plantIds,
    deptIds,
    gradeIds,
    setDeptIds,
    setEmpCodes,
  });

  /**
   * The audience chain, one field at a time: PLANT → DEPARTMENT → GRADE →
   * SELECT USER. Each stays shut until the one above it is answered, so the
   * officer narrows in the order the filters actually narrow — site, then
   * function, then seniority, then named people — rather than picking grades
   * out of the whole company and departments out of all 64 before saying which
   * site they mean.
   *
   * The first gate is guarded on the plant list actually having plants in it,
   * not on the selection alone: `/plant/list` is newer than the other masters
   * and comes back empty against a backend that predates it. Gating on an empty
   * field there would leave an officer unable to pick a plant, therefore unable
   * to pick a department, and unable to raise a course at all — so where there
   * are no plants to choose, the chain simply starts at DEPARTMENT.
   */
  const deptLocked = options.plants.length > 0 && plantIds.length === 0;
  const gradeLocked = deptLocked || deptIds.length === 0;
  const userLocked = gradeLocked || gradeIds.length === 0;

  /**
   * Clearing a field clears everything chosen below it.
   *
   * Those fields are about to grey out, and a disabled field still holding
   * three departments is a selection the officer can no longer see the basis
   * for or take back — and it would still be saved. So emptying one link of the
   * chain empties the rest of it.
   *
   * This is only the case the officer causes directly. `useAudienceOptions`
   * separately prunes picks that a *narrowed* filter no longer offers, which is
   * a different question and already has its own answer.
   */
  const changePlants = (next) => {
    setPlantIds(next);
    if (next.length === 0) {
      setDeptIds([]);
      setGradeIds([]);
      setEmpCodes([]);
    }
  };

  const changeDepts = (next) => {
    setDeptIds(next);
    if (next.length === 0) {
      setGradeIds([]);
      setEmpCodes([]);
    }
  };

  const changeGrades = (next) => {
    setGradeIds(next);
    if (next.length === 0) setEmpCodes([]);
  };

  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null);

  const handleSubmit = async () => {
    setError(null);

    // payroll surfaces a validation miss as a warning popup, not just inline
    // text, so the officer sees it without scrolling back up the long form.
    const reject = (message) => {
      setError(message);
      alerts.warning(message, "Incomplete form");
    };

    if (!name.trim()) return reject("Please enter the course name.");
    if (!author.trim()) return reject("Please select the course instructor.");
    if (!description.trim()) return reject("Please enter the course description.");
    // Down the chain in order, so the officer is always sent to the field that
    // is actually open: with no plant chosen DEPARTMENT is greyed out, and
    // being told to select a department would point at a field they cannot use.
    if (deptLocked) return reject("Please select at least one plant.");
    if (deptIds.length === 0) return reject("Please select at least one department.");
    if (gradeIds.length === 0) return reject("Please select at least one grade.");
    if (sections.length === 0)
      return reject("Please add at least one section before submitting.");

    // The backend rejects submit unless the module has >= 1 assignment
    // question. Whether it counts both papers or only the pre-test is not
    // knowable from here, and a post-only module has nothing a learner can sit
    // anyway — the course screen reads the pre paper — so one PRE question is
    // required rather than one of either kind.
    const preQuestions = sections.reduce(
      (n, s) =>
        n + s.questions.filter((q) => examTypeOf(q) === EXAM_TYPES.PRE).length,
      0
    );
    if (preQuestions === 0)
      return reject(
        "Please add at least one pre assignment question (open a section → Assignment → Pre Assignment)."
      );

    setSubmitting(true);
    try {
      setProgress("Creating module…");
      const { kraQuarter, validTill } = quarterMeta(
        selectedQuarter,
        financialYear
      );
      const emoduleId = await saveModule({
        name,
        categoryId,
        // The dropdown carries the employee code; only the name is stored.
        author: instructorName(author),
        description,
        kraQuarter,
        validTill,
        objectives: objectives.map((o) => o.trim()).filter(Boolean),
        plantIds,
        deptIds,
        gradeIds,
        empCodes,
        regBy: empCode,
      });

      for (let i = 0; i < sections.length; i += 1) {
        setProgress(`Saving section ${i + 1} of ${sections.length}…`);
        // Sequential on purpose: the backend assigns section order by insert.
        await saveSection(emoduleId, sections[i], empCode);
      }

      // Attach assignment questions: look up the saved sections' ids, then save
      // each section's questions against the matching section.
      setProgress("Saving assignment questions…");
      const saved = await getSections(emoduleId);
      const usedIds = new Set();
      for (const section of sections) {
        if (section.questions.length === 0) continue;
        const match = saved.find(
          (s) => s.name === section.name.trim() && !usedIds.has(s.id)
        );
        if (!match) continue;
        usedIds.add(match.id);
        for (const q of section.questions) {
          // The lectures only got their ids when the section was written, and
          // they come back in the order they were sent, so the position the
          // officer picked maps straight onto the saved row.
          const lecture = match.lectures?.[q.lectureIndex ?? 0];
          await saveQuizQuestion({
            emoduleId,
            sectionId: match.id,
            lectureId: lecture?.id,
            name: q.name,
            options: q.options,
            answer: q.answer,
            regBy: empCode,
            examType: examTypeOf(q),
          });
        }
      }

      setProgress("Submitting…");
      await submitModule({
        emoduleId,
        regards: officerName,
        plantIds,
        deptIds,
        gradeIds,
        empCodes,
      });

      await alerts.success("Training module submitted successfully.");
      if (onSuccess) onSuccess(emoduleId);
      else router.push("/TrainingOfficerDashboard");
    } catch (err) {
      const message = apiErrorMessage(err, "Could not save the module.");
      setError(message);
      await alerts.error(message, "Could not save");
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. COURSE DETAILS — no overflow-hidden: the Grade/Department dropdowns
          are absolutely positioned and must extend past the card edge. */}
      <section className="bg-white rounded shadow border border-gray-200 text-[12px]">
        <SectionHeader title="Course Details" />
        <div className="p-3 grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
          <Field label="COURSE NAME:">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter course name"
              className={inputCls}
            />
          </Field>

          <Field label="COURSE CATEGORY:">
            <SearchableSelect
              options={options.categories.map((c) => ({
                value: String(c.id),
                label: c.name,
              }))}
              value={categoryId}
              onChange={setCategoryId}
              placeholder="- Select Category -"
              searchPlaceholder="Search category…"
              // Both this and the instructor below can be taken back off: a
              // wrong pick had no way out except picking another one.
              clearable
            />
          </Field>

          <Field label="COURSE INSTRUCTOR:">
            <SearchableSelect
              options={options.instructors.map((i) => ({
                value: i.label,
                label: i.label,
              }))}
              value={author}
              onChange={setAuthor}
              placeholder="- Select Instructor -"
              searchPlaceholder="Search instructor…"
              clearable
            />
          </Field>

          <Field label="COURSE DESCRIPTION:">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={1}
              placeholder="Enter ..."
              className={inputCls}
            />
          </Field>

          {/* Plant, Department and Grade are the three filters that decide who
              the course reaches, so they sit together on one row in the order
              they narrow by: site, then function, then seniority.

              The order is now enforced rather than merely suggested: DEPARTMENT
              stays shut until a plant is picked. It is the same rule SELECT USER
              already applies one step down the chain, and it stops the officer
              choosing from all 64 departments — most of which are not staffed at
              the site they have in mind — before saying which site that is. */}
          <Field label="PLANT:">
            <MultiSelect
              // The code leads the label: it is what the plants are known by
              // on paper, and it is the only short way to tell "Unit-4
              // Toolroom" from "Unit-4 R&D" and "Unit-4, PressShop" at a
              // glance. It is searchable too, so "1042" finds the right one.
              options={options.plants.map((p) => ({
                value: String(p.id),
                label: plantLabel(p),
              }))}
              selected={plantIds}
              onChange={changePlants}
              placeholder="Select plant(s)"
              searchPlaceholder="Search plant name or code…"
              allLabel="All plants"
            />
          </Field>

          <Field label="DEPARTMENT:">
            <MultiSelect
              // Plant-wise: once a plant is chosen this lists only the
              // departments actually staffed there, so the officer is not
              // picking from 64 when 25 of them exist at that site.
              options={departments.map((d) => ({
                value: String(d.id),
                label: d.name,
              }))}
              selected={deptIds}
              onChange={changeDepts}
              disabled={deptLocked}
              // A greyed field has to say what would open it, or it reads as
              // broken — the same job the empty SELECT USER does below.
              placeholder={
                deptLocked
                  ? "Select plant first"
                  : plantIds.length > 0
                    ? "Select department(s) at these plants"
                    : "Select department(s)"
              }
              searchPlaceholder="Search department…"
              allLabel={
                plantIds.length > 0
                  ? "All departments at these plants"
                  : "All departments"
              }
            />
          </Field>

          <Field label="GRADE:">
            <MultiSelect
              options={options.grades.map((g) => ({
                value: String(g.id),
                label: g.label,
              }))}
              selected={gradeIds}
              onChange={changeGrades}
              disabled={gradeLocked}
              placeholder={
                gradeLocked ? "Select department first" : "Select grade(s)"
              }
              searchPlaceholder="Search grade…"
              // Ticking this reaches the same people as the master's own "All
              // Grade" row: every serving employee is on a grade between M7 and
              // S1, so selecting all of them leaves nobody out. Both ways of
              // saying it are therefore offered rather than one being removed —
              // "All Grade" is what courses raised before this were stored with.
              allLabel="All grades"
            />
          </Field>

          {/* Select User comes last because it is the final narrowing of the
              three above it: plant picks the sites, department the functions,
              grade the seniorities, and this picks named people out of whoever
              is left. Leaving it empty keeps all of them.

              One column, like every other field on this row. It was two wide
              to give the employee labels room — they carry the code as well as
              the name — but that made it the odd one out on a form whose whole
              grid is otherwise even, and the badges inside it truncate rather
              than overflow anyway. */}
          <Field label="SELECT USER:">
            <MultiSelect
              // The code alone. Names carry the code as well, and a badge of
              // "MANIKUTTAN NAIR (100098)" truncated inside a one-column field
              // showed neither the whole name nor the code — which is the one
              // part of it that identifies the person. The name is still what
              // typing searches, and it is on the row's hover title.
              options={audienceOptions.map((e) => ({
                value: e.code,
                label: e.code,
                search: e.label,
              }))}
              selected={empCodes}
              onChange={setEmpCodes}
              disabled={userLocked}
              // The empty field is the one that has to explain itself: it
              // reads as broken otherwise, and the reason differs — which link
              // of the chain is missing, or that the three above it resolve to
              // nobody. Kept short enough to fit the narrower field without
              // clipping.
              placeholder={
                deptLocked
                  ? "Select plant first"
                  : deptIds.length === 0
                    ? "Select department first"
                    : gradeIds.length === 0
                      ? "Select grade first"
                      : audienceLoading
                        ? "Loading employees…"
                        : audienceOptions.length === 0
                          ? "No matching employees"
                          : `All ${audienceOptions.length} employee${
                              audienceOptions.length === 1 ? "" : "s"
                            }`
              }
              searchPlaceholder="Search employee name or code…"
              allLabel={
                audienceOptions.length > 0
                  ? `All ${audienceOptions.length} employees`
                  : ""
              }
            />
          </Field>

          {/* Financial year rides up into the main grid rather than heading the
              last row. Making USER one column wide left the third cell of its
              row empty, and a hole in an otherwise even grid reads as a field
              that failed to render. It also puts the year beside the audience
              filters, which is where the officer is already looking. */}
          <Field label="FINANCIAL YEAR:">
            <YearPicker
              label=""
              value={financialYear}
              onChange={setFinancialYear}
              allowAll={false}
              minYear={earliestYear}
              triggerClassName={inputCls}
            />
          </Field>

          {/* Quarter and objective take the last row. The outer grid is three
              equal columns and cannot express "narrow, wide", so this row runs
              its own twelve-column grid: the dropdown holds one short value and
              the objective is free text that grows a line per entry, and so
              takes the rest.

              items-start, not the grid's stretch: a cell that stretches makes
              its field as tall as the tallest column, so adding a second
              objective grew the quarter box to match it. Each field keeps its
              own height and both labels stay on one line.

              The quarter still follows the year immediately in reading order,
              which matters — the quarters on offer depend on the year chosen. */}
          <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-12 items-start gap-x-6 gap-y-4">
            <div className="md:col-span-3">
              <Field label="APPLICABLE QUARTER:">
                <SearchableSelect
                  options={quarterChoices}
                  value={selectedQuarter}
                  onChange={setQuarter}
                  placeholder="- Select Quarter -"
                  searchPlaceholder="Search quarter…"
                />
              </Field>
            </div>

            <div className="md:col-span-9">
              <span className={labelCls}>LEARNING OBJECTIVE:</span>
              <div className="space-y-2">
                {objectives.map((obj, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={obj}
                      onChange={(e) =>
                        setObjectives((prev) =>
                          prev.map((o, j) => (j === i ? e.target.value : o))
                        )
                      }
                      placeholder="Learning Objective"
                      className={inputCls}
                    />
                    {i === objectives.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => setObjectives((prev) => [...prev, ""])}
                        className="shrink-0 rounded bg-[#3482AE] px-3 text-white hover:bg-[#2b6b90]"
                        aria-label="Add objective"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setObjectives((prev) => prev.filter((_, j) => j !== i))
                        }
                        className="shrink-0 rounded bg-[#f23a4c] px-3 text-white hover:bg-[#d92e3f]"
                        aria-label="Remove objective"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. COURSE MATERIAL DETAILS */}
      <section className="bg-white rounded shadow border border-gray-200 overflow-hidden text-[12px]">
        {/* Add Section rides in the heading rather than sitting above the list
            it adds to: on a course with several sections the button was a
            scroll away from the bottom of them, and the heading is the one part
            of the card that is always in view. */}
        <SectionHeader
          title="Course Material"
          action={
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className={addSectionCls}
            >
              <Plus className="h-3.5 w-3.5" /> Add Section
            </button>
          }
        />
        <div className="p-3 space-y-4">
          {sections.length > 0 ? (
            <ul className="space-y-2">
              {sections.map((section, i) => (
                <SectionRow
                  key={i}
                  index={i}
                  section={section}
                  onChange={(patch) =>
                    setSections((prev) =>
                      prev.map((s, j) => (j === i ? { ...s, ...patch } : s))
                    )
                  }
                />
              ))}
            </ul>
          ) : (
            <p className="rounded-md border border-dashed border-gray-300 bg-[#f4f6f9] px-4 py-6 text-center text-[12px] text-gray-500">
              No sections added yet. Use <strong>Add Section</strong> above to
              Open the course content.
            </p>
          )}

          {error ? (
            <p className="text-[11px] font-semibold text-[#f23a4c]">{error}</p>
          ) : null}

          {/* payroll puts the Apply/Cancel pair centred at the foot of a form.
              It appears with the first section: a module cannot be submitted
              without one, so before that the pair is a button that can only
              refuse. The dashboard's own tabs are the way off this screen while
              it is hidden. */}
          {sections.length > 0 ? (
            <div className="flex animate-fadeInUp items-center justify-center gap-4 border-t border-gray-200 pt-4">
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmit}
                className={SUBMIT_BTN}
              >
                {submitting ? (progress ?? "SUBMITTING...") : "SUBMIT"}
              </button>
              <button
                type="button"
                onClick={() => (onCancel ? onCancel() : router.back())}
                className={CANCEL_BTN}
              >
                CANCEL
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {modalOpen ? (
        <SectionModal
          onClose={() => setModalOpen(false)}
          onAdd={(section) => {
            setSections((prev) => [...prev, section]);
            setModalOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
