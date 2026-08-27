"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  CircleCheckBig,
  CirclePlay,
  ClipboardList,
  FileText,
  Lock,
} from "lucide-react";

import MaterialViewer from "@/components/course/MaterialViewer";
import { useAuth } from "@/context/AuthContext";
import { encodeId } from "@/lib/courseId";
import { withReviewEmp } from "@/lib/courseReview";
import { getEmpCode } from "@/lib/permissions";
import { EXAM_TYPES, EXAM_TYPE_LIST, examTypeLabel } from "@/lib/examType";
import {
  getAssignmentQuestions,
  getSubmittedAnswers,
  isPaperSubmitted,
} from "@/services/AssignmentService";
import { isEmbeddableVideo } from "@/lib/video";
import { MATERIAL_KINDS } from "@/services/ProgressService";
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
 *
 * Keyed on the attempt as well, so a course handed back after a grade C starts
 * from nothing. Without that the previous sitting's ticks were still there when
 * it returned: every lecture already read as opened, the post assignment
 * unlocked on arrival, and the learner could go straight back to the paper they
 * had just failed without reopening any of the material. The old attempt's
 * ticks are simply left under their own key rather than deleted — they are that
 * sitting's record, and nothing reads them again.
 */
const watchedStorageKey = (empCode, emoduleId, attempt) =>
  `etms:watched:${empCode || "anon"}:${emoduleId}:${attempt}`;

