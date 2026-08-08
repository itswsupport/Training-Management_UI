/**
 * The signed-in learner's own courses (`/user_module/by_status`).
 *
 * Status is 0 pending, 1 in-process, 2 completed, 3 overdue.
 */

import { api, unwrap } from "@/config/api";
import { financialYearOf, quarterOf } from "@/services/MasterDataService";
import {
  getLatestContentChange,
  getTransactions,
} from "@/services/TransactionService";
import { clean, displayStamp, fullName, stampValue } from "@/utils/etmsFormat";

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
export async function getUserCourses(empCode, status, filter = {}) {
  const params = { empName: empCode, status };
  // Narrowed by the backend when the dashboard asks for a quarter. Deliberately
  // NOT passed by getAssignedStatus below: that asks "is this course theirs at
  // all", and a filtered answer would refuse a course the learner really has.
  if (filter.financialYear) params.financialYear = filter.financialYear;
  if (filter.quarter) params.quarter = filter.quarter;

  const list =
    unwrap(await api.get("/user_module/by_status", { params }), []) ?? [];

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
      // The row carries one stamp, rewritten each time the learner's status
      // moves — so on a completed row it is when they finished. It is empty on
      // a pending row: nothing writes it at assignment (see assignedStamps).
      completedOn: displayStamp(row.regDate, row.regTime),
      completedValue: stampValue(row.regDate, row.regTime),
      // The course's own quarter, carried for the dashboard's year / quarter
      // filters. Read off the module rather than the learner's row — the
      // learner has no quarter, the course they were given does.
      kraQuarter: clean(e.kraQuarter),
      quarter: quarterOf(e.kraQuarter),
      financialYear: financialYearOf(e.kraQuarter),
      empName: fullName(u.employeeFname, u.employeeLname),
    };
  });
}

/**
 * When each of this employee's courses was assigned to them, by module id.
 *
 * The learner's own row cannot answer this. `TrainingEmoduleEmp` holds a single
 * reg_date/reg_time pair which is left unset at assignment and then overwritten
 * every time the learner's status moves, so by the time a course is completed
 * the only stamp on it is the completion. The history log is the one place the
 * assignment itself was recorded — one MODULE_ASSIGNED row per employee per
 * course, written as the module is submitted.
 *
 * One request for the whole dashboard rather than one per course. Newest first
 * and capped at 500 by the backend, so where a course was somehow assigned
 * twice the first hit seen is the most recent, and a learner past 500 history
 * rows loses the oldest — both leave the column empty rather than wrong.
 *
 * @param {string} empCode
 * @returns {Promise<Map<string, {date: string, time: string}>>}
 */
export async function getAssignedStamps(empCode) {
  const byModule = new Map();
  if (!empCode) return byModule;

  const rows = await getTransactions({
    empCode,
    action: "MODULE_ASSIGNED",
  });

  for (const row of rows) {
    if (row.emoduleId == null) continue;
    const key = String(row.emoduleId);
    if (byModule.has(key)) continue;
    byModule.set(key, {
      date: row.whenDate,
      time: row.whenTime,
      value: stampValue(row.atDate, row.atTime),
    });
  }
  return byModule;
}

/**
 * The learner's courses for one status, each carrying when it was assigned.
 *
 * The two reads are independent, so they go together — and a history the
 * backend refuses must not cost the learner their course list, so it degrades
 * to no assignment dates rather than an error.
 *
 * @param {string} empCode
 * @param {number} status one of COURSE_STATUS
 * @param {{financialYear?: string, quarter?: string}} [filter]
 */
export async function getUserCoursesWithStamps(empCode, status, filter = {}) {
  const [courses, assigned] = await Promise.all([
    getUserCourses(empCode, status, filter),
    getAssignedStamps(empCode).catch(() => new Map()),
  ]);

  return courses.map((course) => {
    const stamp = assigned.get(String(course.id));
    return {
      ...course,
      assignedOn: { date: stamp?.date ?? "", time: stamp?.time ?? "" },
      assignedValue: stamp?.value ?? null,
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
