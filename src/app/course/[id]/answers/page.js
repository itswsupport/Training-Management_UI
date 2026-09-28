"use client";

import { use, useEffect, useState } from "react";

import AssignmentForm from "@/components/course/AssignmentForm";
import CourseNotice, { CourseLoading } from "@/components/course/CourseNotice";
import { apiErrorMessage } from "@/config/api";
import { useAuth } from "@/context/AuthContext";
import { useCourseAccess } from "@/hooks/useCourseAccess";
import { decodeId } from "@/lib/courseId";
import { EXAM_TYPE_LIST } from "@/lib/examType";
import { getEmpCode } from "@/lib/permissions";
import {
  getAssignmentQuestions,
  getSubmittedAnswers,
} from "@/services/AssignmentService";
import { getCourseDetail } from "@/services/ModuleService";
import { getCompletedCourse } from "@/services/UserCourseService";

/**
 * Every paper of one completed course, marked — what ANSWERS on the Completed
 * list opens.
 *
 * Pre and post, section by section, each with the learner's picks called out
 * right or wrong, the right option shown where they missed it, and the paper's
 * total in its header.
 *
 * Completed courses only. A course in COMPLETED is finished for good: the
 * backend hands a grade C with sittings left straight back to PENDING and
 * deletes that attempt, so it never reaches this list while it can still be
 * sat. Anything else — pending, in process, overdue, a retake under way — is
 * refused here rather than shown with its key.
 */
export default function CourseAnswersPage({ params }) {
  const { id } = use(params);
  const emoduleId = decodeId(id);

  const { user } = useAuth();
  const empCode = getEmpCode(user);
  const access = useCourseAccess(emoduleId);

  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    if (!Number.isFinite(emoduleId)) return undefined;
    // Nothing is fetched — the key least of all — until the course is known to
    // be this learner's and finished.
    if (access.checking || !access.allowed || !access.completed) return undefined;
    if (!empCode) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const [course, record] = await Promise.all([
          getCourseDetail(emoduleId),
          getCompletedCourse(empCode, emoduleId),
        ]);
        if (cancelled) return;
        if (!course) {
          setState({ status: "error", message: "This course could not be found." });
          return;
        }

        const sections = course.sections.filter((s) => s.id);
        const perSection = await Promise.all(
          sections.map(async (section) => {
            const [answered, ...papers] = await Promise.all([
              getSubmittedAnswers(emoduleId, section.id, empCode),
              ...EXAM_TYPE_LIST.map((paper) =>
                getAssignmentQuestions(emoduleId, section.id, paper.value, {
                  withAnswerKey: true,
                })
              ),
            ]);
            return EXAM_TYPE_LIST.map((paper, i) => ({
              section,
              examType: paper.value,
              questions: papers[i],
              answered,
            }))
              // A paper that was never set has nothing to show.
              .filter((p) => p.questions.length > 0)
              .map((p) => ({
                ...p,
                answerKey: Object.fromEntries(
                  p.questions
                    .filter((q) => q.answer)
                    .map((q) => [q.id, String(q.answer)])
                ),
                savedAnswers: Object.fromEntries(
                  Object.entries(p.answered).map(([qid, given]) => [qid, given.answer])
                ),
              }));
          })
        );
        if (cancelled) return;

        setState({
          status: "ready",
          course,
          grade: record?.grade || "-",
          papers: perSection.flat(),
          multiSection: sections.length > 1,
        });
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            message: apiErrorMessage(err, "Something went wrong loading your answers."),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [emoduleId, empCode, access.checking, access.allowed, access.completed]);

  if (!Number.isFinite(emoduleId)) {
    return (
      <CourseNotice tone="error">This course could not be opened.</CourseNotice>
    );
  }

  if (access.checking) return <CourseLoading />;

  // Theirs, but not finished for good — a course still to be sat, or one
  // handed back after a grade C. Its answers stay hidden until it is completed.
  if (!access.completed) {
    return (
      <CourseNotice emoduleId={emoduleId} title="Answers not available yet">
        Your answers with the correct options can be viewed once this course is
        completed. A course returned after grade C shows them after your final
        attempt.
      </CourseNotice>
    );
  }

  if (state.status === "loading") return <CourseLoading />;

  if (state.status === "error") {
    return (
      <CourseNotice tone="error" emoduleId={emoduleId}>
        {state.message}
      </CourseNotice>
    );
  }

  return (
    <div className="space-y-4">
      {/* Which course, and the grade it was completed with. */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-gray-200 bg-white px-4 py-3 shadow text-[12px]">
        <div>
          <p className="font-bold uppercase text-[#3482AE]">{state.course.name}</p>
          <p className="mt-0.5 normal-case text-gray-500">
            Your submitted answers. Correct options are marked in green, wrong
            choices in red.
          </p>
        </div>
        <span className="rounded bg-[#20c997] px-3 py-1 text-[12px] font-bold tracking-wide text-white">
          GRADE {state.grade}
        </span>
      </div>

      {state.papers.length === 0 ? (
        <CourseNotice emoduleId={emoduleId} title="No assignments">
          This course had no assignment to answer.
        </CourseNotice>
      ) : (
        state.papers.map((paper) => (
          <div key={`${paper.section.id}-${paper.examType}`}>
            {state.multiSection ? (
              <p className="mb-1 px-1 text-[12px] font-bold uppercase text-gray-600">
                {paper.section.name}
              </p>
            ) : null}
            <AssignmentForm
              emoduleId={emoduleId}
              sectionId={paper.section.id}
              empCode={empCode}
              examType={paper.examType}
              questions={paper.questions}
              allQuestions={paper.questions}
              // Always shown as handed in: the course is complete, so nothing
              // here can be answered, whatever one stray paper's flags say.
              submitted
              savedAnswers={paper.savedAnswers}
              answerKey={paper.answerKey}
            />
          </div>
        ))
      )}
    </div>
  );
}