function readWatched(empCode, emoduleId, attempt) {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(
      watchedStorageKey(empCode, emoduleId, attempt)
    );
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
function materialsOf(lecture, emoduleId) {
  const list = [];
  if (lecture.link) list.push({ id: "link", kind: "link", href: lecture.link });
  if (lecture.materialVideo)
    list.push({
      id: "video",
      kind: "video",
      href: materialUrl(lecture.materialVideo, emoduleId),
    });
  if (lecture.materialFile)
    list.push({
      id: "file",
      kind: "file",
      href: materialUrl(lecture.materialFile, emoduleId),
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

/** An unread section's papers — both known to exist, neither loaded yet. */
const emptyPapers = () =>
  Object.fromEntries(EXAM_TYPE_LIST.map((t) => [t.value, []]));

/** The paper sat after the lectures — the one that reports on the content. */
const POST_TYPE = EXAM_TYPES.POST;

/**
 * The two states an assignment link has, section-wide and per lecture alike.
 *
 * Shared so a paper looks the same wherever it is offered. They were drifting:
 * the section rows started a paper in brand blue while the lecture dropdown
 * started one in the same green the SUBMITTED badge uses, so on a section with
 * one paper done and one outstanding the screen showed two green buttons
 * meaning opposite things. Green now only ever means finished.
 */
/**
 * Every action in the right-hand rail is the same size, so the buttons line up
 * down the panel instead of each one hugging its own label — "Watch video" and
 * "Start post assignment" sat at different widths and the edge read as ragged.
 */
const RAIL_BTN =
  "inline-flex min-w-[11rem] shrink-0 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-[11px] font-bold tracking-wide uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2";

const PAPER_START_BTN = `${RAIL_BTN} bg-[#3482AE] text-white shadow-sm hover:bg-[#2b6b90] focus-visible:outline-[#3482AE]`;
const PAPER_DONE_BTN = `${RAIL_BTN} bg-[#20c997]/15 text-[#158765] ring-1 ring-[#20c997]/30 hover:bg-[#20c997]/25 focus-visible:outline-[#20c997]`;
/** A lecture's own material action — the same size, a lighter weight. */
const MATERIAL_BTN = `${RAIL_BTN} cursor-pointer border border-[#3482AE]/35 bg-white text-[#2a6a8f] hover:bg-[#eaf3f9] focus-visible:outline-[#3482AE]`;
/** A paper that cannot be opened yet. Same footprint, plainly not a button. */
const PAPER_LOCKED_BTN = `${RAIL_BTN} cursor-not-allowed bg-gray-200 text-gray-500`;

/**
 * One paper's row — pre or post.
 *
 * ONE component renders both, which is the point: the post assignment is not a
 * lesser thing with its own smaller styling, it is the same row with a
 * different label. Anything that changes here changes for both by
 * construction, so they cannot drift apart.
 *
 * The two bracket the lectures rather than sitting together above them, so each
 * is drawn against the edge it sits on: the pre row closes downward into the
 * list, the post row is a heavier rule that closes the section off. They used to
 * be rendered as a pair at the head, which put the post assignment in front of
 * the very lectures its own text told the learner to work through first.
 *
 * @param {string} examType which paper
 * @param {Array} questions its questions — empty when none were set
 * @param {boolean} submitted this learner has already answered all of them
 * @param {string|null} href the assignment page for it, null for an unsaved
 *   section
 * @param {boolean} preview an officer looking rather than sitting it
 * @param {boolean} [locked] the lectures this paper reports on have not all
 *   been worked through yet, so it cannot be opened
 * @param {string} [lockedReason] what is still outstanding, said plainly — a
 *   row that simply refuses to open reads as broken
 */
function AssignmentRow({
  examType,
  questions,
  submitted,
  href,
  preview,
  locked = false,
  lockedReason = "",
  solo = false,
  hideWhenEmpty = false,
}) {
  const label = examTypeLabel(examType);
  const count = questions.length;
  const isPost = examType === EXAM_TYPES.POST;

  const frame = isPost
    ? "border-t-2 border-[#3482AE]/30 bg-[#eaf3f9]"
    : "border-b border-gray-200 bg-[#eaf3f9]/60";

  if (count === 0) {
    // The other paper carries this section's assignment, so there is nothing to
    // report here — saying "no post assignment has been set" beside it only
    // raises a second paper the learner was never going to be given.
    if (hideWhenEmpty) return null;

    return (
      <div className={`px-4 py-2.5 ${frame}`}>
        <p className="flex items-center gap-2 text-[12px] normal-case text-gray-400">
          <ClipboardList className="h-3.5 w-3.5 shrink-0" />
          No {solo ? "assignment" : label.toLowerCase()} has been set for this
          section.
        </p>
      </div>
    );
  }

  return (
    <div className={`px-4 py-3 ${frame}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* The paper's name — only where the section HAS two of them. A name
            exists to tell one paper from another, so over the only paper there
            is it says nothing and implies a second one that never comes. The
            icon stays either way, so the row still reads as an assignment. */}
        <span className="flex shrink-0 items-center gap-2 text-[12px] font-bold tracking-wide text-[#2f6685] uppercase">
          <ClipboardList className="h-4 w-4 shrink-0 text-[#3482AE]" />
          {solo ? null : label}
        </span>
        <span className="min-w-0 flex-1 text-[12px] normal-case text-gray-600">
          {count} question{count === 1 ? "" : "s"}
          {/* Only a locked paper says anything here. The hints that used to
              follow — "complete this before you start the lectures below", its
              post-assignment twin, and the note that a submitted paper can no
              longer be changed — told a learner looking at a row with a live
              button on it what that button already says. */}
          {locked && !submitted ? ` — ${lockedReason}` : null}
        </span>
        {href ? (
          submitted ? (
            <Link href={href} className={PAPER_DONE_BTN}>
              <CircleCheckBig className="h-3 w-3" />
              Submitted — view answers
            </Link>
          ) : locked ? (
            // Deliberately not a dead-looking link: it is a real state with a
            // reason, and the row beside it says what still has to be done.
            <span className={PAPER_LOCKED_BTN} aria-disabled="true">
              <Lock className="h-3 w-3" />
              Locked
            </span>
          ) : (
            <Link href={href} className={PAPER_START_BTN}>
              <ClipboardList className="h-3 w-3" />
              {/* An officer cannot sit it — the page opens read-only. */}
              {preview ? "View" : "Start"} {label.toLowerCase()}
            </Link>
          )
        ) : null}
      </div>
    </div>
  );
}

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
 * "Course content": collapsible sections, each running the same three steps in
 * the same order, with each step waiting for the one before it.
 *
 *   1. the pre assignment — sat before any of the material is opened
 *   2. the lectures — locked until that paper is in
 *   3. the post assignment — locked until every lecture has been opened
 *
 * The lectures gate on the pre paper only, which the server can vouch for. The
 * post paper gates on the watched ticks below, which are a per-browser record —
 * so a learner who changes device has to reopen the material before that paper
 * comes back. That is the known cost of having no server-side "lecture viewed"
 * to gate on; see watchedStorageKey.
 *
 * A step that cannot be completed never shuts the one after it: a section with
 * no pre paper does not lock its lectures, and one with no lectures does not
 * lock its post paper. A training officer sees all three open — nothing they
 * open is ticked off, so no gate would ever lift for them and they could never
 * check the course they wrote.
 */
/**
 * @param {boolean} preview a training officer looking at the content rather
 *   than working through it. Nothing they open is ticked off, because these
 *   ticks are a learner's progress record — the same reason the assignment
 *   itself renders read-only for them.
 * @param {boolean} overdue the course's quarter has lapsed. It stays readable
 *   — that is the whole of what an overdue course is — but nothing can be
 *   submitted against it, so the gates below are lifted: a learner who never
 *   sat the pre paper would otherwise find the material it was meant to
 *   introduce shut for good, with no way left to open it.
 * @param {(video: {url: string, lecture: string, uploaded: boolean}) => void}
 *   [onPlay] hands a picked lecture to the preview card beside the course
 *   header, which plays it. Without it every video opens in a new tab.
 */
export default function CourseContent({
  emoduleId,
  sections = [],
  preview = false,
  overdue = false,
  onPlay,
  attempt = 0,
  reviewEmpCode = "",
}) {
  const { user } = useAuth();
  const empCode = getEmpCode(user);

  /**
   * An officer reading ONE employee's attempt, arrived at from COURSE STATUS.
   *
   * Still a preview in every sense that matters — nothing here is ticked off,
   * no gate applies and no paper can be answered — but the papers report that
   * employee's answers instead of opening as blank forms, so the SUBMITTED
   * badge and the review page below both speak about the right person.
   */
  const reviewing = preview && Boolean(reviewEmpCode);
  /** Whose answers the rows below are about: the viewer's, or the reviewed. */
  const answersEmpCode = reviewing ? reviewEmpCode : empCode;

  /**
   * Nothing here is gated, and every paper reads rather than opens.
   *
   * Two cases, for one reason: neither viewer can submit anything. An officer
   * is looking rather than working through it, and an overdue course's quarter
   * has closed — the assignment page already renders inert for both. A gate
   * exists to hold a step until the one before it is done, so where no step can
   * be done any more it holds nothing back and only shuts the material away
   * from someone who is entitled to read it.
   */
  const ungated = preview || overdue;

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
    preview ? new Set() : readWatched(empCode, emoduleId, attempt)
  );

  // The session is restored asynchronously by AuthProvider, so empCode can
  // arrive after the first render — re-read once it does.
  useEffect(() => {
    if (preview) return;
    setWatched(readWatched(empCode, emoduleId, attempt));
  }, [empCode, emoduleId, preview, attempt]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // An officer's browsing must not be written to storage either, or it would
    // be read back as progress the moment the flag was off.
    if (preview) return;
    try {
      window.localStorage.setItem(
        watchedStorageKey(empCode, emoduleId, attempt),
        JSON.stringify([...watched])
      );
    } catch {
      // A full or blocked storage quota must not break the page.
    }
  }, [watched, empCode, emoduleId, preview, attempt]);

  // sectionId → {PRE: [...], POST: [...]}, read the first time a section with
  // an assignment is opened. Both papers, so each row can say what it holds.
  const [questionsBySection, setQuestionsBySection] = useState({});
  // sectionId → {questionId: answer} for everything this learner has answered
  // in that section. This is what tells the pre and post rows apart: the
  // backend's own "submitted" flag is section-wide and cannot.
  const [answersBySection, setAnswersBySection] = useState({});

  const loadQuestions = useCallback(
    async (section) => {
      if (!section.id || section.assignmentStatus !== 1) return;
      let alreadyAsked = false;
      setQuestionsBySection((prev) => {
        alreadyAsked = section.id in prev;
        return alreadyAsked ? prev : { ...prev, [section.id]: emptyPapers() };
      });
      if (alreadyAsked) return;
      try {
        // Both papers at once — a section's post assignment is as much a part
        // of it as its pre assignment, and neither row can render without its
        // own question count.
        const papers = await Promise.all(
          EXAM_TYPE_LIST.map((t) =>
            getAssignmentQuestions(emoduleId, section.id, t.value)
          )
        );
        const byType = Object.fromEntries(
          EXAM_TYPE_LIST.map((t, i) => [t.value, papers[i]])
        );
        setQuestionsBySection((prev) => ({ ...prev, [section.id]: byType }));
      } catch {
        // The rows fall back to reporting no questions rather than breaking.
      }
    },
    [emoduleId]
  );

  /**
   * What this learner has already answered, per section.
   *
   * Read for every section up front rather than as each one is expanded: it
   * decides the counts in the toolbar, and those have to be right on arrival.
   * An officer has no attempt of their own to report on, so it is not asked.
   *
   * `/submit_exam/answers` is used rather than `/submit_exam/by_sectionid`
   * because the latter takes no paper and ignores one if sent — it can say the
   * section was handed in, never which of the two. These rows carry question
   * ids, and a question id belongs to exactly one paper.
   */
  useEffect(() => {
    // A plain preview has no attempt to report on; a review has somebody
    // else's, which is the one case an officer does read this.
    if ((preview && !reviewing) || !answersEmpCode) return;
    let cancelled = false;

    Promise.all(
      sections
        .filter((s) => s.id && s.assignmentStatus === 1)
        .map((s) =>
          getSubmittedAnswers(emoduleId, s.id, answersEmpCode)
            .then((answers) => [s.id, answers])
            // A failed lookup just leaves that section unknown; the assignment
            // page's own check catches it.
            .catch(() => null)
        )
    ).then((results) => {
      if (cancelled) return;
      const next = Object.fromEntries(results.filter(Boolean));
      if (Object.keys(next).length > 0) {
        setAnswersBySection((prev) => ({ ...prev, ...next }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [sections, emoduleId, answersEmpCode, preview, reviewing]);

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
   * Reads the POST paper, not the pre one. The post assignment is the one sat
   * after the lectures, so having answered it is proof the content was worked
   * through — the pre assignment is sat before any of it and says nothing about
   * whether the material was opened. The ticks are per browser, so without this
   * a learner who sat the paper on another machine, or cleared their storage,
   * came back to a course reading 0/2 done beside their own SUBMITTED badge.
   *
   * This is the only half of that record the server keeps.
   */
  const isSubmitted = (section) => {
    const papers = questionsBySection[section.id];
    const answered = answersBySection[section.id];
    if (!papers || !answered) return false;
    return isPaperSubmitted(papers[POST_TYPE], answered);
  };

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
  const openInPage = (key, material, where) => {
    setViewing({
      name: material.name,
      url: material.href,
      kind: material.viewer,
      // The backend ids behind this material, so the time spent on it can be
      // reported against the right lecture. The browser ticks below are keyed on
      // `lectureKey`, which falls back to array positions for rows the backend
      // left without an id — those cannot be reported, and are left out here.
      sectionId: where?.sectionId,
      lectureId: where?.lectureId,
      onRead: ungated
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
  const playInCard = (key, material, lectureName, where) => {
    const tracked =
      material.kind === "video" || isEmbeddableVideo(material.href);
    if (!tracked) markWatched(materialKey(key, material.id));

    onPlay({
      url: material.href,
      lecture: lectureName,
      uploaded: material.kind === "video",
      // Only where a tick is still worth something. An overdue course's is not:
      // nothing it could unlock is gated any more, and a card that refuses to
      // be skipped through is a lock over a record that can never be spent.
      onWatched:
        tracked && !ungated
          ? () => markWatched(materialKey(key, material.id))
          : null,
      // Only a video the card can actually measure has anything to report, and
      // only for a learner — an officer previewing the content records nothing.
      // A link that opens in a tab is unreachable from here either way.
      material:
        tracked && !ungated && where?.lectureId
          ? {
              empCode,
              emoduleId,
              sectionId: where.sectionId,
              lectureId: where.lectureId,
              kind:
                material.kind === "video"
                  ? MATERIAL_KINDS.VIDEO
                  : MATERIAL_KINDS.LINK,
            }
          : null,
    });
  };

  /** How many of a section's lectures are done. */
  const watchedIn = (section, i) =>
    isSubmitted(section)
      ? section.lectures.length
      : section.lectures.filter((l, j) =>
          lectureDone(lectureKey(section, l, i, j), materialsOf(l, emoduleId))
        ).length;

  const watchedCount = useMemo(
    () => sections.reduce((n, s, i) => n + watchedIn(s, i), 0),
    // watched is a Set replaced on every change, so this recomputes when it does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sections, watched, questionsBySection, answersBySection]
  );

  const allOpen = openSections.size === sections.length;

  const markWatched = (key) =>
    setWatched((prev) => {
      // Opening something as an officer is not a learner completing it, and an
      // overdue course has nothing left to complete.
      if (ungated || prev.has(key)) return prev;
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

        const papers = questionsBySection[section.id] ?? emptyPapers();
        const answered = answersBySection[section.id] ?? null;
        // Each paper spread over the lectures on its own, so a question is
        // never placed against a lecture by counting the other paper's rows.
        const perLecture = Object.fromEntries(
          EXAM_TYPE_LIST.map((t) => [
            t.value,
            questionsByLecture(section.lectures, papers[t.value]),
          ])
        );
        // Every question of the section, both papers, so the header count and
        // the lecture badges cover the whole of what was set for it.
        const sectionQuestions = EXAM_TYPE_LIST.flatMap((t) => papers[t.value]);
        const sectionWatched = watchedIn(section, i);


        /**
         * The assignment page for one paper of this section. `type` is what
         * decides which questions it loads, saves against and scores — without
         * it the post paper would open as the pre one.
         */
        const paperHref = (examType, lectureId = null) => {
          if (!section.id) return null;
          const base = `/course/${encodeId(emoduleId)}/assignment/${encodeId(section.id)}?type=${examType}`;
          const href = lectureId ? `${base}&lectureId=${encodeId(lectureId)}` : base;
          // Whose paper it is, where that is not the viewer's own — the page
          // has no other way to know, and without it an officer reviewing an
          // attempt lands on a blank form with nothing marked.
          return withReviewEmp(href, reviewing ? reviewEmpCode : "");
        };

        /** Has this learner sat one paper of this section? */
        const paperDone = (examType) =>
          (reviewing || !preview) &&
          isPaperSubmitted(papers[examType], answered);

        /**
         * The section runs in one order, and each step waits for the one before
         * it: pre assignment, then the lectures, then the post assignment.
         *
         * Declared here rather than higher up because they call `paperDone`, and
         * a const arrow function cannot be called before its own declaration.
         *
         * Neither gate applies to an officer: nothing they open is ticked off —
         * those ticks are a learner's progress record — so no gate would ever
         * lift for them and they could never check the papers they wrote.
         */

        /**
         * The lectures wait for the pre assignment — and for nothing else.
         *
         * Only where there IS one. A section with no pre paper has nothing to
         * wait for, and gating on a paper that does not exist would shut its
         * lectures for good.
         */
        const lecturesLocked =
          !ungated &&
          papers[EXAM_TYPES.PRE].length > 0 &&
          !paperDone(EXAM_TYPES.PRE);

        /**
         * Is every lecture in this section worked through?
         *
         * A section with no lectures counts as done — there is nothing to open,
         * and a paper that could never be unlocked is worse than an ungated one.
         * `watchedIn` already treats a lecture carrying no material at all as
         * done, for the same reason.
         */
        const lecturesDone =
          section.lectures.length === 0 ||
          sectionWatched === section.lectures.length;

        /**
         * The post assignment waits for the lectures it reports on. Never
         * applied to a paper already handed in, which stays readable.
         */
        const postLocked =
          !ungated && !lecturesDone && !paperDone(EXAM_TYPES.POST);

        /*
         * Does this section actually run two papers?
         *
         * The PRE / POST names only tell one paper from another, so they are
         * worth showing only where there are two. On a section carrying a
         * single assignment — which is every course written before the post
         * paper existed, and any newer one the officer chose not to give a
         * second — naming it "Pre assignment" implies a post paper is coming,
         * and the empty row underneath announces one that never was. Both are
         * dropped and the row is simply the assignment, with its button.
         *
         * Read off the questions rather than off the module's age: what makes
         * the distinction meaningless is having one paper, not being old.
         */
        const hasPre = papers[EXAM_TYPES.PRE].length > 0;
        const hasPost = papers[EXAM_TYPES.POST].length > 0;
        const soloPaper = !(hasPre && hasPost);

        return (
          <div key={section.id || i} className="border-b border-gray-200 last:border-b-0">
            <button
              type="button"
              onClick={() => {
                if (!open) loadQuestions(section);
                toggleSection(i);
              }}
              aria-expanded={open}
              className="flex w-full cursor-pointer items-center gap-3 bg-[#f7f9fb] px-4 py-3.5 text-left outline-none transition-colors hover:bg-[#eef3f7] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#3482AE]"
            >
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-[#3482AE] transition-transform ${
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
                {/* The pre assignment, ahead of the lectures. Every
                    section carries this row, so a learner is never left
                    wondering whether one was set. */}
                <AssignmentRow
                  examType={EXAM_TYPES.PRE}
                  questions={papers[EXAM_TYPES.PRE]}
                  submitted={paperDone(EXAM_TYPES.PRE)}
                  href={paperHref(EXAM_TYPES.PRE)}
                  preview={ungated}
                  solo={soloPaper}
                  // The post paper holds this section's assignment, so this
                  // row has nothing of its own to say.
                  hideWhenEmpty={hasPost}
                />

                {/* The lectures, between the two papers. Given a band of its
                    own so the list has a heading and the rows are plainly the
                    middle of the section rather than loose rows between two
                    blue bars. Same brand tint and same icon-and-label shape as
                    the papers, so the three read as one set — which is the work
                    the 1/2/3 badges used to do. */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-gray-200 bg-[#eaf3f9] px-4 py-2.5">
                  <span className="flex shrink-0 items-center gap-2 text-[12px] font-bold tracking-wide text-[#2f6685] uppercase">
                    <BookOpen className="h-4 w-4 shrink-0 text-[#3482AE]" />
                    Lectures
                  </span>
                  <span className="min-w-0 flex-1 text-[12px] normal-case text-gray-600">
                    {section.lectures.length} lecture
                    {section.lectures.length === 1 ? "" : "s"}
                    {ungated || lecturesLocked
                      ? ""
                      : ` — ${sectionWatched} of ${section.lectures.length} opened.`}
                  </span>
                  {lecturesLocked ? (
                    <span className={PAPER_LOCKED_BTN} aria-disabled="true">
                      <Lock className="h-3 w-3" />
                      Locked
                    </span>
                  ) : null}
                </div>

                {section.lectures.map((lecture, j) => {
                  const key = lectureKey(section, lecture, i, j);
                  const expanded = openLectures.has(key);
                  const materials = materialsOf(lecture, emoduleId);
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
                  // How many of the section's questions are about this lecture,
                  // across both papers. Kept as the row's "2 Q" badge — it tells
                  // a learner which lectures the papers actually draw on — but
                  // it no longer opens anything: the papers are sat from the
                  // section rows, not per lecture.
                  const lectureQuestions = EXAM_TYPE_LIST.reduce(
                    (n, type) =>
                      n + (perLecture[type.value].get(lecture.id)?.length ?? 0),
                    0
                  );
                  // Materials only. It used to open for a lecture whose only
                  // extra was its assignment links; with those gone that would
                  // be an empty panel. Shut entirely while the lectures are
                  // locked — the dropdown lists the very files and videos the
                  // gate exists to hold back, so leaving it openable would be
                  // a way straight around it.
                  const hasDropdown = hasDetail && !lecturesLocked;

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
                          // outline-none only kills the ring a mouse click
                          // leaves behind — the default one is drawn around the
                          // whole flex-1 row and reads as a text input sitting
                          // in the middle of the list. focus-visible keeps it
                          // for anyone arriving by keyboard, who needs it.
                          className={`flex min-w-0 flex-1 items-center gap-1.5 rounded text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3482AE] ${
                            hasDropdown ? "cursor-pointer" : "cursor-default"
                          }`}
                        >
                          <span className="truncate text-[13px] font-semibold normal-case text-gray-700">
                            {lecture.name || `Lecture ${j + 1}`}
                          </span>
                          {lectureQuestions > 0 ? (
                            <span className="shrink-0 rounded bg-[#3482AE]/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-[#2a6a8f] uppercase">
                              {lectureQuestions} Q
                            </span>
                          ) : null}
                          {hasDropdown ? (
                            <ChevronDown
                              className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${
                                expanded ? "rotate-180" : ""
                              }`}
                            />
                          ) : null}
                        </button>

                        {materials.length === 0 ? null : lecturesLocked ? (
                          // The row's button is the other way into the material,
                          // so it has to close with the dropdown or the gate
                          // holds nothing back.
                          <span className={PAPER_LOCKED_BTN} aria-disabled="true">
                            <Lock className="h-3 w-3" />
                            Locked
                          </span>
                        ) : done ? (
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
                                  playInCard(key, nextMaterial, lecture.name, {
                                    sectionId: section.id,
                                    lectureId: lecture.id,
                                  })
                                }
                                className={MATERIAL_BTN}
                              >
                                {materialAction(nextMaterial)}
                              </button>
                            ) : nextMaterial.viewer ? (
                              <button
                                type="button"
                                onClick={() =>
                                  openInPage(key, nextMaterial, {
                                    sectionId: section.id,
                                    lectureId: lecture.id,
                                  })
                                }
                                className={MATERIAL_BTN}
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
                                className={MATERIAL_BTN}
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
                                href={materialUrl(lecture.materialFile, emoduleId)}
                                onOpen={() =>
                                  openInPage(
                                    key,
                                    {
                                      id: "file",
                                      href: materialUrl(lecture.materialFile, emoduleId),
                                      name: fileName(lecture.materialFile),
                                      viewer: viewerFor(lecture.materialFile),
                                    },
                                    {
                                      sectionId: section.id,
                                      lectureId: lecture.id,
                                    }
                                  )
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
                                href={materialUrl(lecture.materialVideo, emoduleId)}
                                onOpen={() =>
                                  playInCard(
                                    key,
                                    {
                                      id: "video",
                                      kind: "video",
                                      href: materialUrl(lecture.materialVideo, emoduleId),
                                    },
                                    lecture.name,
                                    {
                                      sectionId: section.id,
                                      lectureId: lecture.id,
                                    }
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
                                    lecture.name,
                                    {
                                      sectionId: section.id,
                                      lectureId: lecture.id,
                                    }
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

                          {/* The pre and post links that used to sit here, one
                              per lecture, are gone. They offered the very same
                              two papers as the section rows above and below —
                              a section with one lecture showed each paper
                              twice, and the second pair sat inside a dropdown
                              where a learner had to go looking for it. The
                              section rows are the single way in, which also
                              makes the post assignment's lock meaningful:
                              while it was reachable from in here as well, the
                              gate could simply be walked around. */}
                        </div>
                      ) : null}
                    </div>
                  );
                })}

                {/* The post assignment, last, after the lectures it
                    reports on. This is the row's natural home: it is sat once
                    the content has been worked through, and putting it here
                    also gives the section a definite end.

                    It is also the one paper that is gated. The post assignment
                    asks what the lectures taught, so it cannot honestly be sat
                    before they have been opened — every file read and every
                    video watched. The pre assignment is deliberately NOT gated:
                    it is sat first, before any of the content. */}
                <AssignmentRow
                  examType={EXAM_TYPES.POST}
                  questions={papers[EXAM_TYPES.POST]}
                  submitted={paperDone(EXAM_TYPES.POST)}
                  href={paperHref(EXAM_TYPES.POST)}
                  preview={ungated}
                  solo={soloPaper}
                  // With no post paper set, the pre row above is the whole of
                  // this section's assignment; a "none set" line here would only
                  // announce a second paper that was never written.
                  hideWhenEmpty={!hasPost}
                  locked={postLocked}
                  lockedReason={`open all ${section.lectures.length} lecture${
                    section.lectures.length === 1 ? "" : "s"
                  } above to unlock this (${sectionWatched} of ${
                    section.lectures.length
                  } done).`}
                />

                {/* The section-wide link that used to sit here — for a section
                    whose questions could not be placed under any lecture — is
                    gone: the two assignment rows cover every section, placed
                    questions or not. */}
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
        // An officer is checking the material, not working through it, so
        // nothing they open is reported — the same reason they get no tick.
        material={
          preview || !viewing.lectureId
            ? null
            : {
                empCode,
                emoduleId,
                sectionId: viewing.sectionId,
                lectureId: viewing.lectureId,
                kind: MATERIAL_KINDS.FILE,
              }
        }
        onClose={() => setViewing(null)}
      />
    ) : null}
    </>
  );
}
