/**
 * The signed-in learner's own courses (`/user_module/by_status`).
 *
 * Status is 0 pending, 1 in-process, 2 completed, 3 overdue.
 */

import { api, unwrap } from "@/config/api";
import { getLatestContentChange } from "@/services/TransactionService";
import { clean, fullName, stampValue } from "@/utils/etmsFormat";

export const COURSE_STATUS = {
  PENDING: 0,
  IN_PROCESS: 1,
  COMPLETED: 2,
  OVERDUE: 3,
};

/**
 * @param {string} empCode
 * @param {number} status one of COURSE_STATUS
 * @returns {Promise<Array>} rows in the shared ModuleRow shape, plus the
 *   grade / registration date / employee name the Completed view needs.
 */
export async function getUserCourses(empCode, status) {
  const list =
    unwrap(
      await api.get("/user_module/by_status", {
        params: { empName: empCode, status },
      }),
      []
    ) ?? [];

  return list.map((row, index) => {
    const e = row.trainingEmodule ?? {};
    const u = row.user ?? {};
    return {
      id: row.moduleId ?? index,
      no: clean(e.emoduleId),
      name: clean(e.emoduleName),
      category: clean(e.trainingCategory1?.categoryName),
      instructor: clean(e.emoduleAuthor),
      description: clean(e.emoduleLongDesc),
      status: row.status ?? status,
      grade: clean(row.grade) || "-",
      regDate: clean(row.regDate),
      regTime: clean(row.regTime),
      empName: fullName(u.employeeFname, u.employeeLname),
    };
  });
}

/**
 * Which of the learner's own lists this course sits in, or null if none.
 *
 * The course routes take the module id from the URL, and nothing about
 * `/emodule` binds a module to an employee — it will happily return any course
 * to anyone who asks for it. Without this check a learner who edits the id in
 * the address bar reads a course that was never assigned to them. Obfuscating
 * the id in the URL does not help: it only makes the ids harder to guess, and a
 * guess that lands still opens the course.
 *
 * The status matters beyond yes/no: an overdue course is still the learner's to
 * read, but its quarter has lapsed, so nothing may be submitted against it.
 *
 * A learner's course sits in exactly one status, so all four are asked at once
 * and the first hit wins.
 *
 * @param {string} empCode
 * @param {number|string} moduleId
 * @returns {Promise<number|null>} one of COURSE_STATUS, or null if not theirs
 */
export async function getAssignedStatus(empCode, moduleId) {
  if (!empCode || !Number.isFinite(Number(moduleId))) return null;

  const statuses = Object.values(COURSE_STATUS);
  const lists = await Promise.all(
    statuses.map((status) =>
      // One unreachable status must not deny a course the others would allow.
      getUserCourses(empCode, status).catch(() => [])
    )
  );

  const hit = lists.findIndex((list) =>
    list.some((c) => String(c.id) === String(moduleId))
  );
  return hit === -1 ? null : statuses[hit];
}

/**
 * Is this course one of the learner's own? Overdue counts — the course is still
 * theirs to open, it just cannot be submitted against.
 *
 * @param {string} empCode
 * @param {number|string} moduleId
 * @returns {Promise<boolean>}
 */
export async function isCourseAssigned(empCode, moduleId) {
  return (await getAssignedStatus(empCode, moduleId)) !== null;
}

/**
 * The learner's record for one completed course — the authoritative source for
 * a certificate's name / course / date / grade.
 *
 * @param {string} empCode
 * @param {number|string} moduleId
 */
export async function getCompletedCourse(empCode, moduleId) {
  const completed = await getUserCourses(empCode, COURSE_STATUS.COMPLETED);
  return completed.find((c) => String(c.id) === String(moduleId)) ?? null;
}

/**
 * Content the training officer added to a course *after* this learner finished
 * it — a lecture appended to a section, a new section, a new question.
 *
 * A completed course otherwise looks finished forever: the learner has their
 * certificate and no reason to open it again, so new material would sit there
 * unseen. Null when the course is not completed by this learner, or when
 * nothing has changed since they completed it.
 *
 * @param {string} empCode
 * @param {number|string} moduleId
 * @returns {Promise<{when: string, description: string}|null>}
 */
export async function getUpdateSinceCompletion(empCode, moduleId) {
  if (!empCode || !moduleId) return null;

  const completed = await getCompletedCourse(empCode, moduleId);
  if (!completed) return null;

  const change = await getLatestContentChange(moduleId);
  if (!change) return null;

  const completedAt = stampValue(completed.regDate, completed.regTime);
  const changedAt = stampValue(change.atDate, change.atTime);
  // An unreadable stamp on either side means we cannot honestly say the course
  // changed after they finished — say nothing rather than cry wolf.
  if (completedAt == null || changedAt == null || changedAt <= completedAt) {
    return null;
  }

  return { when: change.when, description: change.description };
}
