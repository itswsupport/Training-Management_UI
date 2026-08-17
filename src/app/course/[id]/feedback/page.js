"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";

import CourseFeedbackForm from "@/components/course/CourseFeedbackForm";
import CourseNotice, { CourseLoading } from "@/components/course/CourseNotice";
import { apiErrorMessage } from "@/config/api";
import { useAuth } from "@/context/AuthContext";
import { useCourseAccess } from "@/hooks/useCourseAccess";
import { decodeId, encodeId } from "@/lib/courseId";
import { grantCourseAccess } from "@/lib/courseGrant";
import { getEmpCode } from "@/lib/permissions";
import { getFeedbackQuestions, isFeedbackDue } from "@/services/FeedbackService";
import { getCourseDetail } from "@/services/ModuleService";

/**
 * The learner's course feedback form. Submitting it is what moves the course to
 * Completed and assigns the grade — the assignment alone only moves it to
 * In Process.
 */
export default function CourseFeedbackPage({ params }) {
  const { id } = use(params);
  const emoduleId = decodeId(id);

  const router = useRouter();
  const { user } = useAuth();
  const empCode = getEmpCode(user);

  // Guards the id in the URL, which is otherwise anybody's to change.
  const access = useCourseAccess(emoduleId);

  const [state, setState] = useState({ status: "loading" });

  /**
   * There is no form to fill in — it is not pending, or none was set up.
   *
   * Neither is worth a screen of its own, so the learner goes back to the
   * course. `replace` rather than `push`, or Back would land them straight
   * back on this redirect.
   */
  const nothingToFill = state.status === "notDue" || state.status === "empty";

  useEffect(() => {
    // An overdue course keeps its own notice below rather than being bounced
    // back to the course with nothing said.
    if (!nothingToFill || access.overdue) return;
    // Sending them back to the course counts as the app's own navigation.
    grantCourseAccess(emoduleId);
    router.replace(`/course/${encodeId(emoduleId)}`);
  }, [nothingToFill, access.overdue, emoduleId, router]);

  useEffect(() => {
    if (!Number.isFinite(emoduleId)) {
      setState({ status: "error", message: "This course could not be found." });
      return undefined;
    }
    // Nothing is fetched until the course is known to be this user's. A refused
    // course stays on "loading" — the hook is already sending it away, and a
    // message here would only announce what it declined to say.
    if (!access.allowed) return undefined;
    if (!empCode) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const [course, questions, due] = await Promise.all([
          getCourseDetail(emoduleId),
          getFeedbackQuestions(),
          isFeedbackDue(empCode, emoduleId),
        ]);
        if (cancelled) return;

        if (!course) {
          setState({ status: "error", message: "This course could not be found." });
          return;
        }
        // /feedback/save is not idempotent — a second submit recalculates the
        // grade and writes another set of feedback rows. The form is only
        // reachable while the feedback is actually outstanding.
        if (!due) {
          setState({ status: "notDue", courseName: course.name });
          return;
        }
        if (questions.length === 0) {
          setState({ status: "empty" });
          return;
        }
        setState({ status: "ready", course, questions });
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            message: apiErrorMessage(
              err,
              "Something went wrong loading the feedback form."
            ),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [emoduleId, empCode, access.allowed]);

  // Covers the ACCESS DENIED alert as well as the access lookup: neither may
  // show any of the page behind it.
  if (access.checking) return <CourseLoading />;

  // Submitting feedback is what completes a course and records the grade, so an
  // overdue course cannot be given any. There is no read-only version worth
  // showing — the form exists only to be submitted.
  // Nothing to give feedback on yet — the course has not opened.
  if (access.locked) {
    return (
      <CourseNotice title="Course not open yet">
        This course is scheduled for a quarter that has not started yet.
        {access.unlocksOn ? ` It opens on ${access.unlocksOn}.` : ""}
      </CourseNotice>
    );
  }

  if (access.overdue) {
    return (
      <CourseNotice tone="error" emoduleId={emoduleId} title="Course overdue">
        This course is overdue and its quarter has closed, so feedback can no
        longer be submitted. Please speak to your training officer.
      </CourseNotice>
    );
  }

  // The spinner covers the redirect too — a blank frame for the moment the
  // route takes to change reads as a page that failed to load.
  if (state.status === "loading" || nothingToFill) return <CourseLoading />;

  // A failure is the one case still worth a card: the reason has to be
  // readable, and there is nowhere better to put it.
  if (state.status === "error") {
    return (
      <CourseNotice tone="error" emoduleId={emoduleId}>
        {state.message}
      </CourseNotice>
    );
  }

  return (
    <CourseFeedbackForm
      emoduleId={emoduleId}
      empCode={empCode}
      questions={state.questions}
    />
  );
}
