"use client";

import React from "react";
import { FileText, Download, Printer, Table } from "lucide-react";

export default function ExportActions({ onExcel, onPDF, onPrint, onTableExport, onExportExcel, onExportPDF }) {
  const actions = [
    { handler: onExcel || onExportExcel, icon: FileText, label: "EXPORT TO EXCEL" },
    { handler: onPDF || onExportPDF, icon: Download, label: "EXPORT TO PDF" },
    { handler: onTableExport, icon: Table, label: "TABLE EXPORT" },
    { handler: onPrint, icon: Printer, label: "PRINT" },
  ].filter(action => action.handler); // Only show buttons with handlers

  return (
    <div className="flex items-center space-x-2">
      {actions.map(({ handler, icon: Icon, label }) => (
        <button
          key={label}
          onClick={handler}
          className="flex items-center gap-2 px-4 py-2 bg-[#3482AE] text-white text-sm font-semibold rounded shadow hover:bg-[#2a6a8f] transition-colors cursor-pointer"
        >
          <Icon className="w-4 h-4" />
          {label}
        </button>
      ))}
    </div>
  );
}
