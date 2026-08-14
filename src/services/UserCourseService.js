/**
 * The signed-in learner's own courses (`/user_module/by_status`).
 *
 * Status is 0 pending, 1 in-process, 2 completed, 3 overdue.
 */

import { api, unwrap } from "@/config/api";
import { financialYearOf, quarterOf } from "@/services/MasterDataService";
import { getCourseDetail } from "@/services/ModuleService";
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
 * How many times a course is handed back after a grade C, and so how many
 * sittings a learner gets in all: the first one plus these.
 *
 * Mirrors MAX_RETAKES in the backend's EmoduleServiceImpl, which is what
 * actually enforces it — this side only says what the number means. The count
 * of hand-backs already used arrives on the row as `retakeCount`.
 */
export const MAX_RETAKES = 2;

/**
 * Sittings this learner still has at a course.
 *
 * Sittings, not retakes: a course handed back once has been sat once and may be
 * sat twice more, and "2 attempts left" is what a learner looking at it means by
 * the words. The sitting in front of them counts as one of them, so the number
 * only falls as each is finished.
 *
 * A completed course has none left whatever the counter says. The count is
 * derived from hand-backs, and the last sitting is the one that is never handed
 * back — so a course finished at C on the third attempt still holds
 * retakeCount 2 and worked out to "1 attempt left" for a course that was over.
 *
 * 0 therefore means one of two things, and the caller tells them apart by
 * `retakes`: a course that never came back has nothing to say about attempts at
 * all, while one that came back and is now finished has none left.
 *
 * @param {number|string} retakeCount hand-backs used, off the learner's row
 * @param {number} [status] one of COURSE_STATUS
 */
export const attemptsLeftOf = (retakeCount, status) => {
  const used = Number(retakeCount) || 0;
  if (used === 0) return 0;
  if (Number(status) === COURSE_STATUS.COMPLETED) return 0;
  return Math.max(0, MAX_RETAKES + 1 - used);
};

/**
 * Local testing only: courses to treat as OVERDUE whatever the backend says.
 *
 * Nothing in this app can put a course into the overdue list — status 3 is set
 * server-side when the course's quarter lapses, and the browser only ever reads
 * it. That leaves the overdue screens untestable on a dev machine unless a real
 * course happens to have lapsed for the employee you are signed in as. This
 * forces one.
 *
 * Set it in .env.local to a JSON array:
 *
 *   NEXT_PUBLIC_FORCE_OVERDUE=[{"id":277,"no":"FT-277","name":"js-test"}]
 *
 * `id` must be the numeric module id (etms_emodule_master.id), because that is
 * what the course link is built from. .env* is gitignored and NEXT_PUBLIC_* is
 * inlined at build time, so a deployed build has this undefined and every
 * branch below is dead code.
 */
const FORCED_OVERDUE = (() => {
  const raw = process.env.NEXT_PUBLIC_FORCE_OVERDUE;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    // A typo in .env.local must not take the dashboard down with it.
    console.warn("NEXT_PUBLIC_FORCE_OVERDUE is not valid JSON — ignored.");
    return [];
  }
})();

/**
 * A forced course in the same shape the real rows are mapped into.
 *
 * The course's own details are read from `/emodule` rather than taken from the
 * .env spec. Category, instructor and the KRA quarter — and so the FINANCIAL
 * YEAR and QUARTER columns derived from it — all live on the module, not on the
 * learner's row, so a fixture built from the three fields in .env.local showed
 * the course with every one of those columns empty. Anything the spec does
 * name still wins, so a course id that does not exist yet can be described by
 * hand.
 */
async function forcedRow(spec, index) {
  let detail = null;
  try {
    detail = await getCourseDetail(spec.id);
  } catch {
    // Unreachable or not a real module — the fixture still appears, just thin.
  }

  const kraQuarter = clean(spec.kraQuarter) || detail?.kraQuarter || "";

  return {
    id: spec.id ?? -(index + 1),
    no: clean(spec.no) || detail?.code || "",
    name: clean(spec.name) || detail?.name || "",
    category: clean(spec.category) || detail?.category || "—",
    instructor: clean(spec.instructor) || detail?.instructor || "—",
    description: clean(spec.description) || detail?.description || "",
    status: COURSE_STATUS.OVERDUE,
    // Both blank on a real overdue row too: the grade is written when a course
    // is completed, and the stamp with it.
    grade: "-",
    regDate: "",
    regTime: "",
    completedOn: "",
    completedValue: null,
    kraQuarter,
    quarter: quarterOf(kraQuarter),
    financialYear: financialYearOf(kraQuarter),
    retakes: 0,
    attemptsLeft: 0,
    empName: "",
  };
}

