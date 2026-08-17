/**
 * Dropdown master data for the Training Module form.
 */

import { api, unwrap } from "@/config/api";
import { clean } from "@/utils/etmsFormat";

/** Apr–Jun = 1, Jul–Sep = 2, Oct–Dec = 3, else 4 (matches getKRAQuarterStatus). */
export function currentQuarter(month = new Date().getMonth() + 1) {
  if (month >= 4 && month <= 6) return "1";
  if (month >= 7 && month <= 9) return "2";
  if (month >= 10 && month <= 12) return "3";
  return "4";
}

/**
 * The employee name behind a "NAME (12345)" dropdown label.
 *
 * The code is shown so two instructors of the same name can be told apart —
 * ten such pairs are on the active roster — but only the name is stored, which
 * is what every course created before this shows.
 */
export const instructorName = (value) =>
  String(value ?? "")
    .replace(/\s*\(\d+\)\s*$/, "")
    .trim();

/**
 * The quarter dropdown. The number is what gets stored; the months are shown
 * so the officer does not have to remember which quarter starts in April.
 */
export const QUARTER_OPTIONS = [
  { value: "1", label: "1 (Apr - Jun)" },
  { value: "2", label: "2 (Jul - Sep)" },
  { value: "3", label: "3 (Oct - Dec)" },
  { value: "4", label: "4 (Jan - Mar)" },
];

/**
 * The financial year a date falls in, named by the calendar year it starts in.
 *
 * April to March, the same boundary currentQuarter() above already assumes, so
 * March 2026 belongs to the year that began in April 2025 and is called 2025.
 */
export function currentFinancialYear(date = new Date()) {
  const year = date.getFullYear();
  return date.getMonth() + 1 >= 4 ? year : year - 1;
}

/** "2025-26" for the year starting April 2025. */
export const financialYearLabel = (startYear) =>
  `${startYear}-${String((Number(startYear) + 1) % 100).padStart(2, "0")}`;

/**
 * The financial year dropdown: last year, this one, and the two ahead.
 *
 * A course is usually raised for the year in progress or the one about to
 * start; the year behind is kept because a module added in April for the
 * quarter that just closed is a real thing officers do.
 */
export function financialYearOptions(startYear = currentFinancialYear()) {
  const first = Number(startYear) - 1;
  return Array.from({ length: 4 }, (_, i) => {
    const year = first + i;
    return { value: String(year), label: financialYearLabel(year) };
  });
}

/**
 * Builds the kraQuarter label and validTill date the backend stores.
 *
 * `financialYear` is the year the April-to-March span starts in, which is not
 * the calendar year the quarter falls in for Q4: quarter 4 of 2025-26 runs
 * January to March 2026. This used to take a calendar year defaulting to the
 * current one, so a Q4 course raised any time before January was stamped with
 * the January just gone — a validTill in the past, expiring the course the
 * moment it was created.
 */
export function quarterMeta(quarter, financialYear = currentFinancialYear()) {
  const parsed = Number(financialYear);
  const start = Number.isFinite(parsed) ? parsed : currentFinancialYear();

  switch (String(quarter)) {
    case "1":
      return {
        kraQuarter: `1 [ ${start}-04-01 to ${start}-06-30 ]`,
        validTill: `${start}-06-30`,
      };
    case "2":
      return {
        kraQuarter: `2 [ ${start}-07-01 to ${start}-09-30 ]`,
        validTill: `${start}-09-30`,
      };
    case "3":
      return {
        kraQuarter: `3 [ ${start}-10-01 to ${start}-12-31 ]`,
        validTill: `${start}-12-31`,
      };
    default: {
      // Q4 is January to March, which lands in the calendar year after the one
      // the financial year is named for.
      const end = start + 1;
      return {
        kraQuarter: `4 [ ${end}-01-01 to ${end}-03-31 ]`,
        validTill: `${end}-03-31`,
      };
    }
  }
}

