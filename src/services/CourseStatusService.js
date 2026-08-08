/**
 * Course-completion status across every employee/course assignment
 * (`/user_module1/by_status`) — the training officer's Course Status report.
 *
 * The endpoint returns the ENTIRE dataset in one shot (~20k rows) with no
 * server-side paging, so the result is cached in-tab for a minute and the grid
 * pages / sorts / filters it client-side.
 */

import { api, unwrap } from "@/config/api";
import { financialYearOf, quarterOf } from "@/services/MasterDataService";
import { clean, fullName } from "@/utils/etmsFormat";

const CACHE_TTL_MS = 60_000;

/**
 * One cached result per filter, not one overall.
 *
 * The rows for "2026 Q2" are not the rows for "all years", so a single slot
 * would serve one filter's answer to the next filter's question for up to a
 * minute. Keyed by the request that produced it, and cleared wholesale on a
 * forced reload so the refresh button still means refresh.
 */
const cache = new Map();
const inFlight = new Map();

const cacheKey = ({ financialYear = "", quarter = "" } = {}) =>
  `${financialYear}|${quarter}`;

/** Matches the legacy jsCourseCompletionList: 2 completed, 3 overdue, else pending. */
export function statusMeta(status) {
  if (status === 2) return { label: "COMPLETED", variant: "approved" };
  if (status === 3) return { label: "OVERDUE", variant: "rejected" };
  return { label: "PENDING", variant: "pending" };
}

async function fetchRows(filter = {}) {
  const params = {};
  if (filter.financialYear) params.financialYear = filter.financialYear;
  if (filter.quarter) params.quarter = filter.quarter;

  const list = unwrap(await api.get("/user_module1/by_status", { params }), []) ?? [];
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
    // Derived from the same string the KRA QUARTER column shows, so the
    // officer's year / quarter filter reads the course's own quarter and
    // carries across from ALL MODULES unchanged.
    quarter: quarterOf(r.kraQuarter),
    financialYear: financialYearOf(r.kraQuarter),
    grade: clean(r.grade) || "-",
    status: r.status ?? 0,
  }));
}

/**
 * @param {{force?: boolean, financialYear?: string, quarter?: string}} [options]
 *   `force` bypasses and clears the cache; the other two narrow the request,
 *   and the backend does the narrowing.
 * @returns {Promise<Array>}
 */
export async function getCourseStatusRows({ force = false, ...filter } = {}) {
  const key = cacheKey(filter);

  if (force) {
    // Every filter's rows are stale, not just this one's — the officer pressed
    // refresh because the data moved.
    cache.clear();
  } else {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.rows;
    const pending = inFlight.get(key);
    if (pending) return pending;
  }

  const request = fetchRows(filter)
    .then((rows) => {
      cache.set(key, { rows, at: Date.now() });
      return rows;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, request);
  return request;
}
