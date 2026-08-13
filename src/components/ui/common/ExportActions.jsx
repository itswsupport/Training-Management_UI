"use client";

import React from "react";
import { FileText, Download, Printer, Table } from "lucide-react";

/**
 * The export / print row above a grid.
 *
 * Each action carries a `short` label as well as its full one. On a phone the
 * full labels do not fit: "EXPORT TO EXCEL" and "EXPORT TO PDF" are three words
 * each, and in a row that could not wrap they were squashed to a sliver or
 * pushed off the edge — which is why PRINT looked right beside them and they
 * did not. It was never the buttons, only the length of what they say.
 *
 * The short label is not an abbreviation of the action, it IS the action: the
 * icon beside it already says "export", so "EXCEL" and "PDF" lose nothing. The
 * full wording stays on the tooltip and as the accessible name, so nothing is
 * lost to a screen reader either.
 */
export default function ExportActions({ onExcel, onPDF, onPrint, onTableExport, onExportExcel, onExportPDF }) {
  const actions = [
    { handler: onExcel || onExportExcel, icon: FileText, label: "EXPORT TO EXCEL", short: "EXCEL" },
    { handler: onPDF || onExportPDF, icon: Download, label: "EXPORT TO PDF", short: "PDF" },
    { handler: onTableExport, icon: Table, label: "TABLE EXPORT", short: "TABLE" },
    { handler: onPrint, icon: Printer, label: "PRINT", short: "PRINT" },
  ].filter(action => action.handler); // Only show buttons with handlers

  return (
    // Wraps rather than overflows: three or four of these on a narrow screen
    // belong on two lines, not on one line that runs off the side of the grid.
    <div className="flex flex-wrap items-center gap-2">
      {actions.map(({ handler, icon: Icon, label, short }) => (
        <button
          key={label}
          onClick={handler}
          title={label}
          aria-label={label}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded bg-[#3482AE] px-2.5 py-1.5 text-xs font-semibold text-white shadow transition-colors hover:bg-[#2a6a8f] sm:gap-2 sm:px-4 sm:py-2 sm:text-sm"
        >
          <Icon className="h-4 w-4 shrink-0" />
          {/* Same button, two labels — the long one only once there is room. */}
          <span className="hidden sm:inline">{label}</span>
          <span className="sm:hidden">{short}</span>
        </button>
      ))}
    </div>
  );
}