/** "2" → "2 (Jul - Sep)", for a column showing what a stored quarter means. */
export const quarterLabel = (quarter) =>
  QUARTER_OPTIONS.find((option) => option.value === String(quarter))?.label ??
  "";

/** "1 [ 2024-04-01 to 2024-06-30 ]" → "1"; anything else → "". */
export const quarterOf = (kraQuarter) => {
  const match = String(kraQuarter ?? "").trim().match(/^([1-4])\b/);
  return match ? match[1] : "";
};

/**
 * The financial year a stored quarter belongs to, as the calendar year it
 * starts in — "1 [ 2026-04-01 to … ]" and "4 [ 2027-01-01 to … ]" are both
 * 2026, because the year runs April to March.
 *
 * Read from the span's own first date rather than from the quarter number, so
 * a row whose number and dates disagree is filed under the dates it actually
 * covers. Empty for the older courses that carry no quarter at all — most of
 * them, so anything filtering on this needs a way to ask for everything.
 */
export const financialYearOf = (kraQuarter) => {
  const match = String(kraQuarter ?? "").match(/(\d{4})-(\d{2})-\d{2}/);
  if (!match) return "";
  const year = Number(match[1]);
  return String(Number(match[2]) >= 4 ? year : year - 1);
};

/**
 * The first day of a stored quarter — "1 [ 2026-04-01 to 2026-06-30 ]" → the
 * 2026-04-01. Empty for the older courses that carry no quarter at all.
 *
 * Read off the span's own dates rather than computed from the quarter number,
 * for the same reason financialYearOf does: a row whose number and dates
 * disagree is honoured by the dates it actually covers.
 */
export const quarterStartOf = (kraQuarter) => {
  const match = /(\d{4}-\d{2}-\d{2})/.exec(String(kraQuarter ?? ""));
  return match ? match[1] : "";
};

/**
 * Whether a course's quarter has not begun yet.
 *
 * A module can be raised for a quarter still ahead — next year's Q1 is offered
 * by the form on purpose, so a training plan can be laid out in advance. The
 * course is assigned and appears in the learner's PENDING list straight away,
 * but there is nothing to do in it until the quarter it covers actually starts,
 * so until that day it is shown locked.
 *
 * Dates, not instants: the quarter is open for the whole of its first day, so a
 * course must unlock at midnight on that morning rather than a second after it.
 *
 * Anything unparseable answers false — courses created before the quarter
 * fields existed carry no usable date, and one of those must stay open rather
 * than be locked shut by a value that was never set.
 *
 * @param {string} kraQuarter the stored "N [ start to end ]" string
 */
export function isQuarterUpcoming(kraQuarter, today = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(quarterStartOf(kraQuarter));
  if (!match) return false;

  const start = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(start.getTime())) return false;

  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  return startOfToday < start;
}

/** "2026-04-01" → "01-04-2026", the form the rest of the app shows dates in. */
export const quarterStartLabel = (kraQuarter) => {
  const [year, month, day] = quarterStartOf(kraQuarter).split("-");
  return day ? `${day}-${month}-${year}` : "";
};

/**
 * Whether a course's quarter has closed.
 *
 * `validTill` is the last day the quarter covers, so the course is still
 * current for the whole of that day — this compares dates, not instants, or a
 * course would lock at midnight-plus-one-second on its final morning.
 *
 * Anything unparseable answers false. Modules created before the quarter fields
 * existed carry no usable date, and a module nobody dated must stay editable
 * rather than be locked out by a value that was never set.
 *
 * @param {string} validTill the stored YYYY-MM-DD date
 */
export function isQuarterClosed(validTill, today = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(validTill ?? "").trim());
  if (!match) return false;

  const end = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(end.getTime())) return false;

  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  return startOfToday > end;
}

