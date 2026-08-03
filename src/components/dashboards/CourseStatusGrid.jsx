"use client";

import React from "react";
import Link from "next/link";
import { Box, Chip } from "@mui/material";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import ExoMaterialTable from "@/components/ui/common/ExoMaterialTable";
import ExportActions from "@/components/ui/common/ExportActions";
import { getCourseStatusConfig } from "@/lib/statusConfig";

export default function CourseStatusGrid({
  data = [],
  loading = false,
  error = null,
  onRetry,
  title = "COURSE STATUS",
  headerColor = "#20c997",
}) {
  const columns = React.useMemo(
    () => [
      {
        accessorKey: "no",
        header: "COURSE NO",
        Cell: ({ row }) =>
          row.original.moduleId ? (
            <Link href={`/course/${row.original.moduleId}`}>
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
      { accessorKey: "kraQuarter", header: "KRA QUARTER" },
      { accessorKey: "grade", header: "GRADE" },
      {
        accessorKey: "feedback",
        header: "FEEDBACK",
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ row }) =>
          row.original.moduleId ? (
            <Link href={`/course/${row.original.moduleId}/feedback`}>
              <span className="bg-[#20c997] text-white px-2 py-1 rounded text-xs font-semibold cursor-pointer">
                VIEW
              </span>
            </Link>
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
    data.map((item) => ({
      "COURSE NO": item.no,
      "EMPLOYEE CODE": item.empCode,
      "EMPLOYEE NAME": item.empName,
      DESIGNATION: item.designation,
      COURSE: item.course,
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
              <div className="p-4 text-center text-gray-500">
                No course status records found
              </div>
            )}
          />
        )}
      </div>
    </div>
  );
}
