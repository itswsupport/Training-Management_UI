"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";

import CourseNotice, { CourseLoading } from "@/components/course/CourseNotice";
import {
  TrackedVideo,
  TrackedYouTube,
} from "@/components/course/CoursePreviewCard";
import { apiErrorMessage } from "@/config/api";
import { useAuth } from "@/context/AuthContext";
import { useCourseAccess } from "@/hooks/useCourseAccess";
import { decodeId, encodeId } from "@/lib/courseId";
import { getEmpCode, isTrainingOfficer } from "@/lib/permissions";
import { isFileVideoUrl, youTubeId } from "@/lib/video";
import { materialUrl } from "@/services/ModuleService";
import { getCourseDetail } from "@/services/ModuleService";
import { MATERIAL_KINDS } from "@/services/ProgressService";

/**
 * One lecture video, played in a tab of its own — what OPEN IN NEW TAB opens.
 *
 * The button used to point at the video file itself. A browser tab showing a
 * bare .mp4 runs none of our code, so nothing counted: a learner could watch a
 * whole lecture there and earn no credit, and the assignment stayed locked with
 * no explanation. Opening this page instead keeps the tab, and puts the same
 * tracked player in it — the 90% rule, the watched badge and the heartbeats all
 * behave exactly as they do in the card on the course page.
 *
 * A link we cannot play at all (a Drive or Vimeo page) never reaches here; the
 * card still hands those straight to the browser, because there is nothing on
 * the other side of them that could report back.
 */

/** Where the course page keeps a learner's ticks — matched exactly. */
const watchedStorageKey = (empCode, emoduleId) =>
  `etms:watched:${empCode || "anon"}:${emoduleId}`;

/**
 * Writes the same tick `CourseContent` writes, so finishing a lecture in this
 * tab shows as done when the learner returns to the course. Storage is shared
 * across tabs of one origin, so nothing has to be passed back.
 */
function markWatched(empCode, emoduleId, sectionId, lectureId, kind) {
  if (typeof window === "undefined") return;
  const key = watchedStorageKey(empCode, emoduleId);
  // `${sectionId}:${lectureId}::${materialId}` — the shape CourseContent builds
  // whenever the backend gave both rows an id, which is every modern lecture.
  const entry = `${sectionId}:${lectureId}::${kind}`;
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    const list = new Set(Array.isArray(parsed) ? parsed : []);
    if (list.has(entry)) return;
    list.add(entry);
    window.localStorage.setItem(key, JSON.stringify([...list]));
  } catch {
    // A full or blocked storage quota must not break playback.
  }
}

