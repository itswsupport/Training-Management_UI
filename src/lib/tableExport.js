"use client";

/**
 * Excel / PDF / print exports for the data grids.
 *
 * Every heavy library (SheetJS, jsPDF) is imported lazily so a page that never
 * exports never pays for them.
 */

/** Data columns only — display/action columns have no accessorKey to export. */
function exportableColumns(columns) {
  return columns
    .filter((c) => typeof c.accessorKey === "string" && typeof c.header === "string")
    .map((c) => ({ header: c.header, key: c.accessorKey }));
}

function matrix(rows, cols) {
  return {
    headers: cols.map((c) => c.header),
    body: rows.map((r) => cols.map((c) => (r[c.key] == null ? "" : String(r[c.key])))),
  };
}

/** Download the rows as a real .xlsx workbook. */
export async function exportExcel(rows, columns, title) {
  const XLSX = await import("xlsx");
  const { headers, body } = matrix(rows, exportableColumns(columns));
  const ws = XLSX.utils.aoa_to_sheet([headers, ...body]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, `${title}.xlsx`);
}

/** Download the rows as a landscape PDF with a teal header. */
export async function exportPdf(rows, columns, title) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const { headers, body } = matrix(rows, exportableColumns(columns));
  const doc = new jsPDF({ orientation: "landscape" });
  doc.text(title, 14, 14);
  autoTable(doc, {
    head: [headers],
    body,
    startY: 20,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [52, 130, 174], textColor: 255 },
    alternateRowStyles: { fillColor: [244, 246, 249] },
  });
  doc.save(`${title}.pdf`);
}

/** Open a print-ready window with a bordered/striped table, then print. */
export function printTable(rows, columns, title) {
  const { headers, body } = matrix(rows, exportableColumns(columns));
  const esc = (s) =>
    s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);
  const thead = `<tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr>`;
  const tbody = body
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
    .join("");

  const html = `<!doctype html><html><head><title>${esc(title)}</title><style>
    body{font-family:Exo,Arial,sans-serif;padding:16px;color:#212529;}
    h2{color:#3482AE;font-size:16px;margin:0 0 12px;text-transform:uppercase;}
    table{width:100%;border-collapse:collapse;font-size:12px;}
    th,td{border:1px solid #dee2e6;padding:6px 8px;text-align:left;}
    th{background:#f4f6f9;text-transform:uppercase;font-weight:700;color:#495057;}
    tbody tr:nth-child(odd){background:rgba(0,0,0,0.03);}
  </style></head><body><h2>${esc(title)}</h2><table><thead>${thead}</thead><tbody>${tbody}</tbody></table></body></html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}
