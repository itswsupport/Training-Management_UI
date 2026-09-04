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
 * `maxLines` is how many lines the blank may use before it starts shrinking.
 * Only the course carries one: its rule is the shortest on the sheet at 21% of
 * the width, and a real course title — "PREVENTION OF SEXUAL HARASSMENT- (POSH
 * ACT 2013)" — had to be set at about a quarter of the name's size to fit on a
 * single line, which is unreadable in print. There is nothing above that rule
 * until the name's, so a second line has somewhere to go.
 *
 * The numbers are measured off TrainingCertificate.jpg itself, so text lands on
 * the rules rather than near them; re-measure if the artwork is ever replaced.
 */
export const CERT_FIELDS = [
  { key: "name", rule: 37.82, left: 49.71, maxWidth: 51.5, size: 2.4, weight: 700 },
  { key: "course", rule: 45.81, left: 65.05, maxWidth: 21.0, size: 1.5, weight: 600, maxLines: 2 },
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

/** How far below a line the next one sits, in ems of their shared size. */
const LINE_SPACING = 1.15;

/**
 * A blank's text, broken into the lines it will actually be set on.
 *
 * One line wherever it fits — breaking a title that never needed breaking would
 * only make the sheet look ragged. Past that, the split chosen is the one whose
 * WIDEST line is narrowest, because that widest line is what {@link certFitSize}
 * measures against: balancing the two halves is what buys the size back.
 *
 * Words are never broken, so a single word longer than the rule still falls
 * through to shrinking — which is the right answer for one, and the wrong one
 * for the four-word titles this exists for.
 *
 * @param {string} text
 * @param {(typeof CERT_FIELDS)[number]} field
 * @returns {string[]} one entry per line, in order
 */
export function certLines(text, field) {
  const value = String(text ?? "");
  const words = value.trim().split(/\s+/).filter(Boolean);

  // Server-side `certTextWidth` returns 0, so this also covers the render that
  // has no document to measure in: one line, unshrunk, same as before.
  if ((field.maxLines ?? 1) < 2 || words.length < 2) return [value];
  if (certTextWidth(value, field) <= field.maxWidth) return [value];

  let best = null;
  for (let i = 1; i < words.length; i += 1) {
    const head = words.slice(0, i).join(" ");
    const tail = words.slice(i).join(" ");
    const widest = Math.max(
      certTextWidth(head, field),
      certTextWidth(tail, field)
    );
    if (!best || widest < best.widest) best = { widest, lines: [head, tail] };
  }
  return best ? best.lines : [value];
}

/** The size that fits every one of a blank's lines between its rule's ends. */
export const certFitSizeLines = (field, lines) =>
  certFitSize(
    field,
    lines.reduce((widest, line) => Math.max(widest, certTextWidth(line, field)), 0)
  );

/**
 * How far line `index` of `count` sits above the blank's rule, in percent of
 * the sheet's height.
 *
 * The LAST line is the one written on the rule and any earlier line stacks
 * above it, so a title that grew to two lines still reads as written on the
 * line rather than floating over it.
 */
export const certLineLift = (index, count, size) =>
  (count - 1 - index) * size * LINE_SPACING * WIDTH_PCT_IN_HEIGHT;

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

    // Broken and measured exactly as the sheet on screen does it, so the two
    // renderings put the same words on the same lines at the same size.
    doc.setFontSize(pt(field.size));
    const lines = certLines(text, field);
    const size = certFitSize(
      field,
      lines.reduce(
        (widest, line) => Math.max(widest, (doc.getTextWidth(line) / width) * 100),
        0
      )
    );
    if (size !== field.size) doc.setFontSize(pt(size));

    lines.forEach((line, index) => {
      const top =
        certBaselineTop(field, size) - certLineLift(index, lines.length, size);
      doc.text(
        line,
        (field.left / 100) * width,
        (top / 100) * height,
        // jsPDF sets text on its baseline, which is what certBaselineTop gives;
        // the centring is the -50% the sheet's own transform makes.
        { align: "center" }
      );
    });
  }

  doc.save(`${safeName(`Certificate - ${values.course}`)}.pdf`);
}
