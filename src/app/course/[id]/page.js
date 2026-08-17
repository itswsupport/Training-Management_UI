"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  FileText,
  Layers,
  Lock,
  Pencil,
  RotateCcw,
  Sparkles,
  User,
} from "lucide-react";

import BlockHeading from "@/components/course/BlockHeading";
import CourseContent from "@/components/course/CourseContent";
import CourseContentEditor from "@/components/course/CourseContentEditor";
import CourseDetailsEditor from "@/components/course/CourseDetailsEditor";
import CourseHistory from "@/components/course/CourseHistory";
import CourseNotice from "@/components/course/CourseNotice";
import CoursePreviewCard from "@/components/course/CoursePreviewCard";
import RichText from "@/components/course/RichText";
import TopicsCovered from "@/components/course/TopicsCovered";
import WhatYouLearn from "@/components/course/WhatYouLearn";
import { apiErrorMessage } from "@/config/api";
import { useAuth } from "@/context/AuthContext";
import { useCourseAccess } from "@/hooks/useCourseAccess";
import { alerts } from "@/lib/alerts";
import { decodeId, encodeId } from "@/lib/courseId";
import { getEmpCode, isTrainingOfficer } from "@/lib/permissions";
import {
  getModuleFormOptions,
  isQuarterClosed,
} from "@/services/MasterDataService";
import { getCourseDetail } from "@/services/ModuleService";
import { isFeedbackDue } from "@/services/FeedbackService";
import { getUpdateSinceCompletion } from "@/services/UserCourseService";

/** A translucent white pill used for course meta in the header banner. */
function Chip({ icon, text }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[12px] normal-case text-white ring-1 ring-white/20">
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{text}</span>
    </span>
  );
}

