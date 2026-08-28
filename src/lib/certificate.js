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
 * One percent of the sheet's width, as a percentage of its height. Every
 * measurement below is in percent-of-width — the unit `cqw` gives the HTML and
 * the only unit that keeps a blank the same size at any zoom — so anything
 * vertical has to be converted through this before it can be a `top`.
 */
const WIDTH_PCT_IN_HEIGHT = 3508 / 2480;

/**
 * Arial on screen, Helvetica in the PDF: the same metrics, so a blank measured
 * against its rule in one rendering fits the same way in the other. Left to
 * inherit the application's own typeface, the two would size text differently.
 */
export const CERT_FONT = "Arial, Helvetica, sans-serif";

/**
 * Each blank is described by the rule the artwork prints under it, not by a
 * guessed centre: `rule` is that rule's y and `left` its midpoint, `maxWidth`
 * the room between its two ends, and `size` the text's height. All four are
 * percentages of the sheet — `rule` of its height, the rest of its width.
 *
 * The numbers are measured off TrainingCertificate.jpg itself, so text lands on
 * the rules rather than near them; re-measure if the artwork is ever replaced.
 */
export const CERT_FIELDS = [
  { key: "name", rule: 37.82, left: 49.71, maxWidth: 51.5, size: 2.4, weight: 700 },
  { key: "course", rule: 45.81, left: 65.05, maxWidth: 21.0, size: 1.5, weight: 600 },
  { key: "date", rule: 54.35, left: 47.95, maxWidth: 12.8, size: 1.5, weight: 400 },
  { key: "grade", rule: 62.18, left: 52.85, maxWidth: 12.8, size: 1.8, weight: 700 },
];

/**
 * How far a blank's baseline sits above its rule, in ems of that blank's own
 * text — the gap that makes the text read as written ON the line rather than
 * struck through it. One shared figure is what keeps the four looking aligned
 * with each other even though they are set at three different sizes.
 */
const BASELINE_LIFT = 0.22;

/**
 * Where Arial's line box has its centre, above the baseline, at `line-height:
 * 1`. The HTML centres each blank on its coordinates with a -50%/-50%
 * translate, so this is the step from the baseline the PDF works in to the
 * centre the browser works in.
 */
const CENTRE_ABOVE_BASELINE = 0.3465;

/**
 * The size to set a blank at so it stays between its rule's ends: the field's
 * own size, or as much less as a long name or course title needs.
 *
 * @param {(typeof CERT_FIELDS)[number]} field
 * @param {number} width what the text measures at `field.size`, as a percentage
 *   of the sheet's width.
 */
export const certFitSize = (field, width) =>
  width > field.maxWidth ? (field.size * field.maxWidth) / width : field.size;

/** Where the HTML centres a blank set at `size`: a percentage of the height. */
export const certCentreTop = (field, size) =>
  field.rule - (BASELINE_LIFT + CENTRE_ABOVE_BASELINE) * size * WIDTH_PCT_IN_HEIGHT;

/** Where the PDF puts its baseline: a percentage of the sheet's height. */
export const certBaselineTop = (field, size) =>
  field.rule - BASELINE_LIFT * size * WIDTH_PCT_IN_HEIGHT;

/** Measures on demand, then keeps the canvas — one per document, not per name. */
let measurer;

/**
 * What `text` measures at `field.size`, as a percentage of the sheet's width —
 * the figure {@link certFitSize} shrinks against.
 *
 * Returns 0 where there is no document to measure in, which asks for no
 * shrinking: the sheet is only ever drawn from a record the browser fetched, so
 * this is the server rendering a certificate it has no values for yet.
 */
export function certTextWidth(text, field) {
  if (typeof document === "undefined") return 0;
  measurer = measurer || document.createElement("canvas").getContext("2d");
  if (!measurer) return 0;
  // Measured at 100px and scaled: text width is proportional to font size, so
  // one measurement answers for whatever size the blank ends up set at.
  measurer.font = `${field.weight} 100px ${CERT_FONT}`;
  return (measurer.measureText(String(text ?? "")).width / 100) * field.size;
}

/**
 * The four blanks, read off a completed-course row.
 *
 * Shared rather than built at each call site: the sheet on screen and the PDF
 * the download writes are fed from the same row, and a name or a grade derived
 * one way in one place and another way in the other would have the two say
 * different things about the same course.
 *
 * The name is the employee record's own, never the signed-in display name —
 * that one falls back to an employee code, and a certificate reading "RG1234"
 * is worse than one reading nothing. A grade of "-" is the grid's way of
 * writing "none yet", which belongs on no certificate.
 *
 * @param {{empName?: string, name?: string, regDate?: string, grade?: string}} row
 * @returns {{name: string, course: string, date: string, grade: string}}
 */
export const certValues = (row) => ({
  name: (row?.empName || "").toUpperCase(),
  course: (row?.name || "").toUpperCase(),
  date: row?.regDate || "",
  grade: (row?.grade === "-" ? "" : row?.grade || "").toUpperCase(),
});

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
    .replace(/[\/:*?"<>|]+/g, " ")
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

  const pt = (size) => (size / 100) * width * MM_TO_PT;

  for (const field of CERT_FIELDS) {
    const text = String(values[field.key] ?? "");
    doc.setFont("helvetica", field.weight >= 700 ? "bold" : "normal");

    // Measured at the field's own size, then set again at whatever size that
    // measurement allows — the same fit the sheet makes on screen.
    doc.setFontSize(pt(field.size));
    const size = certFitSize(field, (doc.getTextWidth(text) / width) * 100);
    if (size !== field.size) doc.setFontSize(pt(size));

    doc.text(
      text,
      (field.left / 100) * width,
      (certBaselineTop(field, size) / 100) * height,
      // jsPDF sets text on its baseline, which is what certBaselineTop gives;
      // the centring is the -50% the sheet's own transform makes.
      { align: "center" }
    );
  }

  doc.save(`${safeName(`Certificate - ${values.course}`)}.pdf`);
}
