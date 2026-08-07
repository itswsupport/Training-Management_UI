"use client";

import React from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import ExoMaterialTable from "@/components/ui/common/ExoMaterialTable";
import ExportActions from "@/components/ui/common/ExportActions";
import { encodeId } from "@/lib/courseId";

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
    ],
    [manage]
  );

  const getExportData = () =>
    data.map((item) => ({
      "COURSE NO": item.no,
      "COURSE NAME": item.name,
      "COURSE CATEGORY": item.category,
      "COURSE INSTRUCTOR": item.instructor,
    }));

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(getExportData());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modules");
    XLSX.writeFile(wb, "modules.xlsx");
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const headers = columns.map((c) => c.header);
    const rows = data.map((row) => columns.map((c) => row[c.accessorKey] || ""));
    autoTable(doc, { head: [headers], body: rows });
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
            data={data}
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
