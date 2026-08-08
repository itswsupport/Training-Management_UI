"use client";

import React from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import ExoMaterialTable from "@/components/ui/common/ExoMaterialTable";
import ExportActions from "@/components/ui/common/ExportActions";
import { encodeId } from "@/lib/courseId";
import { quarterLabel } from "@/services/MasterDataService";

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
        Cell: ({ row }) => (
          <Link
            href={`/course/${encodeId(row.original.id)}${manage ? "?from=officer" : ""}`}
          >
            <span className="bg-[#3482AE] text-white px-2 py-1 rounded text-xs font-semibold cursor-pointer">
              {row.original.no || "N/A"}
            </span>
          </Link>
        ),
      },
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
