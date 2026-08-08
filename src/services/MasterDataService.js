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

export async function getModuleFormOptions() {
  const [cat, inst, dept, grade] = await Promise.all([
    api.get("/category/list"),
    api.get("/instructor/employee/list"),
    api.get("/department/list"),
    api.get("/grade/list"),
  ]);

  // Names repeat across the company, so the code is part of what is shown and
  // stored — it is the only way to tell two instructors of the same name apart.
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
    grades: (unwrap(grade, []) ?? []).map((g) => ({
      id: g.id,
      label:
        g.id === 0
          ? "All Grade"
          : `${clean(g.grade)} [ ${clean(g.designation)} ]`,
    })),
    defaultQuarter: currentQuarter(),
    defaultFinancialYear: String(currentFinancialYear()),
  };
}