export default function CourseViewPage({ params }) {
  // `params` is a Promise in this Next version — unwrapped with React's `use`.
  // The segment is an obfuscated token, not the id itself; a token this app did
  // not mint decodes to NaN and is handled as a course that does not exist.
  const { id } = use(params);
  const emoduleId = decodeId(id);

  const { user } = useAuth();
  const empCode = getEmpCode(user);

  // Editing belongs to the Training Officer Dashboard's module list, which
  // links here with ?from=officer. The same officer opening this course from
  // their own learner dashboard gets the plain read-only page. Read from
  // location rather than useSearchParams so this route needs no Suspense
  // boundary — it only decides whether a button is shown.
  const [fromOfficer, setFromOfficer] = useState(false);
  useEffect(() => {
    setFromOfficer(
      new URLSearchParams(window.location.search).get("from") === "officer"
    );
  }, []);

  // The officer's view of the course: their history panel hangs off this, and
  // it stays available whatever the quarter has done — a closed quarter is a
  // reason to stop changing the record, not to stop reading it.
  const officerView = isTrainingOfficer(user) && fromOfficer;

  // Whether this course is this user's to open at all. Guards the id in the
  // URL, which is otherwise anybody's to change.
  const access = useCourseAccess(emoduleId);

  const [course, setCourse] = useState(null);
  const [feedbackDue, setFeedbackDue] = useState(false);
  // Set only when this learner has completed the course and the officer has
  // added to it since.
  const [update, setUpdate] = useState(null);
  // The lecture picked out of the course content list, played by the preview
  // card. Null until something is picked, which leaves the card on the course's
  // own first video.
  const [activeVideo, setActiveVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Once the quarter a course was raised for has passed, its record is closed:
  // the officer can no longer change its details or put it in front of another
  // department or grade, because both of those happen through the same edit
  // form and would re-assign a course against a window that has already been
  // reported on. Unknown until the course has loaded, and undated modules are
  // never closed — see isQuarterClosed.
  const quarterClosed = isQuarterClosed(course?.validTill);
  const canEdit = officerView && !quarterClosed;

  // Officer edit mode. The form's dropdown data is only fetched when EDIT is
  // pressed, so a learner viewing the course never pays for it.
  const [editing, setEditing] = useState(false);
  const [options, setOptions] = useState(null);
  const [openingEditor, setOpeningEditor] = useState(false);

  // The two editors below hold their own form state; the page's single SAVE
  // drives both through these handles.
  const detailsRef = useRef(null);
  const contentRef = useRef(null);
  const [saving, setSaving] = useState(false);

  const startEditing = useCallback(async () => {
    // The button is not rendered for a closed quarter; this is the same rule
    // stated where the editor actually opens, so no other caller can get in.
    if (!canEdit) return;
    if (options) {
      setEditing(true);
      return;
    }
    setOpeningEditor(true);
    try {
      setOptions(await getModuleFormOptions());
      setEditing(true);
    } catch (err) {
      await alerts.error(
        apiErrorMessage(err, "Could not load the edit form."),
        "Could not open editor"
      );
    } finally {
      setOpeningEditor(false);
    }
  }, [options, canEdit]);

  /** Re-reads the course; also used to show an officer their saved edits. */
  const loadCourse = useCallback(
    async ({ silent = false } = {}) => {
      if (!Number.isFinite(emoduleId)) {
        setLoadError("This course could not be found.");
        setLoading(false);
        return;
      }
      // Nothing is fetched until the course is known to be this user's, so an
      // id typed into the address bar never reaches the API at all.
      if (!access.allowed) return;
      if (!silent) setLoading(true);
      setLoadError(null);
      try {
        const detail = await getCourseDetail(emoduleId);
        setCourse(detail);

        if (detail && empCode) {
          // Independent of each other, and neither may keep the course off the
          // screen — a failed lookup just leaves its banner off.
          const [due, changed] = await Promise.all([
            isFeedbackDue(empCode, emoduleId).catch(() => false),
            getUpdateSinceCompletion(empCode, emoduleId).catch(() => null),
          ]);
          setFeedbackDue(due);
          setUpdate(changed);
        }
      } catch (err) {
        setLoadError(
          apiErrorMessage(err, "Something went wrong loading this course.")
        );
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [emoduleId, empCode, access.allowed]
  );

  useEffect(() => {
    loadCourse();
  }, [loadCourse]);

  /**
   * The one save for the whole edit screen: the course's details first, then
   * any section the officer touched. Each editor reports whether its write
   * went through and has already shown the reason if it didn't, so a failure
   * just leaves the form open with everything still typed in.
   */
  const handleSaveAll = useCallback(async () => {
    // A form opened while the quarter was still open, and submitted after it
    // closed — a tab left overnight on the 30th does exactly this. Refused
    // here rather than written and reported as saved.
    if (!canEdit) {
      await alerts.warning(
        "This course's quarter has ended, so its details can no longer be changed.",
        "Quarter closed"
      );
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      if (!(await detailsRef.current?.save())) return;
      if (!(await contentRef.current?.save())) return;

      await alerts.success("Course updated successfully.");
      setEditing(false);
      await loadCourse({ silent: true });
    } finally {
      setSaving(false);
    }
  }, [loadCourse, canEdit]);

  // `checking` also covers a refused course, which is on its way to the
  // dashboard — it must show the spinner rather than any of the content below.
  if (access.checking || loading) {
    return (
      <div className="bg-white rounded shadow border border-gray-200 overflow-hidden text-[12px]">
        <div className="flex justify-center items-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3482AE]"></div>
        </div>
      </div>
    );
  }

  if (loadError || !course) {
    return (
      <div className="bg-white rounded shadow border border-gray-200 overflow-hidden text-[12px]">
        <div className="text-red-500 p-4 text-center normal-case">
          {loadError ?? "This course could not be found."}
        </div>
      </div>
    );
  }

  // Raised for a quarter still ahead. The course is theirs and shows in their
  // PENDING list from the day it is assigned, but none of it opens until the
  // quarter it covers starts — so this stands in place of the whole page rather
  // than disabling the lectures one by one. No emoduleId is passed: the notice's
  // own BACK button would otherwise point back at this very page.
  if (access.locked) {
    return (
      <CourseNotice title="Course not open yet">
        <strong>{course.name}</strong> is scheduled for a quarter that has not
        started yet.
        {access.unlocksOn
          ? ` You can begin it from ${access.unlocksOn}.`
          : " You can begin it once its quarter starts."}{" "}
        It stays in your pending list until then.
      </CourseNotice>
    );
  }

  // Officer edit mode replaces the course header with the details form; the
  // sections and lectures below stay as they are, read-only.
  if (editing && options && canEdit) {
    return (
      <div className="w-full space-y-5">
        <CourseDetailsEditor
          ref={detailsRef}
          course={course}
          options={options}
        />

        <CourseContentEditor ref={contentRef} course={course} />

        {/* payroll puts the Apply/Cancel pair centred at the foot of a form. */}
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            type="button"
            disabled={saving}
            onClick={handleSaveAll}
            className="px-6 py-2 bg-[#3482AE] text-white text-sm font-semibold rounded shadow hover:bg-[#2a6a8f] transition-colors cursor-pointer disabled:opacity-60"
          >
            {saving ? "UPDATING..." : "UPDATE"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => setEditing(false)}
            className="px-6 py-2 bg-[#f23a4c] text-white text-sm font-semibold rounded shadow hover:bg-[#d92e3f] transition-colors cursor-pointer disabled:opacity-60"
          >
            CANCEL
          </button>
        </div>
      </div>
    );
  }

  const totalLectures = course.sections.reduce((n, s) => n + s.lectures.length, 0);

  return (
    <div className="w-full space-y-5">
      {/* HERO: course header on the left, preview-video card on the right.
          The columns are fluid — the header takes what is left after the
          preview card, which never drops below a readable width and never
          grows past a third. Two columns from tablet width up, where the old
          three-column split still stacked and wasted half the screen. */}
      <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
        <div className="flex h-full min-w-0 flex-col overflow-hidden rounded border border-gray-200 bg-white text-[12px] shadow">
          <div className="flex flex-col gap-3 bg-gradient-to-r from-[#3482AE] to-[#2b6b90] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              {/* A course the learner has already finished still looks
                  finished — this is the only sign that the officer has put
                  something new in it since.

                  The whole row is conditional now that the course code has
                  moved down into the heading: an always-rendered wrapper would
                  leave its bottom margin behind as a gap above the title on
                  every course that has no update. */}
              {update ? (
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span
                    title={`${update.description || "Course content updated"} — ${update.when}`}
                    className="inline-flex items-center gap-1 rounded bg-[#ffc107] px-2 py-0.5 text-[11px] font-bold tracking-[0.08em] text-[#5a4300] uppercase"
                  >
                    <Sparkles className="h-3 w-3" />
                    New content
                  </span>
                </div>
              ) : null}
              {/* Code and name on one line, "[NO-FT-291] Novel test module".
                  The code was a pill on its own row above the title, which cost
                  a line of the hero to six characters. Bracketed rather than
                  merely prefixed so it still reads as a reference and not as
                  the first word of the course name. Left off entirely when a
                  course has no code — "[Training Course] …" would read as one. */}
              <h2 className="text-xl leading-snug font-bold normal-case text-white">
                {course.code ? `[${course.code}] ` : ""}
                {course.name}
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Chip
                  icon={<Layers className="h-3.5 w-3.5" />}
                  text={course.category || "—"}
                />
                <Chip
                  icon={<User className="h-3.5 w-3.5" />}
                  text={course.instructor || "—"}
                />
                {course.validTill ? (
                  <Chip
                    icon={<CalendarDays className="h-3.5 w-3.5" />}
                    text={`Valid till ${course.validTill}`}
                  />
                ) : null}
              </div>
            </div>

            {/* The officer's way in, and the learner's way out: editing sits
                with the course it edits, not adrift at the foot of the page. */}
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {/* This course came back to be sat again after a grade C.
                  Amber, and on the right with the actions rather than among
                  the identifying badges on the left: it is a thing about this
                  attempt that the learner has to act on, not another label for
                  the course. It reads as a warning without being an error —
                  the course is not in trouble, it simply has to be taken
                  again. Shown on the course rather than in the dashboard list,
                  which has room for a number and no room for the reason.

                  Shown on `retakes`, not on the count itself: once the last
                  sitting is finished there are none left, and a badge that
                  disappeared at exactly that point left the learner with no
                  answer to the one question they have — whether they can take
                  it again. It says "0 attempts left" instead, in the same
                  amber: it is the same fact about the same course, and a
                  second colour for the end of it would read as a new state. */}
              {access.retakes > 0 ? (
                <span
                  title={
                    access.attemptsLeft > 0
                      ? "Completed with grade C, so the course was returned to be taken again."
                      : "All attempts for this course have been used, so the grade recorded stands."
                  }
                  className="flex items-center gap-2 rounded bg-[#ffc107] px-4 py-2 text-[12px] font-bold tracking-wide text-[#5a4300] uppercase shadow"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {access.attemptsLeft} attempt
                  {access.attemptsLeft === 1 ? "" : "s"} left
                </span>
              ) : null}
              {feedbackDue ? (
                <Link
                  href={`/course/${encodeId(course.id)}/feedback`}
                  className="rounded bg-white px-4 py-2 text-[12px] font-bold tracking-wide text-[#c2384a] uppercase shadow transition hover:bg-[#dc3545]/10"
                >
                  Feedback Form
                </Link>
              ) : null}
              {canEdit ? (
                <button
                  type="button"
                  onClick={startEditing}
                  disabled={openingEditor}
                  className="flex cursor-pointer items-center gap-2 rounded bg-white px-4 py-2 text-[12px] font-bold tracking-wide text-[#2a6a8f] uppercase shadow transition hover:bg-white/90 disabled:opacity-60"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {openingEditor ? "Opening…" : "Edit"}
                </button>
              ) : null}
              {/* Said, not merely withheld: an officer who finds the button
                  gone should be told the quarter closed it, not left looking
                  for it. */}
              {officerView && quarterClosed ? (
                <span
                  title={`This course's quarter ended on ${course.validTill}. Its details and the departments and grades it is assigned to can no longer be changed.`}
                  className="flex items-center gap-2 rounded bg-white/15 px-4 py-2 text-[12px] font-bold tracking-wide text-white/90 uppercase"
                >
                  <Lock className="h-3.5 w-3.5" />
                  Quarter closed
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex-1 space-y-4 p-4">
            <div>
              <BlockHeading icon={<FileText className="h-3.5 w-3.5" />}>
                Course description
              </BlockHeading>
              {course.description ? (
                <RichText text={course.description} />
              ) : (
                <p className="text-[13px] normal-case leading-relaxed text-gray-500">
                  No description provided for this course.
                </p>
              )}
            </div>

            {course.objectives.length ? (
              <div className="border-t border-gray-200 pt-4">
                <WhatYouLearn objectives={course.objectives} embedded />
              </div>
            ) : null}

            {course.sections.length ? (
              <div className="border-t border-gray-200 pt-4">
                <TopicsCovered topics={course.sections.map((s) => s.name)} />
              </div>
            ) : null}

            {/* "This course includes" is NOT repeated here. It stands once, in
                the player card beside this one, which now carries the whole
                list rather than a trimmed copy of it. */}
          </div>
        </div>

        <div className="flex min-w-0">
          <CoursePreviewCard course={course} active={activeVideo} />
        </div>
      </div>

      {/* Course content carries the same card header as everything else — it
          used to be a bare heading floating above the accordion. */}
      <section className="bg-white rounded shadow border border-gray-200 overflow-hidden text-[12px]">
        <div className="flex items-center justify-between bg-[#3482AE] px-4 py-2">
          <h2 className="flex items-center gap-2 font-bold tracking-wide text-white uppercase">
            <BookOpen className="h-3.5 w-3.5" /> Course content
          </h2>
          <span className="text-[11px] font-semibold text-white/80">
            {course.sections.length} section
            {course.sections.length === 1 ? "" : "s"} · {totalLectures} lecture
            {totalLectures === 1 ? "" : "s"}
          </span>
        </div>
        <div className="p-3">
          {/* A training officer never sits a course — the assignment already
              renders read-only for them, and the content ticks are the same
              kind of record, so opening a lecture here must not count as one
              being completed. */}
          <CourseContent
            emoduleId={course.id}
            sections={course.sections}
            attempt={access.retakes}
            preview={isTrainingOfficer(user)}
            onPlay={setActiveVideo}
          />
        </div>
      </section>

      {/* Only a training officer who came from the officer dashboard's module
          list gets this; learners never see it. */}
      {officerView ? <CourseHistory emoduleId={course.id} /> : null}
    </div>
  );
}
