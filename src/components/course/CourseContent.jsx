"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  CircleCheckBig,
  CirclePlay,
  FileText,
  Lock,
} from "lucide-react";

import MaterialViewer from "@/components/course/MaterialViewer";
import { useAuth } from "@/context/AuthContext";
import { getEmpCode } from "@/lib/permissions";
import {
  getAssignmentQuestions,
  isAssignmentSubmitted,
} from "@/services/AssignmentService";
import { isEmbeddableVideo } from "@/lib/video";
import { materialUrl } from "@/services/ModuleService";
import { fileName } from "@/utils/etmsFormat";

/**
 * Which lecture a question belongs to.
 *
 * Questions written before assignments were lecture-wise carry no lecture, so
 * they are spread across the lectures in order — the first under lecture 1, the
 * second under lecture 2 — matching how the officer's editor shows them. Any
 * left over go under the last lecture rather than disappearing.
 */
function questionsByLecture(lectures, questions) {
  const byLecture = new Map(lectures.map((l) => [l.id, []]));
  const unassigned = questions.filter((q) => !q.lectureId);

  questions.forEach((question) => {
    let lectureId = question.lectureId;
    if (!lectureId) {
      const position = unassigned.indexOf(question);
      const lecture = lectures[position] ?? lectures[lectures.length - 1];
      lectureId = lecture?.id;
    }
    if (byLecture.has(lectureId)) byLecture.get(lectureId).push(question);
  });

  return byLecture;
}

/**
 * Where a learner's "watched" ticks are kept.
 *
 * The backend has no endpoint for "this lecture was viewed" that we can safely
 * call: the one that exists, `/emodule_log/save`, completes the whole course
 * the moment a video is opened, which is exactly why the legacy UI had it
 * commented out. So progress is remembered per browser instead — it survives a
 * refresh and revisits, but does not follow the learner to another device.
 */
const watchedStorageKey = (empCode, emoduleId) =>
  `etms:watched:${empCode || "anon"}:${emoduleId}`;

