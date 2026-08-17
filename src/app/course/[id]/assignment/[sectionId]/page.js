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
import { DEFAULT_EXAM_TYPE, EXAM_TYPES } from "@/lib/examType";
import {
  getAssignmentQuestions,
  getSubmittedAnswers,
  isPaperSubmitted,
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

/**
 * Which paper this page is for, from `?type=`.
 *
 * The course content links here once per paper. Anything unrecognised falls
 * back to the pre assignment — that is what every link written before the post
 * paper existed meant, and what a hand-typed URL should get.
 */
function paperFromUrl() {
  if (typeof window === "undefined") return DEFAULT_EXAM_TYPE;
  const asked = new URLSearchParams(window.location.search).get("type");
  return asked === EXAM_TYPES.POST ? EXAM_TYPES.POST : DEFAULT_EXAM_TYPE;
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
   */
  const nothingToSit = state.status === "empty";

  useEffect(() => {
    if (!nothingToSit) return;
    // Sending them back to the course counts as the app's own navigation.
    grantCourseAccess(emoduleId);
    router.replace(`/course/${encodeId(emoduleId)}`);
  }, [nothingToSit, emoduleId, router]);

  /*
   * A paper this learner has already sat opens with no announcement at all.
   *
   * It used to raise a dialog naming the paper and repeating that it could not
   * be answered again. The paper itself is already on the screen behind it with
   * every answer filled in and nothing clickable, so the dialog interrupted the
   * learner to tell them what they were looking at — and it fired on a plain
   * "view", which is not an action that warrants being stopped.
   *
   * This also gave up the one thing the page cannot show inline: the score.
   * Which answers were right is deliberately never sent to the browser, so the
   * marks were all there was to report and the alert was the only place they
   * appeared.
   */

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

        // Which paper was asked for. Everything below is scoped to it: the
        // questions loaded, whether it has been sat, and what each answer is
        // saved as — without that the post paper opened as the pre one.
        const examType = paperFromUrl();

        const [answered, questions] = await Promise.all([
          getSubmittedAnswers(emoduleId, sectionId, empCode),
          getAssignmentQuestions(emoduleId, sectionId, examType),
        ]);
        if (cancelled) return;

        // Per paper, not per section: `/submit_exam/by_sectionid` cannot tell
        // the two apart, but a question id belongs to exactly one of them.
        const submitted = isPaperSubmitted(questions, answered);

        if (questions.length === 0) {
          setState({ status: "empty" });
        } else {
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

          setState({
            status: "ready",
            course,
            examType,
            questions: shown,
            allQuestions: questions,
            submitted,
            // What this learner picked, so a paper already sat comes back with
            // its own answers marked rather than as a blank form. Only the
            // answer travels — nothing here says which option was correct.
            savedAnswers: Object.fromEntries(
              Object.entries(answered).map(([id, given]) => [id, given.answer])
            ),
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
  }, [emoduleId, sectionId, empCode, access.allowed, readOnly]);

  // The spinner covers the redirect too — a blank frame for the moment the
  // route takes to change reads as a page that failed to load.
  if (state.status === "loading" || nothingToSit) {
    return <CourseLoading />;
  }

  // The course's quarter has not started, so nothing in it opens yet. Reachable
  // only through a grant left over from an earlier visit — the course page
  // itself already refuses — but the paper must refuse on its own terms rather
  // than rely on that.
  if (access.locked) {
    return (
      <CourseNotice title="Course not open yet">
        This course is scheduled for a quarter that has not started yet, so its
        assignment cannot be opened.
        {access.unlocksOn ? ` It opens on ${access.unlocksOn}.` : ""}
      </CourseNotice>
    );
  }

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
      examType={state.examType}
      questions={state.questions}
      allQuestions={state.allQuestions}
      readOnly={readOnly}
      submitted={state.submitted}
      savedAnswers={state.savedAnswers}
      overdue={access.overdue}
      attempt={access.retakes}
    />
  );
}
