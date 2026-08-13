"use client";

import React from "react";
import Link from "next/link";
import { Tooltip } from "@mui/material";
import { Lock } from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import ExoMaterialTable from "@/components/ui/common/ExoMaterialTable";
import ExportActions from "@/components/ui/common/ExportActions";
import { encodeId } from "@/lib/courseId";
import {
  isQuarterUpcoming,
  quarterLabel,
  quarterStartLabel,
} from "@/services/MasterDataService";

/**
 * The Pending / In-Process / Overdue course list, and the officer's module
 * list.
 *
 * Overdue courses link like any other. They used to render as a dead badge, on
 * the grounds that the quarter had lapsed — but that left a learner unable to
 * open a course they are still marked as owing, and no other route to it.
 *
 * `manage` (the officer's ALL MODULES list) tags the course link so the course
 * page knows it was opened to be edited. The same officer reaching a course
 * from their own learner dashboard gets the plain read-only page.
 */
export default function ModulesGrid({
  data = [],
  loading = false,
  error = null,
  onRetry,
  manage = false,
  title = "MODULES",
  headerColor = "#3482AE",
  emptyMessage = "No courses found",
}) {
  // `data` is already the filtered set: the filter bar above the heading is
  // sent to the backend, which returns only the rows asked for. Nothing is
  // dropped here, so the table, the empty state and every export agree by
  // construction.
  const rows = data;

  const columns = React.useMemo(
    () => [
      {
        accessorKey: "no",
        header: "COURSE NO",
        Cell: ({ row }) => {
          const code = row.original.no || "N/A";
          const upcoming = isQuarterUpcoming(row.original.kraQuarter);
          const opens = upcoming ? quarterStartLabel(row.original.kraQuarter) : "";

          // Raised for a quarter still ahead: the course is the learner's and
          // is listed from the day it is assigned, but there is nothing to do
          // in it yet, so the badge does not link. Never locked in the
          // officer's list — a module they raised for next quarter is theirs to
          // open and edit today, which is the point of raising it early.
          if (!manage && upcoming) {
            return (
              // A real tooltip rather than the `title` attribute this used to
              // carry: the browser's own takes a second and a half to appear
              // over a badge this small, long enough that a learner hovering it
              // to find out why it will not open reads it as simply broken.
              <Tooltip
                arrow
                placement="top"
                enterDelay={150}
                enterTouchDelay={0}
                title={
                  opens
                    ? `Starts on ${opens} — locked until this course's quarter begins`
                    : "Locked — this course's quarter has not started yet"
                }
              >
                <span className="inline-flex cursor-not-allowed items-center gap-1 rounded bg-gray-400 px-2 py-1 text-xs font-semibold text-white">
                  <Lock className="h-3 w-3" />
                  {code}
                </span>
              </Tooltip>
            );
          }

          // Sittings left after a grade C are NOT shown here. The list is a
          // list; the place that has room to say a course came back and what
          // that means is the course itself, which is where it now says it.
          const badge = (
            <Link
              href={`/course/${encodeId(row.original.id)}${manage ? "?from=officer" : ""}`}
            >
              <span className="bg-[#3482AE] text-white px-2 py-1 rounded text-xs font-semibold cursor-pointer">
                {code}
              </span>
            </Link>
          );

          // The officer's own list, and this one is raised ahead. It is left
          // looking and behaving like every other row on purpose — it is theirs
          // to open and edit today — so the only thing that would tell them a
          // course they raised in advance is still waiting on its quarter is
          // reading the QUARTER column and working out whether that quarter has
          // come. Hovering the badge says it outright instead.
          if (upcoming) {
            return (
              <Tooltip
                arrow
                placement="top"
                enterDelay={150}
                enterTouchDelay={0}
                title={
                  opens
                    ? `Raised ahead — this course starts on ${opens}, when quarter ${
                        quarterLabel(row.original.quarter) ||
                        row.original.quarter
                      } begins. Learners have it, but cannot open it until then.`
                    : "Raised ahead — this course's quarter has not started yet. Learners have it, but cannot open it until then."
                }
              >
                <span className="inline-flex">{badge}</span>
              </Tooltip>
            );
          }

          return badge;
        },
      },
      // Plain name. Both chips that used to ride here are gone: a locked
      // course's "Opens 01-04-2027" is said by the padlocked badge beside it,
      // and a hand-back's remaining attempts are said on the course itself,
      // which has the room to explain what a returned course means rather than
      // shouting a red count across a table of ten.
      { accessorKey: "name", header: "COURSE NAME" },
      { accessorKey: "category", header: "COURSE CATEGORY" },
      { accessorKey: "instructor", header: "COURSE INSTRUCTOR" },
      // The two the filter bar above works on, shown so a filtered list says
      // what it is filtered to and an unfiltered one can be read by eye. Older
      // courses carry no quarter at all, which is why both fall back to a dash
      // rather than to a guess.
      {
        id: "financialYear",
        header: "FINANCIAL YEAR",
        accessorFn: (row) => row.financialYear || "",
        Cell: ({ row }) => row.original.financialYear || "—",
      },
      {
        id: "quarter",
        header: "QUARTER",
        accessorFn: (row) => quarterLabel(row.quarter),
        Cell: ({ row }) => quarterLabel(row.original.quarter) || "—",
      },
      {
        id: "assignedDate",
        header: "ASSIGNED ON",
        // Sorted and filtered on the stamp, not on "27-07-2026" — text order
        // puts every 01- before every 02- whatever the year.
        accessorFn: (row) => row.assignedOn?.date || "",
        sortingFn: (a, b) =>
          (a.original.assignedValue ?? 0) - (b.original.assignedValue ?? 0),
        Cell: ({ row }) => row.original.assignedOn?.date || "—",
      },
    ],
    [manage]
  );

  const getExportData = () =>
    rows.map((item) => ({
      "COURSE NO": item.no,
      "COURSE NAME": item.name,
      "COURSE CATEGORY": item.category,
      "COURSE INSTRUCTOR": item.instructor,
      "FINANCIAL YEAR": item.financialYear || "",
      QUARTER: quarterLabel(item.quarter),
      "ASSIGNED ON": item.assignedOn?.date || "",
    }));

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(getExportData());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modules");
    XLSX.writeFile(wb, "modules.xlsx");
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    // Driven by the export rows rather than by `columns`: the date columns are
    // built from an accessorFn and have no accessorKey to read a value by, so
    // reading the column list left both of them blank in every row.
    const rows = getExportData();
    const headers = Object.keys(rows[0] ?? {});
    autoTable(doc, {
      head: [headers],
      body: rows.map((row) => headers.map((h) => row[h] ?? "")),
    });
    doc.save("modules.pdf");
  };

  const handlePrint = () => window.print();

  return (
    <div className="bg-white rounded shadow border border-gray-200 overflow-hidden text-[12px]">
      {/* Header */}
      <div className="px-4 py-2" style={{ backgroundColor: headerColor }}>
        <h2 className="text-white font-bold uppercase tracking-wide">{title}</h2>
      </div>

      {/* Table — its toolbar carries the export buttons, so they share one
          line with the filter / columns / density / full-screen icons. */}
      <div className="p-3">
        {loading ? (
          <div className="flex justify-center items-center p-8">
            <div
              className="animate-spin rounded-full h-8 w-8 border-b-2"
              style={{ borderColor: headerColor }}
            ></div>
          </div>
        ) : error ? (
          <div className="text-red-500 p-4 text-center">
            {error}
            {onRetry ? (
              <button
                onClick={onRetry}
                className="ml-2 text-blue-600 hover:underline"
              >
                Retry
              </button>
            ) : null}
          </div>
        ) : (
          <ExoMaterialTable
            columns={columns}
            data={rows}
            enablePagination
            enableSorting
            enableColumnFilters
            enableGlobalFilter
            compact={true}
            initialState={{ density: "compact" }}
            muiTablePaperProps={{ elevation: 0 }}
            muiTableBodyRowProps={{
              hover: false,
              sx: { "&:hover": { backgroundColor: "transparent !important" } },
            }}
            state={{ showProgressBars: loading }}
            renderTopToolbarCustomActions={() => (
              <ExportActions
                onExcel={handleExportExcel}
                onPDF={handleExportPDF}
                onPrint={handlePrint}
              />
            )}
            renderEmptyRowsFallback={() => (
              <div className="p-4 text-center text-gray-500">{emptyMessage}</div>
            )}
          />
        )}
      </div>
    </div>
  );
}
