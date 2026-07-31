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

/** Builds the kraQuarter label and validTill date the backend stores. */
export function quarterMeta(quarter, year = new Date().getFullYear()) {
  switch (String(quarter)) {
    case "1":
      return {
        kraQuarter: `1 [ ${year}-04-01 to ${year}-06-30 ]`,
        validTill: `${year}-06-30`,
      };
    case "2":
      return {
        kraQuarter: `2 [ ${year}-07-01 to ${year}-09-30 ]`,
        validTill: `${year}-09-30`,
      };
    case "3":
      return {
        kraQuarter: `3 [ ${year}-10-01 to ${year}-12-31 ]`,
        validTill: `${year}-12-31`,
      };
    default:
      return {
        kraQuarter: `4 [ ${year}-01-01 to ${year}-03-31 ]`,
        validTill: `${year}-03-31`,
      };
  }
}

/**
 * Every dropdown the module form needs, fetched in parallel.
 *
 * @returns {Promise<{
 *   categories: {id: number, name: string}[],
 *   instructors: {name: string, code: string, label: string}[],
 *   departments: {id: number, name: string}[],
 *   grades: {id: number, label: string}[],
 *   defaultQuarter: string
 * }>}
 */
export async function getModuleFormOptions() {
  const [cat, inst, dept, grade] = await Promise.all([
    api.get("/category/list"),
    api.get("/instructor/employee/list"),
    api.get("/department/list"),
    api.get("/grade/list"),
  ]);

  // The instructor endpoint returns raw [firstName, lastName, empCode] tuples
  // for serving employees only. Names repeat across the company, so the code is
  // part of what is shown and stored — it is the only way to tell two
  // instructors of the same name apart.
  const instructors = (unwrap(inst, []) ?? [])
    .map((row) => {
      const name = `${clean(row?.[0])} ${clean(row?.[1])}`.replace(/\s+/g, " ").trim();
      const code = clean(row?.[2]);
      return { name, code, label: code ? `${name} (${code})` : name };
    })
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
  };
}