/**
 * Puts the forced courses into the overdue list and takes them out of every
 * other one.
 *
 * Both halves matter. getAssignedStatus asks all four statuses at once and
 * takes the first hit in 0,1,2,3 order, so a course left standing in Pending as
 * well would still answer PENDING — and the course page would never go
 * read-only, which is the behaviour being tested.
 */
async function applyForcedOverdue(rows, status) {
  if (FORCED_OVERDUE.length === 0) return rows;

  const forcedIds = new Set(FORCED_OVERDUE.map((c) => String(c.id)));
  if (status !== COURSE_STATUS.OVERDUE) {
    return rows.filter((row) => !forcedIds.has(String(row.id)));
  }

  // Already lapsed for real — leave the backend's own row alone.
  const present = new Set(rows.map((row) => String(row.id)));
  const missing = FORCED_OVERDUE.filter((c) => !present.has(String(c.id)));
  if (missing.length === 0) return rows;

  return [...rows, ...(await Promise.all(missing.map(forcedRow)))];
}

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

  const rows = list.map((row, index) => {
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
      // Hand-backs after a grade C, and the sittings they leave. Both live on
      // the learner's own row, not on the course: two people can be on quite
      // different attempts at the same module.
      retakes: Number(row.retakeCount) || 0,
      attemptsLeft: attemptsLeftOf(row.retakeCount, row.status ?? status),
      empName: fullName(u.employeeFname, u.employeeLname),
      // The learner's own site and company, off their employee record. Lists of
      // one, so the grids can read these the same way they read a module's —
      // where the same course reaches several plants at once.
      plantIds: u.plant_id ? [String(u.plant_id)] : [],
      compIds: u.companyId ? [String(u.companyId)] : [],
    };
  });

  // Newest course first, as the officer's grids list them. The backend returns
  // these in allotment order, which put a course raised months ago above one
  // assigned this morning. `id` is the module id — the auto-increment behind
  // etms_emodule_master — so a higher one is a later course.
  //
  // Awaited before sorting: applyForcedOverdue is async — it may have to fetch
  // the forced rows — so sorting its return value directly sorts the promise.
  const withForced = await applyForcedOverdue(rows, status);
  return withForced.sort((a, b) => b.id - a.id);
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
 * This course as it sits in one of the learner's own lists, with which list —
 * or null when it is not theirs at all.
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
 * The row itself is returned, not just the status, because the course page has
 * to know the quarter it covers: one raised for a quarter still ahead is locked
 * until that quarter starts, and `kraQuarter` lives on the row.
 *
 * A learner's course sits in exactly one status, so all four are asked at once
 * and the first hit wins.
 *
 * @param {string} empCode
 * @param {number|string} moduleId
 * @returns {Promise<{status: number, course: object}|null>}
 */
export async function getAssignedCourse(empCode, moduleId) {
  if (!empCode || !Number.isFinite(Number(moduleId))) return null;

  const statuses = Object.values(COURSE_STATUS);
  const lists = await Promise.all(
    statuses.map((status) =>
      // One unreachable status must not deny a course the others would allow.
      getUserCourses(empCode, status).catch(() => [])
    )
  );

  for (let i = 0; i < lists.length; i += 1) {
    const course = lists[i].find((c) => String(c.id) === String(moduleId));
    if (course) return { status: statuses[i], course };
  }
  return null;
}

/**
 * As above, but only which list it is in.
 *
 * @param {string} empCode
 * @param {number|string} moduleId
 * @returns {Promise<number|null>} one of COURSE_STATUS, or null if not theirs
 */
export async function getAssignedStatus(empCode, moduleId) {
  return (await getAssignedCourse(empCode, moduleId))?.status ?? null;
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
