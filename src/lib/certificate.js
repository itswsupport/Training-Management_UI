"use client";

import { jsPDF } from "jspdf";

/**
 * The training certificate: where its four printed blanks sit, and how to turn
 * one into a PDF the browser downloads.
 *
 * The positions live here rather than on the certificate page because two
 * places draw the same sheet — the page, in HTML, and the download, in a PDF —
 * and a blank that moved in one but not the other would print over the
 * artwork's own lettering.
 */

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "/etms";

export const CERT_ARTWORK = `${BASE_PATH}/TrainingCertificate.jpg`;
export const CERT_INK = "#2c0862";

/** The artwork's pixel size — the PDF page is drawn to the same proportions. */
export const CERT_ASPECT = "3508 / 2480";

/**
 * Each blank as a percentage of the sheet: `left`/`top` are its centre, `size`
 * is its height as a percentage of the sheet's WIDTH (what `cqw` means in the
 * HTML version, and what keeps the two renderings the same size).
 */
export const CERT_FIELDS = [
  { key: "name", left: 50.5, top: 36.8, size: 2.4, weight: 700 },
  { key: "course", left: 66, top: 44, size: 1.5, weight: 600 },
  { key: "date", left: 48, top: 52, size: 1.5, weight: 400 },
  { key: "grade", left: 53, top: 61, size: 1.8, weight: 700 },
];

/** jsPDF measures text in points; the page is laid out in millimetres. */
const MM_TO_PT = 72 / 25.4;

/** Resolves with the artwork once the browser has it decoded. */
const loadArtwork = () =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error("The certificate artwork could not be loaded."));
    img.src = CERT_ARTWORK;
  });

/** A filename that survives Windows, macOS and Linux alike. */
const safeName = (text) =>
  String(text ?? "")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "certificate";

/**
 * Writes the certificate to a PDF and hands it to the browser as a download.
 *
 * A real file, not the print dialog: printing depended on the employee picking
 * "Save as PDF" from their own printer list, and produced browser headers and
 * margins around the sheet when they did not.
 *
 * @param {{name: string, course: string, date: string, grade: string}} values
 */
export async function downloadCertificate(values) {
  const artwork = await loadArtwork();

  // A4 landscape is 297 × 210mm — the artwork's own 1.414 proportions, so it
  // fills the page edge to edge with nothing cropped and no margin.
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();

  doc.addImage(artwork, "JPEG", 0, 0, width, height);
  doc.setTextColor(CERT_INK);

  for (const field of CERT_FIELDS) {
    doc.setFont("helvetica", field.weight >= 700 ? "bold" : "normal");
    doc.setFontSize((field.size / 100) * width * MM_TO_PT);
    doc.text(
      String(values[field.key] ?? ""),
      (field.left / 100) * width,
      (field.top / 100) * height,
      // The HTML centres each blank on its coordinates with a -50%/-50%
      // translate; these two options are that same centring.
      { align: "center", baseline: "middle" }
    );
  }

  doc.save(`${safeName(`Certificate - ${values.course}`)}.pdf`);
}