function readWatched(empCode, emoduleId) {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(watchedStorageKey(empCode, emoduleId));
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

/**
 * A stable id for one lecture. Keyed on the backend's section/lecture ids (not
 * array position) so a reordered or newly inserted lecture doesn't inherit
 * another one's tick; positions are only a fallback for rows the backend left
 * without an id.
 */
const lectureKey = (section, lecture, i, j) =>
  `${section.id || `s${i}`}:${lecture.id || `l${j}`}`;

/**
 * Everything a lecture asks the learner to open, video first.
 *
 * A lecture can carry all three — an external video link, an uploaded video and
 * a PDF — and each is ticked off separately. They used to share one tick per
 * lecture, so opening the PDF also marked the video watched and unlocked the
 * assignment without the video ever being played.
 */
function materialsOf(lecture) {
  const list = [];
  if (lecture.link) list.push({ id: "link", kind: "link", href: lecture.link });
  if (lecture.materialVideo)
    list.push({
      id: "video",
      kind: "video",
      href: materialUrl(lecture.materialVideo),
    });
  if (lecture.materialFile)
    list.push({
      id: "file",
      kind: "file",
      href: materialUrl(lecture.materialFile),
      name: fileName(lecture.materialFile),
      // How it opens in the page, if it can at all; see MaterialViewer.
      viewer: viewerFor(lecture.materialFile),
    });
  return list;
}

/**
 * How this material can be shown inside the app: "pdf" in a frame, "sheet" as a
 * table, "image" as a picture, or null for one the browser has to take.
 *
 * The PDF test is deliberately case-sensitive, matching `/trainingMaterial/file`
 * and its own `equals(".pdf")`. A file uploaded as `REPORT.PDF` is served as an
 * attachment however much of a PDF it is, and framing one would download it
 * behind an empty panel. The other two have no such tie — they are fetched and
 * decoded here, so the header the endpoint puts on them does not matter.
 */
const viewerFor = (path) => {
  const name = String(path ?? "").trim();
  if (name.endsWith(".pdf")) return "pdf";
  if (/\.(xlsx|xlsm|xlsb|xls|csv)$/i.test(name)) return "sheet";
  if (/\.(jpe?g|png|gif|webp|bmp)$/i.test(name)) return "image";
  return null;
};

/** What one material's "Open" button says. */
const materialAction = (material) =>
  material.kind === "file" ? "Open file" : "Watch video";

/**
 * Can this material play in the preview card beside the course header?
 *
 * An uploaded video always can — it is a file the browser plays. A pasted link
 * only can when it is YouTube or points straight at a video file; anything else
 * (a Drive or Vimeo page, say) is a web page and still opens in its own tab. A
 * PDF never does.
 */
const playsInCard = (material) =>
  material.kind === "video" ||
  (material.kind === "link" && isEmbeddableVideo(material.href));

/**
 * One material in the lecture dropdown. Reads identically either way — a button
 * when it opens inside the app (a video in the preview card, a PDF in the
 * viewer), a plain link when the browser has to take it.
 */
function MaterialLink({ inPage, href, onOpen, onTabOpen, className, children }) {
  return inPage ? (
    <button type="button" onClick={onOpen} className={`cursor-pointer ${className}`}>
      {children}
    </button>
  ) : (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={onTabOpen}
      className={className}
    >
      {children}
    </a>
  );
}

/** The stored tick for ONE material of one lecture. */
const materialKey = (lecture, materialId) => `${lecture}::${materialId}`;

/**
 * One material's value in the lecture dropdown — a filename or a URL.
 *
 * All three rows list the same kind of thing, so they read the same way: a step
 * down from the label beside them, wrapping instead of pushing the panel wide,
 * and in the case the name was actually stored in.
 *
 * `normal-case` has to sit on the link itself. The global uppercase rule is
 * written against `*`, so it matches this element directly — opting out on the
 * paragraph around it never reaches here, which is what was serving filenames
 * and URLs back in capitals.
 */
const materialTextCls =
  "break-all text-left text-[11px] normal-case text-[#3482AE] underline underline-offset-2 hover:text-[#2b6b90]";

/** The "✓ opened" note after it, in the same case as the name it follows. */
const materialTickCls =
  "ml-2 text-[12px] font-semibold normal-case text-[#20c997]";

/**
 * "Course content": collapsible sections, each listing its lectures with a
 * play/file icon, an expandable detail dropdown, and a Preview link that opens
 * the lecture's material. A section's assignment stays locked until every
 * lecture's material has been opened — so the learner must go through the
 * content before starting the assignment.
 */
/**
 * @param {boolean} preview a training officer looking at the content rather
 *   than working through it. Nothing they open is ticked off, because these
 *   ticks are a learner's progress record — the same reason the assignment
 *   itself renders read-only for them.
 * @param {(video: {url: string, lecture: string, uploaded: boolean}) => void}
 *   [onPlay] hands a picked lecture to the preview card beside the course
 *   header, which plays it. Without it every video opens in a new tab.
 */
export default function CourseContent({
  emoduleId,
  sections = [],
  preview = false,
  onPlay,
}) {
  const { user } = useAuth();
  const empCode = getEmpCode(user);

  // Sections start with the first one open.
  const [openSections, setOpenSections] = useState(
    () => new Set(sections.length ? [0] : [])
  );
  // Per-lecture detail dropdowns.
  const [openLectures, setOpenLectures] = useState(new Set());
  // The PDF being read over the page, as {name, url}; null when none is open.
  const [viewing, setViewing] = useState(null);
  // Which lectures the learner has opened — keyed per lecture, NOT by material
  // URL, so two chapters sharing a video link stay independent. Restored from
  // storage so a refresh doesn't re-lock the assignment.
  const [watched, setWatched] = useState(() =>
    preview ? new Set() : readWatched(empCode, emoduleId)
  );

  // The session is restored asynchronously by AuthProvider, so empCode can
  // arrive after the first render — re-read once it does.
  useEffect(() => {
    if (preview) return;
    setWatched(readWatched(empCode, emoduleId));
  }, [empCode, emoduleId, preview]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // An officer's browsing must not be written to storage either, or it would
    // be read back as progress the moment the flag was off.
    if (preview) return;
    try {
      window.localStorage.setItem(
        watchedStorageKey(empCode, emoduleId),
        JSON.stringify([...watched])
      );
    } catch {
      // A full or blocked storage quota must not break the page.
    }
  }, [watched, empCode, emoduleId, preview]);

  // sectionId → questions, read the first time a section with an assignment is
  // opened. Only the lecture each question belongs to is used here.
  const [questionsBySection, setQuestionsBySection] = useState({});
  // sectionId → true once this learner has submitted that section's assignment.
  // Submission is per section, so every lecture in one reads the same.
  const [submittedBySection, setSubmittedBySection] = useState({});

  const loadQuestions = useCallback(
    async (section) => {
      if (!section.id || section.assignmentStatus !== 1) return;
      let alreadyAsked = false;
      setQuestionsBySection((prev) => {
        alreadyAsked = section.id in prev;
        return alreadyAsked ? prev : { ...prev, [section.id]: [] };
      });
      if (alreadyAsked) return;
      try {
        const list = await getAssignmentQuestions(emoduleId, section.id);
        setQuestionsBySection((prev) => ({ ...prev, [section.id]: list }));
      } catch {
        // The lecture rows simply fall back to the section-level assignment link.
      }
    },
    [emoduleId]
  );

  /**
   * Which sections this learner has already submitted.
   *
   * Read for every section up front rather than as each one is expanded: it
   * decides the counts in the toolbar, and those have to be right on arrival.
   * An officer has no attempt of their own to report on, so it is not asked.
   */
  useEffect(() => {
    if (preview || !empCode) return;
    let cancelled = false;

    Promise.all(
      sections
        .filter((s) => s.id && s.assignmentStatus === 1)
        .map((s) =>
          isAssignmentSubmitted(emoduleId, s.id, empCode)
            .then((done) => [s.id, done])
            // A failed lookup just leaves that section unknown; the assignment
            // page's own check catches it.
            .catch(() => null)
        )
    ).then((results) => {
      if (cancelled) return;
      const next = Object.fromEntries(results.filter(Boolean));
      if (Object.keys(next).length > 0) {
        setSubmittedBySection((prev) => ({ ...prev, ...next }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [sections, emoduleId, empCode, preview]);

  // The first section is open before anything is clicked, so its questions have
  // to be fetched here — waiting for a toggle left it with no assignment rows.
  useEffect(() => {
    sections.forEach((section, i) => {
      if (openSections.has(i)) loadQuestions(section);
    });
    // Only for what is open on arrival; a later toggle loads its own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, loadQuestions]);

  const totalLectures = useMemo(
    () => sections.reduce((n, s) => n + s.lectures.length, 0),
    [sections]
  );

  /**
   * Has this learner finished the section the lecture sits in?
   *
   * A submitted assignment settles it. The assignment cannot be reached until
   * every material in the lecture has been opened, so having sat it is proof
   * the content was worked through — and it is the only half of that record the
   * server keeps. The ticks below are per browser, so without this a learner who
   * sat the assignment on another machine, or cleared their storage, came back
   * to a course reading 0/2 done beside their own SUBMITTED badge.
   */
  const isSubmitted = (section) => submittedBySection[section.id] === true;

  /**
   * Has this one material been opened?
   *
   * A bare lecture key is what the old per-lecture tick wrote. It is honoured
   * as "everything in this lecture is done" so a learner part-way through a
   * course is not sent back to the start by this change; nothing writes that
   * shape any more.
   */
  const materialWatched = (lecture, materialId, submitted = false) =>
    submitted ||
    watched.has(materialKey(lecture, materialId)) ||
    watched.has(lecture);

  /** A lecture is done once every one of its materials has been opened. */
  const lectureDone = (lecture, materials, submitted = false) =>
    submitted || materials.every((m) => materialWatched(lecture, m.id));

  /** True when a click on this material should send it to the preview card. */
  const inCard = (material) => Boolean(onPlay) && playsInCard(material);

  /**
   * Opens a document over the page.
   *
   * Opening it is not reading it, so nothing is ticked here. The viewer decides:
   * a PDF once every page has been on screen long enough to have been looked at,
   * a sheet or a picture once it has been in front of the learner for a while.
   * An officer is checking the material rather than working through it, so they
   * are given no way to record having read it.
   */
  const openInPage = (key, material) => {
    setViewing({
      name: material.name,
      url: material.href,
      kind: material.viewer,
      onRead: preview
        ? null
        : () => markWatched(materialKey(key, material.id)),
    });
  };

  /**
   * Hands a video to the preview card.
   *
   * Opening a video is not watching it. Every video the card can play — an
   * uploaded file, a link that IS a video file, a YouTube lecture through its
   * player API — leaves the tick to the player, which writes it only once
   * enough unique seconds have actually gone by. Clicking play and walking away
   * counts for nothing, which is what it should always have counted for.
   *
   * A link the card cannot play at all (a Drive or Vimeo page) opens in a tab
   * and is ticked here, because there is nothing on the other side of it that
   * could ever report back.
   */
  const playInCard = (key, material, lectureName) => {
    const tracked =
      material.kind === "video" || isEmbeddableVideo(material.href);
    if (!tracked) markWatched(materialKey(key, material.id));

    onPlay({
      url: material.href,
      lecture: lectureName,
      uploaded: material.kind === "video",
      onWatched: tracked
        ? () => markWatched(materialKey(key, material.id))
        : null,
    });
  };

  /** How many of a section's lectures are done. */
  const watchedIn = (section, i) =>
    isSubmitted(section)
      ? section.lectures.length
      : section.lectures.filter((l, j) =>
          lectureDone(lectureKey(section, l, i, j), materialsOf(l))
        ).length;

  const watchedCount = useMemo(
    () => sections.reduce((n, s, i) => n + watchedIn(s, i), 0),
    // watched is a Set replaced on every change, so this recomputes when it does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sections, watched, submittedBySection]
  );

  const allOpen = openSections.size === sections.length;

  const markWatched = (key) =>
    setWatched((prev) => {
      // Opening something as an officer is not a learner completing it.
      if (preview || prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });

  const toggleIn = (setter) => (key) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const toggleSection = toggleIn(setOpenSections);
  const toggleLecture = toggleIn(setOpenLectures);

  const toggleAll = () =>
    setOpenSections(allOpen ? new Set() : new Set(sections.map((_, i) => i)));

  if (sections.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-xs normal-case text-gray-500">
        No content has been added to this course yet.
      </p>
    );
  }

  return (
    <>
    <div className="bg-white rounded shadow border border-gray-200 overflow-hidden text-[12px]">
      {/* Toolbar: overall progress on the left, expand/collapse on the right. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-[#fbfcfd] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <p className="text-[12px] normal-case text-gray-500">
            {sections.length} section{sections.length === 1 ? "" : "s"} ·{" "}
            {totalLectures} lecture{totalLectures === 1 ? "" : "s"}
          </p>
          {/* Progress belongs to a learner working through the course; for an
              officer the bar would only ever read 0, so it says what the screen
              is instead. */}
          {preview ? (
            <span className="rounded bg-[#ffc107]/15 px-2 py-0.5 text-[11px] font-bold tracking-wide text-[#a17200] uppercase">
              Preview — progress is not recorded
            </span>
          ) : totalLectures > 0 ? (
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-200">
                <span
                  className="block h-full rounded-full bg-[#20c997] transition-all"
                  style={{
                    width: `${Math.round((watchedCount / totalLectures) * 100)}%`,
                  }}
                />
              </span>
              <span className="text-[12px] font-semibold normal-case text-gray-600">
                {watchedCount}/{totalLectures} done
              </span>
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={toggleAll}
          className="shrink-0 cursor-pointer rounded border border-[#3482AE]/40 px-3 py-1.5 text-[12px] font-semibold tracking-wide text-[#3482AE] uppercase transition hover:bg-[#3482AE]/10"
        >
          {allOpen ? "Collapse all" : "Expand all"}
        </button>
      </div>

      {sections.map((section, i) => {
        const open = openSections.has(i);
        const sectionSubmitted = isSubmitted(section);
        // Every material of every lecture must be opened before this section's
        // assignment unlocks — not just one material per lecture. The gate is
        // there to walk a learner through the content; an officer checking the
        // paper is not doing that, so nothing is locked for them.
        const assignmentLocked =
          !preview &&
          !sectionSubmitted &&
          section.lectures.some((l, j) => {
            const materials = materialsOf(l);
            return (
              materials.length > 0 &&
              !lectureDone(lectureKey(section, l, i, j), materials)
            );
          });

        const sectionQuestions = questionsBySection[section.id] ?? [];
        const perLecture = questionsByLecture(section.lectures, sectionQuestions);
        // With questions spread across the lectures there is nothing left for a
        // section-wide row; it stays only for a section whose questions could
        // not be placed (no lectures at all).
        const placedQuestions = [...perLecture.values()].reduce(
          (n, list) => n + list.length,
          0
        );
        const sectionWatched = watchedIn(section, i);

        return (
          <div key={section.id || i} className="border-b border-gray-200 last:border-b-0">
            <button
              type="button"
              onClick={() => {
                if (!open) loadQuestions(section);
                toggleSection(i);
              }}
              aria-expanded={open}
              className="flex w-full cursor-pointer items-center gap-3 bg-[#f7f9fb] px-4 py-3.5 text-left transition-colors hover:bg-[#eef3f7]"
            >
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-[#3482AE] transition-transform ${
                  open ? "rotate-180" : ""
                }`}
              />
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[#3482AE] text-[11px] font-bold text-white">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 text-[13.5px] font-bold normal-case text-gray-800">
                {section.name || `Section ${i + 1}`}
              </span>
              <span className="hidden shrink-0 text-[12px] normal-case text-gray-500 sm:inline">
                {section.lectures.length} lecture
                {section.lectures.length === 1 ? "" : "s"}
                {sectionQuestions.length
                  ? ` · ${sectionQuestions.length} question${
                      sectionQuestions.length === 1 ? "" : "s"
                    }`
                  : ""}
              </span>
              {/* How far through this section the learner is — nothing to
                  report when no progress is being kept. */}
              {preview ? null : (
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    sectionWatched === section.lectures.length
                      ? "bg-[#20c997]/15 text-[#158765]"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {sectionWatched}/{section.lectures.length}
                </span>
              )}
            </button>

            {open ? (
              <div>
                {section.lectures.map((lecture, j) => {
                  const key = lectureKey(section, lecture, i, j);
                  const expanded = openLectures.has(key);
                  const materials = materialsOf(lecture);
                  // The row's button offers whatever is still outstanding, so a
                  // lecture with a video and a PDF asks for the video, then the
                  // PDF, rather than counting either one as the whole lecture.
                  const nextMaterial = materials.find(
                    (m) => !materialWatched(key, m.id, sectionSubmitted)
                  );
                  const done = materials.length > 0 && !nextMaterial;
                  const openedCount = materials.filter((m) =>
                    materialWatched(key, m.id, sectionSubmitted)
                  ).length;
                  const isVideo = Boolean(lecture.link || lecture.materialVideo);
                  // Every material the dropdown can list — an uploaded video
                  // now among them, so a lecture carrying only one still gets
                  // an arrow to open.
                  const hasDetail = Boolean(
                    lecture.materialFile || lecture.materialVideo || lecture.link
                  );
                  const lectureQuestions = perLecture.get(lecture.id) ?? [];
                  // A lecture with nothing to open has nothing to finish, so
                  // its assignment is available immediately.
                  const lectureLocked = !preview && materials.length > 0 && !done;
                  // The dropdown also has to open for a lecture whose only
                  // extra is its assignment, or it could never be reached.
                  const hasDropdown = hasDetail || lectureQuestions.length > 0;

                  return (
                    <div
                      key={lecture.id || j}
                      className="border-t border-gray-200 first:border-t-0"
                    >
                      <div className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[#fbfcfd]">
                        {/* The icon doubles as the done tick, so the row does
                            not need a separate status column on the left. */}
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                            done
                              ? "bg-[#20c997]/15 text-[#158765]"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {done ? (
                            <CircleCheckBig className="h-3.5 w-3.5" />
                          ) : isVideo ? (
                            <CirclePlay className="h-3.5 w-3.5" />
                          ) : (
                            <FileText className="h-3.5 w-3.5" />
                          )}
                        </span>

                        <button
                          type="button"
                          onClick={() => hasDropdown && toggleLecture(key)}
                          className={`flex min-w-0 flex-1 items-center gap-1.5 text-left ${
                            hasDropdown ? "cursor-pointer" : "cursor-default"
                          }`}
                        >
                          <span className="truncate text-[13px] font-semibold normal-case text-gray-700">
                            {lecture.name || `Lecture ${j + 1}`}
                          </span>
                          {lectureQuestions.length > 0 ? (
                            <span className="shrink-0 rounded bg-[#3482AE]/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-[#2a6a8f] uppercase">
                              {lectureQuestions.length} Q
                            </span>
                          ) : null}
                          {hasDropdown ? (
                            <ChevronDown
                              className={`h-3 w-3 shrink-0 text-gray-400 transition-transform ${
                                expanded ? "rotate-180" : ""
                              }`}
                            />
                          ) : null}
                        </button>

                        {materials.length === 0 ? null : done ? (
                          <span className="shrink-0 rounded-full bg-[#20c997]/15 px-2.5 py-1 text-[11px] font-bold tracking-wide text-[#158765] uppercase">
                            Completed
                          </span>
                        ) : (
                          <span className="flex shrink-0 items-center gap-2">
                            {/* With more than one resource the row says how far
                                through the lecture is, so "Watch video" turning
                                into "Open file" reads as progress. */}
                            {materials.length > 1 && !preview ? (
                              <span className="text-[11px] font-semibold normal-case text-gray-500">
                                {openedCount}/{materials.length}
                              </span>
                            ) : null}
                            {/* A video plays up in the preview card; a PDF, or
                                a link that is really a web page, still opens
                                in its own tab. */}
                            {inCard(nextMaterial) ? (
                              <button
                                type="button"
                                onClick={() =>
                                  playInCard(key, nextMaterial, lecture.name)
                                }
                                className="cursor-pointer rounded bg-[#3482AE] px-3 py-1.5 text-[11px] font-bold tracking-wide text-white uppercase transition-colors hover:bg-[#2b6b90]"
                              >
                                {materialAction(nextMaterial)}
                              </button>
                            ) : nextMaterial.viewer ? (
                              <button
                                type="button"
                                onClick={() => openInPage(key, nextMaterial)}
                                className="cursor-pointer rounded bg-[#3482AE] px-3 py-1.5 text-[11px] font-bold tracking-wide text-white uppercase transition-colors hover:bg-[#2b6b90]"
                              >
                                {materialAction(nextMaterial)}
                              </button>
                            ) : (
                              <a
                                href={nextMaterial.href}
                                target="_blank"
                                rel="noreferrer"
                                onClick={() =>
                                  markWatched(materialKey(key, nextMaterial.id))
                                }
                                className="rounded bg-[#3482AE] px-3 py-1.5 text-[11px] font-bold tracking-wide text-white uppercase transition-colors hover:bg-[#2b6b90]"
                              >
                                {materialAction(nextMaterial)}
                              </a>
                            )}
                          </span>
                        )}
                      </div>

                      {/* Lecture detail dropdown: every resource for the
                          lecture, and its own assignment at the foot. */}
                      {expanded && hasDropdown ? (
                        // The panel used to be inset to clear the row's status
                        // icon, which cost it 2.5rem of width — long PDF names
                        // and URLs wrapped inside a column narrower than the
                        // row above it. A small indent still reads as nested.
                        <div className="mx-4 mb-3 ml-6 space-y-2 rounded border border-gray-200 bg-[#f8f9fa] px-4 py-3">
                          {lecture.materialFile ? (
                            <p className="text-xs normal-case">
                              <span className="font-semibold text-gray-500">
                                Material File (PDF):{" "}
                              </span>
                              {/* A PDF or a workbook is read in the page; an
                                  image or anything else has no in-page reader,
                                  so it still goes to the browser. */}
                              <MaterialLink
                                inPage={Boolean(viewerFor(lecture.materialFile))}
                                href={materialUrl(lecture.materialFile)}
                                onOpen={() =>
                                  openInPage(key, {
                                    id: "file",
                                    href: materialUrl(lecture.materialFile),
                                    name: fileName(lecture.materialFile),
                                    viewer: viewerFor(lecture.materialFile),
                                  })
                                }
                                onTabOpen={() =>
                                  markWatched(materialKey(key, "file"))
                                }
                                className={materialTextCls}
                              >
                                {fileName(lecture.materialFile)}
                              </MaterialLink>
                              {materialWatched(key, "file", sectionSubmitted) ? (
                                <span className={materialTickCls}>✓ opened</span>
                              ) : null}
                            </p>
                          ) : null}
                          {/* An uploaded video sits where a pasted link would,
                              and reads the same way. Without this it was the
                              one material with no entry of its own — reachable
                              only through the row's button, and then only once
                              anything ahead of it had been opened. */}
                          {lecture.materialVideo ? (
                            <p className="text-xs normal-case">
                              <span className="font-semibold text-gray-500">
                                Uploaded Video:{" "}
                              </span>
                              <MaterialLink
                                inPage={Boolean(onPlay)}
                                href={materialUrl(lecture.materialVideo)}
                                onOpen={() =>
                                  playInCard(
                                    key,
                                    {
                                      id: "video",
                                      kind: "video",
                                      href: materialUrl(lecture.materialVideo),
                                    },
                                    lecture.name
                                  )
                                }
                                onTabOpen={() =>
                                  markWatched(materialKey(key, "video"))
                                }
                                className={materialTextCls}
                              >
                                {fileName(lecture.materialVideo)}
                              </MaterialLink>
                              {materialWatched(key, "video", sectionSubmitted) ? (
                                <span className={materialTickCls}>✓ watched</span>
                              ) : null}
                            </p>
                          ) : null}
                          {lecture.link ? (
                            <p className="text-xs normal-case">
                              <span className="font-semibold text-gray-500">
                                Video Link:{" "}
                              </span>
                              <MaterialLink
                                inPage={
                                  Boolean(onPlay) && isEmbeddableVideo(lecture.link)
                                }
                                href={lecture.link}
                                onOpen={() =>
                                  playInCard(
                                    key,
                                    { id: "link", kind: "link", href: lecture.link },
                                    lecture.name
                                  )
                                }
                                onTabOpen={() =>
                                  markWatched(materialKey(key, "link"))
                                }
                                className={materialTextCls}
                              >
                                {lecture.link}
                              </MaterialLink>
                              {materialWatched(key, "link", sectionSubmitted) ? (
                                <span className={materialTickCls}>✓ watched</span>
                              ) : null}
                            </p>
                          ) : null}

                          {/* This lecture's own assignment, inside its
                              dropdown with the rest of its material. It opens
                              once the material has been opened, so the learner
                              works through lecture 1, answers its questions,
                              then moves on to lecture 2. */}
                          {lectureQuestions.length > 0 ? (
                            <p className="border-t border-gray-200 pt-2 text-xs normal-case">
                              <span className="font-semibold text-gray-500">
                                Assignment:{" "}
                              </span>
                              {/* Submission is per section, so once it is in,
                                  every lecture in that section says so — the
                                  link used to keep inviting the learner to
                                  start an assignment they had already sat, and
                                  only the page it opened admitted otherwise. */}
                              {sectionSubmitted ? (
                                <span className="inline-flex items-center gap-1.5 rounded bg-[#20c997]/15 px-2.5 py-1 text-[11px] font-bold tracking-wide text-[#158765] uppercase">
                                  <CircleCheckBig className="h-3 w-3" />
                                  Submitted
                                </span>
                              ) : lectureLocked ? (
                                <span className="inline-flex items-center gap-1 text-gray-400">
                                  <Lock className="h-3 w-3" />
                                  {lectureQuestions.length} question
                                  {lectureQuestions.length === 1 ? "" : "s"} —
                                  open this lecture&apos;s material to unlock
                                </span>
                              ) : (
                                <Link
                                  href={`/course/${emoduleId}/assignment/${section.id}?lectureId=${lecture.id}`}
                                  className="inline-flex items-center gap-1.5 rounded bg-[#20c997] px-3 py-1.5 text-[11px] font-bold tracking-wide text-white uppercase transition-colors hover:bg-[#1aa179]"
                                >
                                  <CircleCheckBig className="h-3 w-3" />
                                  {/* An officer cannot sit it — the page opens
                                      read-only for them — so it must not invite
                                      them to start one. */}
                                  {preview ? "View" : "Start"} assignment (
                                  {lectureQuestions.length} question
                                  {lectureQuestions.length === 1 ? "" : "s"})
                                </Link>
                              )}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}

                {/* A section-wide assignment link, for a section whose
                    questions could not be placed under any lecture. */}
                {section.assignmentStatus === 1 && placedQuestions === 0 ? (
                  <div className="border-t border-gray-200 px-4 py-2.5">
                    {sectionSubmitted ? (
                      <div className="flex items-center gap-3">
                        <CircleCheckBig className="h-4 w-4 shrink-0 text-[#20c997]" />
                        <p className="text-[13px] font-semibold normal-case text-[#158765]">
                          Assignment submitted
                        </p>
                      </div>
                    ) : assignmentLocked ? (
                      <div className="flex items-center gap-3">
                        <Lock className="h-4 w-4 shrink-0 text-gray-400" />
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold normal-case text-gray-400">
                            Assignment — locked
                          </p>
                          <p className="text-[12px] normal-case text-[#ffc107]">
                            Watch the video (and open the material) for every
                            lecture above to unlock the assignment.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <CircleCheckBig className="h-4 w-4 shrink-0 text-[#20c997]" />
                        <Link
                          href={`/course/${emoduleId}/assignment/${section.id}`}
                          className="text-[13px] font-semibold normal-case text-[#3482AE] underline underline-offset-2 hover:text-[#2b6b90]"
                        >
                          {preview ? "View assignment" : "Start assignment"}
                        </Link>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>

    {/* Outside the card so the page's own scroll and borders have no say in
        how the sheet is laid out. */}
    {viewing ? (
      <MaterialViewer
        kind={viewing.kind}
        name={viewing.name}
        url={viewing.url}
        onRead={viewing.onRead}
        onClose={() => setViewing(null)}
      />
    ) : null}
    </>
  );
}
