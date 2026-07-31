/**
 * Course-completion status across every employee/course assignment
 * (`/user_module1/by_status`) — the training officer's Course Status report.
 *
 * The endpoint returns the ENTIRE dataset in one shot (~20k rows) with no
 * server-side paging, so the result is cached in-tab for a minute and the grid
 * pages / sorts / filters it client-side.
 */

import { api, unwrap } from "@/config/api";
import { clean, fullName } from "@/utils/etmsFormat";

const CACHE_TTL_MS = 60_000;
let cache = null;
let inFlight = null;

/** Matches the legacy jsCourseCompletionList: 2 completed, 3 overdue, else pending. */
export function statusMeta(status) {
  if (status === 2) return { label: "COMPLETED", variant: "approved" };
  if (status === 3) return { label: "OVERDUE", variant: "rejected" };
  return { label: "PENDING", variant: "pending" };
}

async function fetchRows() {
  const list = unwrap(await api.get("/user_module1/by_status"), []) ?? [];
  return list.map((r, index) => ({
    key: `${r.id ?? "x"}-${index}`,
    no: clean(r.emoduleId),
    // Numeric module id (etms_emodule_master.id) — used to open the course.
    moduleId: r.id ?? 0,
    empCode: r.empCode != null ? String(r.empCode) : "",
    empName: fullName(r.employeeFname, r.employeeLname),
    designation: clean(r.desigName),
    course: clean(r.emoduleName),
    kraQuarter: clean(r.kraQuarter),
    grade: clean(r.grade) || "-",
    status: r.status ?? 0,
  }));
}

/**
 * @param {{force?: boolean}} [options] pass `force` to bypass the cache
 * @returns {Promise<Array>}
 */
export async function getCourseStatusRows({ force = false } = {}) {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.rows;
  if (!force && inFlight) return inFlight;

  inFlight = fetchRows()
    .then((rows) => {
      cache = { rows, at: Date.now() };
      return rows;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
