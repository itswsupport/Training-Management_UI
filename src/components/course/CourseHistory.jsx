"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

import { apiErrorMessage } from "@/config/api";
import { getEmployeeNames, getSnapshotLabels } from "@/services/MasterDataService";
import {
  getTransactions,
  snapshotText,
  usesSnapshotLabels,
  withoutCreationRun,
} from "@/services/TransactionService";

/** One colour family per kind of edit, so the list scans at a glance. */
const ACTION_STYLE = {
  MODULE_CREATED: "bg-[#3482AE]/10 text-[#2a6a8f]",
  MODULE_UPDATED: "bg-[#3482AE]/10 text-[#2a6a8f]",
  SECTION_ADDED: "bg-[#ffc107]/15 text-[#a17200]",
  SECTION_UPDATED: "bg-[#ffc107]/15 text-[#a17200]",
  SECTION_DELETED: "bg-[#dc3545]/10 text-[#c2384a]",
  QUESTION_ADDED: "bg-[#ffc107]/15 text-[#a17200]",
  QUESTION_UPDATED: "bg-[#ffc107]/15 text-[#a17200]",
  QUESTION_DELETED: "bg-[#dc3545]/10 text-[#c2384a]",
};

const th = "px-3 py-2 text-left text-[11px] font-bold tracking-wide uppercase";
const td = "px-3 py-2 align-top text-[12px] text-gray-700";

/** An empty before-value on a create reads better than an empty cell. */
const shown = (value) => (value === "" ? "—" : value);

/**
 * One `Instructor: AREF SHAIKH → AARTI ATKARE` line.
 *
 * The snapshot behind it holds ids, so both sides go through `snapshotText`
 * with the master lists — that is what turns `Category: 3 → 7` into
 * `Category: Safety → Technical`.
 */
function FieldChange({ change, labels }) {
  const from = snapshotText(change.field, change.from, labels);
  const to = snapshotText(change.field, change.to, labels);

  return (
    <div className="flex flex-wrap items-baseline gap-1.5 normal-case">
      <span className="font-semibold text-gray-800">{change.label}:</span>
      <span className="rounded bg-[#dc3545]/8 px-1.5 py-0.5 text-[#c2384a]">
        {shown(from)}
      </span>
      <ArrowRight className="h-3 w-3 shrink-0 text-gray-400" />
      <span className="rounded bg-[#20c997]/12 px-1.5 py-0.5 font-semibold text-[#158765]">
        {shown(to)}
      </span>
    </div>
  );
}

/**
 * This course's edit history — every change an officer made to it, field by
 * field, with what the value was before and what it became.
 *
 * Read-only by design. The rows are written by the backend as each save
 * happens; nothing here may edit or delete them, or the record would be worth
 * nothing. Assignment and feedback activity is deliberately not here — that is
 * learner traffic, and one module assigned to a department writes a row per
 * employee, which would bury the edits.
 */
export default function CourseHistory({ emoduleId }) {
  const [rows, setRows] = useState([]);
  const [names, setNames] = useState(null);
  const [labels, setLabels] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Building the course is not an edit of it — a module that has only just
      // been created starts with an empty history and fills from its first
      // real change onward.
      const history = withoutCreationRun(
        await getTransactions({ emoduleId, onlyEdits: true })
      );
      setRows(history);

      // Only worth a request when the backend has actually left somebody as a
      // bare code; a history it named in full needs no roster.
      //
      // Deliberately not awaited: the history is the record and should be on
      // screen as soon as it arrives, with the codes it came with. Waiting on
      // the roster would hold the whole table behind a second round trip to put
      // a nicer word in one column. The names drop in when they land.
      if (history.some((row) => !row.actionByNamed && row.actionBy)) {
        getEmployeeNames()
          .then(setNames)
          // The roster is a courtesy, not the record. Failing to reach it
          // leaves the codes showing rather than taking the history down.
          .catch(() => {});
      }

      // Same bargain for the category, department, grade and plant names: only
      // worth fetching when an edit here actually touched one of those fields,
      // and not worth holding the table behind. Until they land — or if they
      // never do — those changes read as the ids the snapshot stored.
      if (usesSnapshotLabels(history)) {
        getSnapshotLabels()
          .then(setLabels)
          .catch(() => {});
      }
    } catch (err) {
      setRows([]);
      setError(apiErrorMessage(err, "Could not load this course's edit history."));
    } finally {
      setLoading(false);
    }
  }, [emoduleId]);

  /**
   * Who made this change. The backend's own name wins where it has one; the
   * rest are looked up by code, and an officer no longer on the roster keeps
   * their code so the column is never empty.
   */
  const editedBy = (row) =>
    row.actionByNamed
      ? row.actionByName
      : (names?.get(String(row.actionBy)) ?? row.actionByName);

  useEffect(() => {
    load();
  }, [load]);

  const visible = showAll ? rows : rows.slice(0, 10);

  return (
    <section className="bg-white rounded shadow border border-gray-200 text-[12px]">
      <div className="bg-[#3482AE] px-4 py-2">
        <h2 className="text-white font-bold uppercase tracking-wide">
          Edit History
        </h2>
      </div>

      <div className="p-3">
        {loading ? (
          <div className="flex justify-center items-center p-6">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-[#3482AE]"></div>
          </div>
        ) : error ? (
          <p className="p-3 text-center normal-case text-[#dc3545]">
            {error}
            <button
              type="button"
              onClick={load}
              className="ml-2 cursor-pointer text-[#3482AE] hover:underline"
            >
              Retry
            </button>
          </p>
        ) : rows.length === 0 ? (
          <p className="p-3 text-center normal-case text-gray-500">
            This course has not been changed since it was created.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse">
                <thead>
                  <tr className="bg-[#f8f9fa] text-[#3482AE]">
                    <th className={th}>Sr No</th>
                    <th className={th}>Change</th>
                    <th className={th}>Changed By</th>
                    <th className={th}>What Changed</th>
                    <th className={th}>Date</th>
                    <th className={th}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row, i) => (
                    <tr key={row.id} className="border-t border-gray-200">
                      {/* A running count over the list, newest first — not the
                          stored id, which is shared with every other course and
                          reads as gappy here. */}
                      <td className={`${td} font-semibold text-gray-500`}>
                        {i + 1}
                      </td>
                      <td className={td}>
                        <span
                          className={`inline-block rounded px-2 py-1 text-[11px] font-semibold whitespace-nowrap ${
                            ACTION_STYLE[row.action] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {row.actionText}
                        </span>
                      </td>
                      <td className={`${td} normal-case`}>{editedBy(row)}</td>
                      <td className={td}>
                        {/* A module edit lists its fields; a section or question
                            edit has no field diff, only what it did. */}
                        {row.action === "MODULE_UPDATED" && row.changes.length ? (
                          <div className="space-y-1">
                            {row.changes.map((change) => (
                              <FieldChange
                                key={change.field}
                                change={change}
                                labels={labels}
                              />
                            ))}
                          </div>
                        ) : (
                          <span className="normal-case">
                            {row.description || "—"}
                          </span>
                        )}
                      </td>
                      <td className={`${td} whitespace-nowrap`}>
                        {row.whenDate || "—"}
                      </td>
                      <td className={`${td} whitespace-nowrap`}>
                        {row.whenTime || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {rows.length > 10 ? (
              <div className="mt-3 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="cursor-pointer rounded border border-[#3482AE]/40 px-4 py-1.5 text-[12px] font-semibold tracking-wide text-[#3482AE] uppercase transition hover:bg-[#3482AE]/10"
                >
                  {showAll ? "Show less" : `Show all ${rows.length} changes`}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
