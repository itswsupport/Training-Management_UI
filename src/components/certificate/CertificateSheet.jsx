"use client";

import { useMemo } from "react";

import {
  CERT_ARTWORK,
  CERT_ASPECT,
  CERT_FIELDS,
  CERT_FONT,
  CERT_INK,
  certCentreTop,
  certFitSizeLines,
  certLineLift,
  certLines,
} from "@/lib/certificate";

/**
 * The certificate as it appears on screen — the artwork with the four blanks
 * written over it.
 *
 * Its own component because two places draw this sheet: the /certificate page
 * COMPLETED COURSES links to, and — in the same coordinates, through
 * CERT_FIELDS — the PDF the download writes. A blank that moved in one and not
 * the other would print over the artwork's own lettering.
 *
 * @param {object} props
 * @param {{name: string, course: string, date: string, grade: string}} props.values
 * @param {string} [props.className] laid on the sheet itself, for the minimum
 *   width and print overrides each caller needs differently.
 */
export default function CertificateSheet({ values, className = "" }) {
  // Each blank is written on a printed rule of fixed length, so its text is
  // measured before it is placed: it is never allowed to run past the ends of
  // its rule and into the artwork's own words. A blank that may use two lines
  // takes the second before it gives up any size — the course rule is the
  // shortest on the sheet, and shrinking a real course title to fit it on one
  // line left it a quarter the height of the name above it.
  const blanks = useMemo(
    () =>
      CERT_FIELDS.map((field) => {
        const lines = certLines(String(values?.[field.key] ?? ""), field);
        const size = certFitSizeLines(field, lines);
        const centre = certCentreTop(field, size);
        return {
          field,
          size,
          // Last line on the rule, earlier ones stacked above it.
          rows: lines.map((text, index) => ({
            text,
            top: centre - certLineLift(index, lines.length, size),
          })),
        };
      }),
    [values]
  );

  return (
    <div
      className={`relative mx-auto block w-full ${className}`}
      // `containerType` is what makes `cqw` below a percentage of the sheet's
      // own width, which is the unit the PDF works in too.
      style={{ containerType: "inline-size", aspectRatio: CERT_ASPECT }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={CERT_ARTWORK}
        alt="Certificate of Training"
        className="absolute inset-0 h-full w-full"
      />
      {blanks.flatMap(({ field, size, rows }) =>
        rows.map(({ text, top }, index) => (
        <span
          key={`${field.key}-${index}`}
          className="absolute whitespace-nowrap"
          style={{
            left: `${field.left}%`,
            top: `${top}%`,
            transform: "translate(-50%, -50%)",
            fontFamily: CERT_FONT,
            fontSize: `${size}cqw`,
            fontWeight: field.weight,
            // The height certCentreTop measures its offset against — leave it
            // to the application's own line spacing and every blank drifts.
            lineHeight: 1,
            color: CERT_INK,
          }}
        >
          {text}
        </span>
        ))
      )}
    </div>
  );
}
