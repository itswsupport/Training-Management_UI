"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";

import CourseFeedbackForm from "@/components/course/CourseFeedbackForm";
import CourseNotice, { CourseLoading } from "@/components/course/CourseNotice";
import { apiErrorMessage } from "@/config/api";
import { useAuth } from "@/context/AuthContext";
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
  const emoduleId = Number(id);

  const router = useRouter();
  const { user } = useAuth();
  const empCode = getEmpCode(user);

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
    if (nothingToFill) router.replace(`/course/${emoduleId}`);
  }, [nothingToFill, emoduleId, router]);

  useEffect(() => {
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
  }, [emoduleId, empCode]);

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
      courseName={state.course.name}
      questions={state.questions}
    />
  );
}