/**
 * Every dropdown the module form needs, fetched in parallel.
 *
 * @returns {Promise<{
 *   categories: {id: number, name: string}[],
 *   instructors: {name: string, code: string, label: string}[],
 *   departments: {id: number, name: string}[],
 *   grades: {id: number, label: string}[],
 *   plants: {id: number, name: string}[],
 *   companies: {id: number, name: string}[],
 *   defaultQuarter: string,
 *   defaultFinancialYear: string
 * }>}
 */
/**
 * `/instructor/employee/list` returns raw `[firstName, lastName, empCode]`
 * tuples for serving employees only.
 */
const toEmployee = (row) => {
  const name = `${clean(row?.[0])} ${clean(row?.[1])}`.replace(/\s+/g, " ").trim();
  const code = clean(row?.[2]);
  return { name, code, label: code ? `${name} (${code})` : name };
};

/**
 * Employee code → name, for the columns the backend hands over as a bare code.
 *
 * The roster is serving employees only, so an officer who has since left will
 * not be in it — callers keep the code as the fallback rather than showing a
 * blank where a name should be.
 *
 * @returns {Promise<Map<string, string>>}
 */
export async function getEmployeeNames() {
  const list = unwrap(await api.get("/instructor/employee/list"), []) ?? [];
  const byCode = new Map();
  list.map(toEmployee).forEach(({ name, code }) => {
    if (code && name) byCode.set(code, name);
  });
  return byCode;
}

/**
 * The plant rows, or [] when this backend has no `/plant/list`.
 *
 * The endpoint is newer than the other four, so `getModuleFormOptions` asks for
 * it defensively and hands the failure here as null: a backend that predates it
 * leaves the Plant field empty rather than failing the whole form, which is what
 * a rejected Promise.all would have done.
 */
function toPlants(res) {
  if (!res) return [];
  try {
    return (unwrap(res, []) ?? [])
      // Closed sites stay out of a dropdown that decides who gets a course.
      .filter((p) => p.plantStatus == null || p.plantStatus === 1)
      .map((p) => ({
        id: p.id,
        name: clean(p.plantName),
        code: clean(p.plantCode),
      }))
      .filter((p) => p.name.length > 0)
      // Ascending by what the field actually shows, which is code-first — the
      // other four masters all sort and this one arrived in whatever order the
      // backend held it. `numeric` is what keeps 1002 above 1010: compared as
      // text, "1010" sorts before "1002" digit by digit.
      .sort((a, b) =>
        plantLabel(a).localeCompare(plantLabel(b), undefined, { numeric: true })
      );
  } catch {
    return [];
  }
}

/** "1001 — Rucha Engineers Pvt. Ltd. Unit-1"; just the name when uncoded. */
export const plantLabel = (plant) =>
  plant?.code ? `${plant.code} — ${plant.name}` : (plant?.name ?? "");

/**
 * The company rows, or [] when this backend has no `/company/list`.
 *
 * Newer than every other master, so it is asked for defensively exactly as
 * `/plant/list` is: a backend that predates it leaves COMPANY empty, and the
 * form's chain then simply starts at PLANT instead of failing to load at all.
 *
 * The companies come from the EMS master schema — ETMS's own comp_master exists
 * but has never had a row in it.
 */