export default function WatchLecturePage({ params }) {
  const { id, lectureId: rawLectureId } = use(params);
  const emoduleId = decodeId(id);
  const lectureId = decodeId(rawLectureId);

  const { user, loading: authLoading } = useAuth();
  const empCode = getEmpCode(user);
  // An officer is checking the material, not working through it, so nothing
  // they play here is recorded — the same rule the course page applies.
  const preview = isTrainingOfficer(user);

  // Guards the ids in the URL, which are otherwise anybody's to change.
  const access = useCourseAccess(emoduleId);

  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    if (authLoading) return undefined;
    if (!empCode || !Number.isFinite(emoduleId) || !Number.isFinite(lectureId)) {
      setState({ status: "error", message: "This lecture could not be opened." });
      return undefined;
    }
    // Nothing is fetched until the course is known to be this user's. A refused
    // course stays on "loading" — the hook is already sending it away, and a
    // message here would only announce what it declined to say.
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

        // The lecture is found from the course rather than trusted from the
        // URL, so a made-up id yields nothing to play.
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
        // Video first, the same order the course content list offers them in.
        const url = lecture.materialVideo
          ? materialUrl(lecture.materialVideo, emoduleId)
          : lecture.link || null;
        const uploaded = Boolean(lecture.materialVideo);

        if (!url) {
          setState({
            status: "error",
            message: "This lecture has no video to play.",
          });
          return;
        }

        setState({
          status: "ready",
          courseName: course.name,
          lectureName: lecture.name,
          sectionId: section.id,
          url,
          uploaded,
        });
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            message: apiErrorMessage(err, "Something went wrong loading this lecture."),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [emoduleId, lectureId, empCode, authLoading, access.allowed]);

  const ready = state.status === "ready";
  const videoId = ready && !state.uploaded ? youTubeId(state.url) : null;
  const fileVideo = Boolean(
    ready && (state.uploaded || isFileVideoUrl(state.url))
  );
  const kind = state.uploaded ? MATERIAL_KINDS.VIDEO : MATERIAL_KINDS.LINK;

  // Stable for the life of the page, so noting it inside the player's effect
  // cannot rebuild the player and drop the seconds already watched.
  const onWatched = useCallback(() => {
    if (preview || !ready) return;
    markWatched(empCode, emoduleId, state.sectionId, lectureId, kind);
  }, [preview, ready, empCode, emoduleId, state.sectionId, lectureId, kind]);

  // What the heartbeats are reported against. Null for an officer, who records
  // nothing, and until the lecture is known.
  const material =
    ready && !preview
      ? { empCode, emoduleId, sectionId: state.sectionId, lectureId, kind }
      : null;

  useEffect(() => {
    if (ready) document.title = `${state.lectureName} — ${state.courseName}`;
  }, [ready, state.lectureName, state.courseName]);

  if (authLoading || state.status === "loading") return <CourseLoading />;

  // The course's quarter has not started, so its lectures are not open yet.
  // The course page already refuses; this refuses on its own terms so a grant
  // left over from an earlier visit cannot walk straight into a lecture.
  if (access.locked) {
    return (
      <CourseNotice title="Course not open yet">
        This course is scheduled for a quarter that has not started yet, so its
        lectures cannot be watched.
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
      <div className="flex items-center justify-between bg-[#3482AE] px-4 py-2">
        <h2 className="min-w-0 truncate font-bold tracking-wide text-white uppercase">
          {state.lectureName || "Lecture"}
        </h2>
        <Link
          href={`/course/${encodeId(emoduleId)}`}
          className="flex shrink-0 items-center gap-1 rounded bg-white/15 px-2.5 py-1 text-[11px] font-bold tracking-wide text-white uppercase transition hover:bg-white/25"
        >
          <ChevronLeft className="h-3 w-3" /> Course
        </Link>
      </div>

      <p className="m-2 bg-[#cfe4f2] px-3 py-2 font-bold tracking-wide text-[#2f6685] uppercase">
        Course Name : {state.courseName}
      </p>

      {/* The same 16:9 stage the card uses, given the width of the tab. */}
      <div className="relative mx-2 mb-2 aspect-video w-[calc(100%-1rem)] bg-gray-900">
        {fileVideo ? (
          <TrackedVideo
            key={state.url}
            src={state.url}
            onWatched={preview ? undefined : onWatched}
            material={material}
          />
        ) : videoId ? (
          <TrackedYouTube
            key={videoId}
            videoId={videoId}
            title={state.lectureName}
            onWatched={preview ? undefined : onWatched}
            material={material}
          />
        ) : null}
      </div>

      {preview ? (
        <p className="mx-2 mb-3 rounded border border-[#ffc107] bg-[#ffc107]/10 px-3 py-2.5 text-[12px] normal-case text-[#a17200]">
          Preview only. Progress is not recorded for a training officer.
        </p>
      ) : (
        <p className="mx-2 mb-3 rounded border border-[#3482AE]/30 bg-[#eaf3f9] px-3 py-2.5 text-[12px] normal-case text-[#2f6685]">
          About {Math.round(0.9 * 100)}% of this video has to be played before it
          counts. Time is only counted while it is actually playing, and playback
          faster than 1.25&times; earns nothing.
        </p>
      )}
    </div>
  );
}
