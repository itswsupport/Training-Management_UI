"use client";

import React from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Download, Eye } from "lucide-react";

import ExoMaterialTable from "@/components/ui/common/ExoMaterialTable";
import ExportActions from "@/components/ui/common/ExportActions";
import { audienceColumns, audienceFull } from "@/lib/audienceColumns";
import { alerts } from "@/lib/alerts";
import { certValues, downloadCertificate } from "@/lib/certificate";
import { encodeId } from "@/lib/courseId";
import { quarterLabel } from "@/services/MasterDataService";

export default function CompletedCoursesGrid({
  data = [],
  loading = false,
  error = null,
  onRetry,
  title = "COMPLETED COURSES",
  headerColor = "#20c997",
  // id → name for the COMPANY and PLANT columns; see useMasterNames.
  companyNames = {},
  plantNames = {},
}) {
  // Which row is being written, so its icon cannot be clicked twice while the
  // artwork loads.
  const [downloading, setDownloading] = React.useState(null);

  // Already filtered by the backend — see ModulesGrid.
  const rows = data;

  const handleDownload = React.useCallback(async (row) => {
    setDownloading(row.id);
    try {
      await downloadCertificate(certValues(row));
    } catch (err) {
      alerts.toast.error(
        err?.message || "Could not build the certificate. Please try again."
      );
    } finally {
      setDownloading(null);
    }
  }, []);

  const columns = React.useMemo(
    () => [
      {
        accessorKey: "no",
        header: "COURSE NO",
        Cell: ({ row }) => (
          <Link href={`/course/${encodeId(row.original.id)}`}>
            <span className="bg-[#3482AE] text-white px-2 py-1 rounded text-xs font-semibold cursor-pointer">
              {row.original.no || "N/A"}
            </span>
          </Link>
        ),
      },
      ...audienceColumns(companyNames, plantNames),
      { accessorKey: "name", header: "COURSE NAME" },
      { accessorKey: "category", header: "COURSE CATEGORY" },
      { accessorKey: "instructor", header: "COURSE INSTRUCTOR" },
      // The pair the filter bar above works on, the same two ModulesGrid shows
      // on the other three tabs — a learner switching tabs sees one table, not
      // two shapes of one. Courses raised before the quarter field exists carry
      // none, hence the dash rather than a guess.
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
      { accessorKey: "grade", header: "GRADE" },
      {
        id: "completedDate",
        header: "COMPLETED ON",
        accessorFn: (row) => row.completedOn?.date || "",
        // Sorted on the stamp, not on "27-07-2026" — text order puts every
        // 01- before every 02- whatever the year.
        sortingFn: (a, b) =>
          (a.original.completedValue ?? 0) - (b.original.completedValue ?? 0),
        Cell: ({ row }) => row.original.completedOn?.date || "—",
      },
      {
        accessorKey: "certificate",
        header: "CERTIFICATE",
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ row }) => (
          <span className="flex items-center gap-3 text-[#3482AE]">
            {/* The certificate opens inside the application — a Link, not a
                second browser tab, so the sidebar and header stay and the sheet
                is one screen of the app rather than a document dropped
                somewhere else.

                It carries only the course id: the certificate page reads the
                name / course / date / grade from the signed-in employee's own
                completed record, so the values cannot be forged by editing the
                URL. */}
            <Link
              href={`/certificate?id=${encodeId(row.original.id)}`}
              title="View certificate"
              aria-label="View certificate"
              className="hover:text-[#2a6a8f]"
            >
              <Eye className="w-4 h-4" />
            </Link>
            <button
              type="button"
              onClick={() => handleDownload(row.original)}
              disabled={downloading === row.original.id}
              title="Download certificate (PDF)"
              aria-label="Download certificate"
              className="cursor-pointer hover:text-[#2a6a8f] disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
            </button>
          </span>
        ),
      },
    ],
    // `downloading` is read inside a Cell, so the columns have to be rebuilt
    // when it changes or the icon would never show as busy. The name maps are
    // fetched and arrive later, for the same reason.
    [downloading, handleDownload, companyNames, plantNames]
  );

  const getExportData = () =>
    rows.map((item) => ({
      "COURSE NO": item.no,
      COMPANY: audienceFull(item.compIds, companyNames),
      "PLANT CODE": audienceFull(item.plantIds, plantNames),
      "COURSE NAME": item.name,
      "COURSE CATEGORY": item.category,
      "COURSE INSTRUCTOR": item.instructor,
      "FINANCIAL YEAR": item.financialYear || "",
      QUARTER: quarterLabel(item.quarter),
      GRADE: item.grade,
      "COMPLETED ON": item.completedOn?.date || "",
    }));

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(getExportData());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Completed Courses");
    XLSX.writeFile(wb, "completed-courses.xlsx");
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    // Driven by the export rows rather than by `columns`: the date columns are
    // built from an accessorFn and have no accessorKey to read a value by, so
    // reading the column list left both of them blank in every row. It also
    // drops the certificate column, which the old filter had to do by hand.
    const rows = getExportData();
    const headers = Object.keys(rows[0] ?? {});
    autoTable(doc, {
      head: [headers],
      body: rows.map((row) => headers.map((h) => row[h] ?? "")),
    });
    doc.save("completed-courses.pdf");
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
                No completed courses found
              </div>
            )}
          />
        )}
      </div>
    </div>
  );
}