function toCompanies(res) {
  if (!res) return [];
  try {
    return (unwrap(res, []) ?? [])
      .map((c) => ({ id: c.id, name: clean(c.compName) }))
      .filter((c) => c.name.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

/**
 * The company rows on their own, for a screen that wants the COMPANY control
 * without the whole module form behind it — the Course Status filter bar.
 *
 * Defensive like the plants above: a backend without `/company/list` leaves the
 * control empty rather than failing the screen it sits on.
 *
 * @returns {Promise<{id: number, name: string}[]>}
 */
export async function getCompanies() {
  return toCompanies(await api.get("/company/list").catch(() => null));
}

/**
 * The plants to offer, narrowed to the chosen companies.
 *
 * With no company picked this is every active plant, which is what
 * `/plant/list` has always returned and what the form asks for on load.
 *
 * The backend derives this from the employee master — the plants actually
 * staffed by those companies — because plant_mst carries no company column at
 * all. One site is staffed by both companies and is correctly offered for
 * either.
 *
 * Errors are left to the caller rather than swallowed into an empty list: an
 * officer mid-way through the form must not lose their plant to a failed
 * lookup. See `useAudienceOptions`, which keeps the previous list on a throw.
 *
 * @returns {Promise<{id: number, name: string, code: string}[]>}
 */
export async function getPlants({ companyIds = [] } = {}) {
  const params = new URLSearchParams();
  companyIds.forEach((id) => params.append("companyIdList[]", id));

  return toPlants(await api.get("/plant/list", { params }));
}

/**
 * The departments to offer, narrowed to the chosen plants.
 *
 * With no plant picked this is every department, which is what `/department/list`
 * has always returned and what the form asks for on load.
 *
 * The backend derives this from the employee master — the departments actually
 * staffed at those plants — rather than from `plant_wise_dept_mst`. That table
 * keys departments by name rather than id and only a third of its names match
 * the department master, so two thirds of the list would quietly disappear.
 *
 * @returns {Promise<{id: number, name: string}[]>}
 */
export async function getDepartments({ plantIds = [] } = {}) {
  const params = new URLSearchParams();
  plantIds.forEach((id) => params.append("plantIdList[]", id));

  const rows = unwrap(await api.get("/department/list", { params }), []) ?? [];
  return rows
    .map((d) => ({ id: d.id, name: clean(d.deptName) }))
    .filter((d) => d.name.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The employees the module form's plant / department / grade filters currently
 * resolve to — the people a course raised with those filters would reach.
 *
 * Asked of the backend rather than filtered in the browser: the employee list
 * behind the Instructor dropdown carries names and codes only, so nothing here
 * knows which plant, department or grade anyone is in.
 *
 * Department is the anchor. With none chosen there is no audience yet, and this
 * says so without a request — the backend answers the same empty list.
 *
 * @returns {Promise<{name: string, code: string, label: string}[]>}
 */
export async function getAudienceEmployees({
  plantIds = [],
  deptIds = [],
  gradeIds = [],
} = {}) {
  if (deptIds.length === 0) return [];

  // Built by hand because the backend's @RequestParam names literally include
  // "[]" and each id has to go as its own repeat of that name.
  const params = new URLSearchParams();
  plantIds.forEach((id) => params.append("plantIdList[]", id));
  deptIds.forEach((id) => params.append("deptIdList[]", id));
  gradeIds.forEach((id) => params.append("gradeIdList[]", id));

  const rows = unwrap(await api.get("/employee/audience", { params }), []) ?? [];
  return rows
    .map(toEmployee)
    .filter((e) => e.name.length > 0)
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * The employees a course has actually been given to, with the plant each of
 * them works at.
 *
 * Not the same question as `getAudienceEmployees`, which answers "who would this
 * reach if it were raised today". This is the allotment on record — what the
 * edit form fills its PLANT and SELECT USER fields from, so a course already out
 * with a hundred people does not open as if it had gone to nobody.
 *
 * The plant rides along because a module stores none: the only record of which
 * sites a course reached is the sites its people work at.
 *
 * @param {number|string} emoduleId
 * @returns {Promise<{name: string, code: string, label: string,
 *   plantId: string}[]>}
 */
export async function getAllottedEmployees(emoduleId) {
  if (emoduleId == null || String(emoduleId).trim() === "") return [];

  const rows =
    unwrap(await api.get("/employee/alotted", { params: { emoduleId } }), []) ?? [];
  return rows
    .map((row) => ({ ...toEmployee(row), plantId: clean(row?.[3]) }))
    .filter((e) => e.code.length > 0)
    .sort((a, b) => a.label.localeCompare(b.label));
}

export async function getModuleFormOptions() {
  const [cat, inst, dept, grade, plant, company] = await Promise.all([
    api.get("/category/list"),
    api.get("/instructor/employee/list"),
    api.get("/department/list"),
    api.get("/grade/list"),
    // Caught rather than awaited bare — see toPlants.
    api.get("/plant/list").catch(() => null),
    // Likewise, and for the same reason — see toCompanies.
    api.get("/company/list").catch(() => null),
  ]);

  // Names repeat across the company, so the code is part of what is shown and
  // stored — it is the only way to tell two instructors of the same name apart.
  // This is the whole roster, which is right for Course Instructor: a course can
  // be written by anyone. The User field is not this list — it is narrowed by
  // the module's own filters; see getAudienceEmployees.
  const instructors = (unwrap(inst, []) ?? [])
    .map(toEmployee)
    .filter((i) => i.name.length > 0)
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    categories: (unwrap(cat, []) ?? []).map((c) => ({
      id: c.id,
      name: clean(c.categoryName),
    })),
    instructors,
    departments: (unwrap(dept, []) ?? []).map((d) => ({
      id: d.id,
      name: clean(d.deptName),
    })),
    plants: toPlants(plant),
    companies: toCompanies(company),
    // Grade 0 — the master's own "All Grade" row — is left out: every grade
    // field offers its own "All grades" tick, so carrying both put two ways of
    // saying the same thing in one dropdown. The tick reaches the same people,
    // since every serving employee is on a grade between M7 and S1. Grade 0 is
    // still named in `masterLabels` below, so courses raised with it keep
    // reading as "All Grade" in history.
    grades: (unwrap(grade, []) ?? [])
      .filter((g) => g?.id !== 0)
      .map((g) => ({
        id: g.id,
        label: gradeLabel(g),
      })),
    defaultQuarter: currentQuarter(),
    defaultFinancialYear: String(currentFinancialYear()),
  };
}

/** "L4 [ Engineer ]" for one `/grade/list` row; grade 0 is every grade. */
export const gradeLabel = (grade) =>
  grade?.id === 0
    ? "All Grade"
    : `${clean(grade?.grade)} [ ${clean(grade?.designation)} ]`;

/**
 * `id → name` from one master list, skipping the rows with neither.
 *
 * An empty map is the answer for a list that failed or came back unreadable —
 * the ids it would have named keep showing as ids, which is the whole point of
 * catching each master separately.
 */
function idNames(res, name) {
  const map = new Map();
  if (!res) return map;
  try {
    (unwrap(res, []) ?? []).forEach((row) => {
      const label = clean(name(row));
      if (row?.id != null && label) map.set(String(row.id), label);
    });
  } catch {
    return map;
  }
  return map;
}

/**
 * The four masters the module history stores as bare ids.
 *
 * A history snapshot keeps a course's category, departments, grades and plants
 * the way the module row does — as ids — so an edit reads `Category: 3 → 7`
 * until the ids are put back through the lists they came from. See
 * `snapshotText` in TransactionService, which is what spends this.
 *
 * Each list is caught on its own: a master that cannot be reached leaves its
 * own field showing ids rather than taking the others down with it. `/plant/list`
 * is caught for the second reason as well — it is newer than the rest and a
 * backend that predates it answers nothing at all.
 *
 * @returns {Promise<{categories: Map<string, string>,
 *   departments: Map<string, string>, grades: Map<string, string>,
 *   plants: Map<string, string>}>}
 */
export async function getSnapshotLabels() {
  const [cat, dept, grade, plant] = await Promise.all([
    api.get("/category/list").catch(() => null),
    api.get("/department/list").catch(() => null),
    api.get("/grade/list").catch(() => null),
    api.get("/plant/list").catch(() => null),
  ]);

  return {
    categories: idNames(cat, (c) => c.categoryName),
    departments: idNames(dept, (d) => d.deptName),
    grades: idNames(grade, gradeLabel),
    plants: idNames(plant, (p) => plantLabel({ code: p.plantCode, name: p.plantName })),
  };
}
