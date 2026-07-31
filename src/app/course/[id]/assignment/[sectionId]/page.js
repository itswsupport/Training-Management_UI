"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";

import AssignmentForm from "@/components/course/AssignmentForm";
import CourseNotice, { CourseLoading } from "@/components/course/CourseNotice";
import { apiErrorMessage } from "@/config/api";
import { useAuth } from "@/context/AuthContext";
import { getEmpCode, isTrainingOfficer } from "@/lib/permissions";
import {
  getAssignmentQuestions,
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
  const emoduleId = Number(id);
  const sectionId = Number(rawSectionId);

  const router = useRouter();
  const { user } = useAuth();
  const empCode = getEmpCode(user);

  // The assignment is the employee's to sit. A training officer opens it to
  // check the paper, so they get the questions with no way to answer or submit.
  const readOnly = isTrainingOfficer(user);

  const [state, setState] = useState({ status: "loading" });

  /**
   * There is no paper to sit — it is already in, or none was ever set.
   *
   * Nothing to say about either that is worth a screen of its own: the card
   * that used to stand here carried one line and a link back to the course, so
   * the learner is simply put back on the course instead. `replace` rather than
   * `push`, or Back would land them straight back on this redirect.
   */
  const nothingToSit = state.status === "submitted" || state.status === "empty";

  useEffect(() => {
    if (nothingToSit) router.replace(`/course/${emoduleId}`);
  }, [nothingToSit, emoduleId, router]);

  useEffect(() => {
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

        if (submitted) {
          setState({ status: "submitted", sectionName: section.name });
        } else if (questions.length === 0) {
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
          const lectureId = Number(
            new URLSearchParams(window.location.search).get("lectureId")
          );
          const byLecture = groupByLecture(section.lectures ?? [], questions);
          const shown =
            lectureId && byLecture.has(lectureId)
              ? byLecture.get(lectureId)
              : questions;

          setState({
            status: "ready",
            course,
            questions: shown,
            allQuestions: questions,
            lectureNames,
            lectureName: lectureId ? lectureNames[lectureId] : "",
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
  }, [emoduleId, sectionId, empCode]);

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
    />
  );
}
