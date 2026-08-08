"use client";

import React from "react";
import Link from "next/link";
import { Box, Chip } from "@mui/material";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import ExoMaterialTable from "@/components/ui/common/ExoMaterialTable";
import ExportActions from "@/components/ui/common/ExportActions";
import FeedbackResponseDialog from "@/components/dashboards/FeedbackResponseDialog";
import { encodeId } from "@/lib/courseId";
import { getCourseStatusConfig } from "@/lib/statusConfig";

/**
 * The status filter's own values, not the backend's.
 *
 * A row's status is 2 completed, 3 overdue, anything else pending — the same
 * rule getCourseStatusConfig reads. "Pending" here therefore covers overdue
 * too: both mean the employee has not finished, which is the distinction an
 * officer chasing completions is making.
 */
export const STATUS_ALL = "all";
const STATUS_COMPLETED = "completed";
const STATUS_PENDING = "pending";

/** Exported so the page can render the control on the line above the grid. */
export const STATUS_CHOICES = [
  { value: STATUS_ALL, label: "All" },
  { value: STATUS_COMPLETED, label: "Completed" },
  { value: STATUS_PENDING, label: "Pending" },
];

export default function CourseStatusGrid({
  data = [],
  loading = false,
  error = null,
  onRetry,
  title = "COURSE STATUS",
  headerColor = "#20c997",
  // The status the officer is chasing. Year and quarter are not props: those
  // two go to the backend with the request, so `data` already carries only the
  // quarter that was asked for. Status stays here — it is one field on a row
  // already in hand, and a round trip to hide two thirds of it would be slower
  // than the click that asked for it.
  status = STATUS_ALL,
}) {
  // The row whose feedback is open, or null. Held on the grid rather than in
  // the column definition so the panel survives the table re-rendering.
  const [viewing, setViewing] = React.useState(null);

  // What the table, the empty state and every export all read, so a filtered
  // screen and a filtered export can never disagree.
  const rows = React.useMemo(() => {
    if (status === STATUS_ALL) return data;
    const wantCompleted = status === STATUS_COMPLETED;
    return data.filter((row) => (row.status === 2) === wantCompleted);
  }, [data, status]);

  const columns = React.useMemo(
    () => [
      {
        accessorKey: "no",
        header: "COURSE NO",
        Cell: ({ row }) =>
          row.original.moduleId ? (
            <Link href={`/course/${encodeId(row.original.moduleId)}`}>
              <span className="bg-[#3482AE] text-white px-2 py-1 rounded text-xs font-semibold cursor-pointer">
                {row.original.no || "N/A"}
              </span>
            </Link>
          ) : (
            <span className="bg-[#adb5bd] text-white px-2 py-1 rounded text-xs font-semibold">
              {row.original.no || "N/A"}
            </span>
          ),
      },
      { accessorKey: "empCode", header: "EMPLOYEE CODE" },
      { accessorKey: "empName", header: "EMPLOYEE NAME" },
      { accessorKey: "designation", header: "DESIGNATION" },
      { accessorKey: "course", header: "COURSE" },
      // The year on its own, ahead of the span it belongs to. KRA QUARTER
      // carries the same year inside its dates, but buried in prose the eye has
      // to parse — and for quarter 4 the dates read as the NEXT calendar year,
      // so the column beside it is the only place the financial year is stated
      // plainly. Derived the same way the filter above matches, so the two can
      // never disagree.
      {
        id: "financialYear",
        header: "YEAR",
        accessorFn: (row) => row.financialYear || "",
        Cell: ({ row }) => row.original.financialYear || "—",
      },
      { accessorKey: "kraQuarter", header: "KRA QUARTER" },
      { accessorKey: "grade", header: "GRADE" },
      {
        accessorKey: "feedback",
        header: "FEEDBACK",
        enableColumnFilter: false,
        enableSorting: false,
        // Opens what the employee actually submitted, not the blank form. This
        // used to link to /course/<id>/feedback, which is the learner's own
        // form for their own course — an officer following it either got the
        // access guard or, on a course of their own, an empty form to fill in.
        Cell: ({ row }) =>
          row.original.moduleId ? (
            <button
              type="button"
              onClick={() => setViewing(row.original)}
              className="cursor-pointer rounded bg-[#20c997] px-2 py-1 text-xs font-semibold text-white transition hover:bg-[#1aa179]"
            >
              VIEW
            </button>
          ) : (
            <Box sx={{ fontFamily: "Exo", fontSize: "12px", color: "#6b7280" }}>-</Box>
          ),
      },
      {
        accessorKey: "status",
        header: "STATUS",
        Cell: ({ cell }) => {
          const config = getCourseStatusConfig(cell.getValue());
          return (
            <Chip
              label={config.text}
              size="small"
              sx={{
                backgroundColor: config.bgColor,
                color: config.color,
                fontWeight: 600,
                fontSize: "11px",
                fontFamily: "Exo",
                border: `1px solid ${config.color}`,
              }}
            />
          );
        },
      },
    ],
    []
  );

  const getExportData = () =>
    rows.map((item) => ({
      "COURSE NO": item.no,
      "EMPLOYEE CODE": item.empCode,
      "EMPLOYEE NAME": item.empName,
      DESIGNATION: item.designation,
      COURSE: item.course,
      YEAR: item.financialYear || "",
      "KRA QUARTER": item.kraQuarter,
      GRADE: item.grade,
      STATUS: getCourseStatusConfig(item.status).text,
    }));

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(getExportData());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Course Status");
    XLSX.writeFile(wb, "course-status.xlsx");
  };

  const handleExportPDF = () => {
    const doc = new jsPDF("landscape");
    const rows = getExportData();
    autoTable(doc, {
      head: [Object.keys(rows[0] || {})],
      body: rows.map((r) => Object.values(r)),
    });
    doc.save("course-status.pdf");
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
              <button onClick={onRetry} className="ml-2 text-blue-600 hover:underline">
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
              <div className="p-4 text-center text-gray-500">
                No course status records found
              </div>
            )}
          />
        )}
      </div>

      {viewing ? (
        <FeedbackResponseDialog
          row={viewing}
          onClose={() => setViewing(null)}
        />
      ) : null}
    </div>
  );
}
