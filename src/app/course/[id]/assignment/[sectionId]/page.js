"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";

import AssignmentForm from "@/components/course/AssignmentForm";
import CourseNotice, { CourseLoading } from "@/components/course/CourseNotice";
import { apiErrorMessage } from "@/config/api";
import { useAuth } from "@/context/AuthContext";
import { useCourseAccess } from "@/hooks/useCourseAccess";
import { decodeId, encodeId } from "@/lib/courseId";
import { grantCourseAccess } from "@/lib/courseGrant";
import { getEmpCode, isTrainingOfficer } from "@/lib/permissions";
import {
  getAssignmentQuestions,
  getSubmittedAnswers,
  isAssignmentSubmitted,
} from "@/services/AssignmentService";
import { getCourseDetail } from "@/services/ModuleService";

/**
 * Which lecture each question belongs to — the same rule the officer's editor
 * and the course content list use, so a learner sees a lecture's questions
 * wherever they open them. Questions with no lecture of their own are spread
 * across the lectures in order.
 */
function groupByLecture(lectures, questions) {
  const byLecture = new Map(lectures.map((l) => [l.id, []]));
  const unassigned = questions.filter((q) => !q.lectureId);

  questions.forEach((question) => {
    let lectureId = question.lectureId;
    if (!lectureId) {
      const position = unassigned.indexOf(question);
      lectureId = (lectures[position] ?? lectures[lectures.length - 1])?.id;
    }
    if (byLecture.has(lectureId)) byLecture.get(lectureId).push(question);
  });

  return byLecture;
}

export default function AssignmentPage({ params }) {
  const { id, sectionId: rawSectionId } = use(params);
  const emoduleId = decodeId(id);
  const sectionId = decodeId(rawSectionId);

  const router = useRouter();
  const { user } = useAuth();
  const empCode = getEmpCode(user);

  // Guards the ids in the URL, which are otherwise anybody's to change.
  const access = useCourseAccess(emoduleId);

  // The assignment is the employee's to sit. A training officer opens it to
  // check the paper, so they get the questions with no way to answer or submit.
  const readOnly = isTrainingOfficer(user);

  const [state, setState] = useState({ status: "loading" });

  /**
   * No paper was ever set for this section.
   *
   * Nothing to say about that worth a screen of its own — the card that used to
   * stand here carried one line and a link back — so the learner is simply put
   * back on the course. `replace` rather than `push`, or Back would land them
   * straight back on this redirect.
   *
   * An assignment already submitted no longer comes here: it used to be sent
   * back the same way, which left a learner with no way to look at what they
   * had answered. It now renders read-only with their own answers filled in.
   */
  const nothingToSit = state.status === "empty";

  useEffect(() => {
    if (!nothingToSit) return;
    // Sending them back to the course counts as the app's own navigation.
    grantCourseAccess(emoduleId);
    router.replace(`/course/${encodeId(emoduleId)}`);
  }, [nothingToSit, emoduleId, router]);

  useEffect(() => {
    if (!Number.isFinite(emoduleId) || !Number.isFinite(sectionId)) {
      setState({
        status: "error",
        message: "This assignment could not be opened.",
      });
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
        const course = await getCourseDetail(emoduleId);
        if (cancelled) return;
        if (!course) {
          setState({ status: "error", message: "This course could not be found." });
          return;
        }

        const section = course.sections.find((s) => s.id === sectionId);
        if (!section) {
          setState({
            status: "error",
            message: "This section is not part of the course.",
          });
          return;
        }

        const [submitted, questions] = await Promise.all([
          isAssignmentSubmitted(emoduleId, sectionId, empCode),
          getAssignmentQuestions(emoduleId, sectionId),
        ]);
        if (cancelled) return;

        if (questions.length === 0) {
          setState({ status: "empty" });
        } else {
          // The section's lectures, so each question can say which one it is
          // about. Names only — the ids are what the questions carry.
          const lectureNames = {};
          (section.lectures ?? []).forEach((l) => {
            lectureNames[l.id] = l.name;
          });

          // Course content links here per lecture. Answers are saved question
          // by question either way; only the questions shown are narrowed.
          const lectureId = decodeId(
            new URLSearchParams(window.location.search).get("lectureId")
          );
          const byLecture = groupByLecture(section.lectures ?? [], questions);
          const shown =
            lectureId && byLecture.has(lectureId)
              ? byLecture.get(lectureId)
              : questions;

          // Only worth asking for once the paper is known to be in — an
          // assignment still being sat has nothing to read back.
          const answered = submitted
            ? await getSubmittedAnswers(emoduleId, sectionId, empCode)
            : null;
          if (cancelled) return;

          setState({
            status: "ready",
            course,
            questions: shown,
            allQuestions: questions,
            lectureNames,
            lectureName: lectureId ? lectureNames[lectureId] : "",
            submitted,
            answered,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            message: apiErrorMessage(
              err,
              "Something went wrong loading this assignment."
            ),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [emoduleId, sectionId, empCode, access.allowed]);

  // The spinner covers the redirect too — a blank frame for the moment the
  // route takes to change reads as a page that failed to load.
  if (state.status === "loading" || nothingToSit) return <CourseLoading />;

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
    <AssignmentForm
      emoduleId={emoduleId}
      sectionId={sectionId}
      empCode={empCode}
      courseName={state.course.name}
      questions={state.questions}
      allQuestions={state.allQuestions}
      lectureNames={state.lectureNames}
      lectureName={state.lectureName}
      readOnly={readOnly}
      submitted={state.submitted}
      overdue={access.overdue}
      initialAnswers={state.answered}
    />
  );
}
