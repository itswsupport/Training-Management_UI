"use client";

import { use, useCallback, useEffect, useState } from "react";

import CourseNotice, { CourseLoading } from "@/components/course/CourseNotice";
import { MaterialBody } from "@/components/course/MaterialViewer";
import { apiErrorMessage } from "@/config/api";
import { useAuth } from "@/context/AuthContext";
import { useCourseAccess } from "@/hooks/useCourseAccess";
import { decodeId } from "@/lib/courseId";
import { getEmpCode } from "@/lib/permissions";
import { materialTick, writeWatched } from "@/lib/watchedTicks";
import { getCourseDetail, materialUrl } from "@/services/ModuleService";
import { MATERIAL_KINDS } from "@/services/ProgressService";
import { fileName } from "@/utils/etmsFormat";

/**
 * One lecture's PDF, read in a tab of its own — what the reader's OPEN IN NEW
 * TAB opens.
 *
 * The button used to point at the file itself. A browser tab showing a bare PDF
 * runs none of our code, so nothing counted: a learner could read every page
 * there and earn no credit, and the viewer they left behind stopped counting
 * the moment its tab went to the back. This page puts the same reader in the
 * tab instead — the "3 of 12 pages read" count, the five seconds a page has to
 * be on screen, the tick and the time reported all behave exactly as they do in
 * the viewer on the course page. The video's twin is ../../watch.
 */
export default function ReadLecturePage({ params }) {
  const { id, lectureId: rawLectureId } = use(params);
  const emoduleId = decodeId(id);
  const lectureId = decodeId(rawLectureId);

  const { user, loading: authLoading } = useAuth();
  const empCode = getEmpCode(user);

  // Guards the ids in the URL, which are otherwise anybody's to change.
  const access = useCourseAccess(emoduleId);

  // The same two cases the course page reads-but-does-not-record: an officer
  // checking the module over, and a course whose quarter has closed.
  const preview = access.preview;
  const untracked = preview || access.overdue;

  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    if (authLoading) return undefined;
    if (!empCode || !Number.isFinite(emoduleId) || !Number.isFinite(lectureId)) {
      setState({ status: "error", message: "This material could not be opened." });
      return undefined;
    }
    // Nothing is fetched until the course is known to be this user's.
    if (!access.allowed) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const course = await getCourseDetail(emoduleId);
        if (cancelled) return;
        if (!course) {
          setState({ status: "error", message: "This course could not be found." });
          return;
        }

        // Found from the course rather than trusted from the URL, so a made-up
        // id yields nothing to read.
        let found = null;
        for (const section of course.sections) {
          const lecture = section.lectures.find((l) => l.id === lectureId);
          if (lecture) {
            found = { section, lecture };
            break;
          }
        }
        if (!found) {
          setState({
            status: "error",
            message: "This lecture is not part of the course.",
          });
          return;
        }

        const { section, lecture } = found;
        const path = String(lecture.materialFile ?? "").trim();
        // Case-sensitive, as the course page's own test is: `/trainingMaterial/
        // file` serves anything else as an attachment, however much of a PDF it
        // is. See viewerFor in CourseContent.
        if (!path.endsWith(".pdf")) {
          setState({
            status: "error",
            message: "This lecture has no PDF to read.",
          });
          return;
        }

        setState({
          status: "ready",
          courseName: course.name,
          lectureName: lecture.name,
          sectionId: section.id,
          name: fileName(path),
          url: materialUrl(path, emoduleId),
        });
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            message: apiErrorMessage(err, "Something went wrong loading this material."),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [emoduleId, lectureId, empCode, authLoading, access.allowed]);

  const ready = state.status === "ready";

  // Stable for the life of the page, so the reader's clock is never restarted
  // by it and the pages already counted are not lost.
  const onRead = useCallback(() => {
    if (untracked || !ready) return;
    writeWatched(empCode, emoduleId, access.retakes, [
      materialTick(state.sectionId, lectureId, "file"),
    ]);
  }, [untracked, ready, empCode, emoduleId, access.retakes, state.sectionId, lectureId]);

  // What the time spent is reported against. Null for an officer, who records
  // nothing, and until the lecture is known — the course page's viewer draws the
  // same line.
  const material =
    ready && !preview
      ? {
          empCode,
          emoduleId,
          sectionId: state.sectionId,
          lectureId,
          kind: MATERIAL_KINDS.FILE,
        }
      : null;

  useEffect(() => {
    if (ready) document.title = `${state.lectureName} — ${state.courseName}`;
  }, [ready, state.lectureName, state.courseName]);

  if (authLoading || state.status === "loading") return <CourseLoading />;

  if (access.locked) {
    return (
      <CourseNotice title="Course not open yet">
        This course is scheduled for a quarter that has not started yet, so its
        material cannot be read.
        {access.unlocksOn ? ` It opens on ${access.unlocksOn}.` : ""}
      </CourseNotice>
    );
  }

  if (state.status === "error") {
    return (
      <CourseNotice tone="error" emoduleId={emoduleId}>
        {state.message}
      </CourseNotice>
    );
  }

  return (
    <div className="bg-white rounded shadow border border-gray-200 overflow-hidden text-[12px]">
      {/* No link back to the course here: the layout's BACK takes a fresh tab
          there already, and two buttons for one way out was one too many. */}
      <div className="bg-[#3482AE] px-4 py-2">
        <h2 className="min-w-0 truncate font-bold tracking-wide text-white uppercase">
          {state.lectureName || "Lecture"}
        </h2>
      </div>

      <p className="m-2 bg-[#cfe4f2] px-3 py-2 font-bold tracking-wide text-[#2f6685] uppercase">
        Course Name : {state.courseName}
      </p>

      {preview ? (
        <p className="mx-2 mb-2 rounded border border-[#ffc107] bg-[#ffc107]/10 px-3 py-2.5 text-[12px] normal-case text-[#a17200]">
          Preview only. Nothing read here is recorded against a module you are
          checking over.
        </p>
      ) : null}

      {/* The reader fills a flex column and pins its read count to the corner,
          so it is given a positioned column of its own — tall enough to read a
          page in, short enough that the page itself never has to scroll. */}
      <div className="relative mx-2 mb-2 flex h-[calc(100vh-16rem)] min-h-[420px] flex-col overflow-hidden rounded border border-gray-200">
        <MaterialBody
          kind="pdf"
          name={state.name}
          url={state.url}
          onRead={untracked ? undefined : onRead}
          material={material}
        />
      </div>
    </div>
  );
}
