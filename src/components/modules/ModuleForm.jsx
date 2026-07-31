"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";

import MultiSelect from "@/components/ui/common/MultiSelect";
import SearchableSelect from "@/components/ui/common/SearchableSelect";
import { alerts } from "@/lib/alerts";
import { apiErrorMessage } from "@/config/api";
import {
  QUARTER_OPTIONS,
  instructorName,
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

const emptyQuestion = () => ({
  name: "",
  options: ["", "", "", ""],
  // No option is correct by default — the officer must pick one, otherwise the
  // answer key would silently default to Option A and grade everyone wrong.
  answer: 0,
  // Which lecture of this section the question is about. Held as a position
  // rather than an id: the lectures have no ids until the section is saved, and
  // they can still be added, removed or renamed before that happens.
  lectureIndex: 0,
});

// payroll-ui form styling: bold teal uppercase labels, gray-bordered 12px
// fields with a blue focus ring, a teal primary button and a red cancel.
const labelCls = "mb-1 block text-[12px] font-bold text-[#3482AE] uppercase";
const groupLabelCls = "block text-[12px] font-bold text-[#3482AE] uppercase";
const inputCls =
  "w-full rounded border border-gray-300 bg-white px-3 py-2 text-[12px] text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#3482AE] focus:ring-2 focus:ring-[#3482AE]/30";
const subLabelCls =
  "mb-1 block text-[11px] font-semibold tracking-wide text-gray-600 uppercase";
const fileInputCls =
  "w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-[12px] text-gray-500 file:mr-2 file:cursor-pointer file:rounded file:border-0 file:bg-[#3482AE] file:px-2.5 file:py-1 file:text-[12px] file:font-semibold file:text-white hover:file:bg-[#2a6a8f]";
const addMoreCls =
  "inline-flex cursor-pointer items-center gap-2 rounded border border-dashed border-[#3482AE]/60 bg-[#eaf3f9]/60 px-4 py-2 text-[12px] font-semibold tracking-wide text-[#3482AE] uppercase transition hover:bg-[#eaf3f9]";
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
function SectionHeader({ title, headerColor = "#3482AE" }) {
  return (
    <div className="px-4 py-2" style={{ backgroundColor: headerColor }}>
      <h2 className="text-white font-bold uppercase tracking-wide">{title}</h2>
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
  }
  for (let i = 0; i < section.questions.length; i += 1) {
    const q = section.questions[i];
    if (!q.name.trim()) return `Assignment question ${i + 1} needs text.`;
    if (q.options.some((o) => !o.trim()))
      return `Assignment question ${i + 1} needs all four options.`;
    // The correct answer is the grading key — it must be chosen deliberately.
    if (!q.answer)
      return `Assignment question ${i + 1}: mark the correct option (click the radio next to it).`;
    // A lecture removed after the question was written leaves it pointing at
    // nothing, which would save the question against the wrong lecture.
    if ((q.lectureIndex ?? 0) >= section.lectures.length)
      return `Assignment question ${i + 1}: pick the lecture it belongs to.`;
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

  const updateLecture = (i, patch) =>
    onChange({ lectures: lectures.map((l, j) => (j === i ? { ...l, ...patch } : l)) });

  const updateQuestion = (i, patch) =>
    onChange({ questions: questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });

  /** The questions written against one lecture, by its position in the list. */
  const questionsFor = (lectureIndex) =>
    questions.filter((q) => (q.lectureIndex ?? 0) === lectureIndex);

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
                    className="rounded px-2 py-1 text-[12px] font-semibold tracking-wide text-[#dc3545] uppercase transition hover:bg-[#dc3545]/10"
                  >
                    Remove
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
                        updateLecture(i, { video: e.target.files?.[0] ?? null })
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
                        updateLecture(i, { file: e.target.files?.[0] ?? null })
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
                  lecture 1, its assignment, lecture 2, its assignment. */}
              <div className="mt-4 border-t border-gray-200 pt-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-bold tracking-wide text-[#3482AE] uppercase">
                    Assignment — Lecture {i + 1}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    {questionsFor(i).length} question(s)
                  </span>
                </div>

                <div className="space-y-3">
                  {questionsFor(i).map((q) => renderQuestion(q, questions.indexOf(q)))}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      questions: [
                        ...questions,
                        { ...emptyQuestion(), lectureIndex: i },
                      ],
                    })
                  }
                  className={`mt-3 ${addMoreCls} border-[#20c997]/60 bg-[#20c997]/10 text-[#0f7a5c] hover:bg-[#20c997]/20`}
                >
                  <Plus className="h-3.5 w-3.5" /> Add Question
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onChange({ lectures: [...lectures, emptyLecture()] })}
          className={`mt-3 ${addMoreCls}`}
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
            {orphanQuestions.map((q) => renderQuestion(q, questions.indexOf(q)))}
          </div>
        </div>
      ) : null}
    </div>
  );

  function renderQuestion(q, qi) {
    return (
            <div key={qi} className="rounded border border-gray-200 bg-[#f8f9fa] p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[12px] font-bold tracking-wide text-gray-600 uppercase">
                  Question {qi + 1}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onChange({ questions: questions.filter((_, j) => j !== qi) })
                  }
                  className="rounded px-2 py-1 text-[12px] font-semibold tracking-wide text-[#dc3545] uppercase transition hover:bg-[#dc3545]/10"
                >
                  Remove
                </button>
              </div>

              <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <span className={subLabelCls}>Question Text</span>
                  <input
                    value={q.name}
                    onChange={(e) => updateQuestion(qi, { name: e.target.value })}
                    placeholder={`Question ${qi + 1}`}
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
            <span className="ml-2 text-gray-500">
              {section.lectures.length} lecture(s) · {section.questions.length}{" "}
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
      <div className="bg-white rounded shadow border border-gray-200 overflow-hidden text-[12px] flex h-[92vh] max-h-[92vh] w-full max-w-4xl flex-col">
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
  const [quarter, setQuarter] = useState(options.defaultQuarter);
  const [objectives, setObjectives] = useState([""]);
  const [deptIds, setDeptIds] = useState([]);
  const [gradeIds, setGradeIds] = useState([]);
  const [sections, setSections] = useState([]);

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
    if (deptIds.length === 0) return reject("Please select at least one department.");
    if (gradeIds.length === 0) return reject("Please select at least one grade.");
    if (sections.length === 0)
      return reject("Please add at least one section before submitting.");

    // The backend rejects submit unless the module has >= 1 assignment question.
    const totalQuestions = sections.reduce((n, s) => n + s.questions.length, 0);
    if (totalQuestions === 0)
      return reject(
        "Please add at least one assignment question (open a section → Assignment)."
      );

    setSubmitting(true);
    try {
      setProgress("Creating module…");
      const { kraQuarter, validTill } = quarterMeta(quarter);
      const emoduleId = await saveModule({
        name,
        categoryId,
        // The dropdown carries the employee code; only the name is stored.
        author: instructorName(author),
        description,
        kraQuarter,
        validTill,
        objectives: objectives.map((o) => o.trim()).filter(Boolean),
        deptIds,
        gradeIds,
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
          });
        }
      }

      setProgress("Submitting…");
      await submitModule({
        emoduleId,
        regards: officerName,
        deptIds,
        gradeIds,
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

          <Field label="DEPARTMENT:">
            <MultiSelect
              options={options.departments.map((d) => ({
                value: String(d.id),
                label: d.name,
              }))}
              selected={deptIds}
              onChange={setDeptIds}
              placeholder="Select department(s)"
              searchPlaceholder="Search department…"
            />
          </Field>

          <Field label="GRADE:">
            <MultiSelect
              options={options.grades.map((g) => ({
                value: String(g.id),
                label: g.label,
              }))}
              selected={gradeIds}
              onChange={setGradeIds}
              placeholder="Select grade(s)"
              searchPlaceholder="Search grade…"
            />
          </Field>

          <Field label="APPLICABLE QUARTER:">
            <SearchableSelect
              options={QUARTER_OPTIONS}
              value={quarter}
              onChange={setQuarter}
              placeholder="- Select Quarter -"
              searchPlaceholder="Search quarter…"
            />
          </Field>

          <div className="md:col-span-2">
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
      </section>

      {/* 2. COURSE MATERIAL DETAILS */}
      <section className="bg-white rounded shadow border border-gray-200 overflow-hidden text-[12px]">
        <SectionHeader title="Course Material" />
        <div className="p-3 space-y-4">
          <button type="button" onClick={() => setModalOpen(true)} className={addMoreCls}>
            <Plus className="h-3.5 w-3.5" /> Add Section
          </button>

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
              No sections added yet. Click <strong>Add Section</strong> to build
              the course content.
            </p>
          )}

          {error ? (
            <p className="text-[11px] font-semibold text-[#f23a4c]">{error}</p>
          ) : null}

          {/* payroll puts the Apply/Cancel pair centred at the foot of a form. */}
          <div className="flex items-center justify-center gap-4 border-t border-gray-200 pt-4">
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
