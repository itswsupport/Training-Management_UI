"use client";

import { useMemo } from "react";

import {
  CERT_ARTWORK,
  CERT_ASPECT,
  CERT_FIELDS,
  CERT_FONT,
  CERT_INK,
  certCentreTop,
  certFitSize,
  certTextWidth,
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
  // measured before it is placed: a long name or course title is set smaller
  // rather than run past the ends of its rule and into the artwork's own words.
  const blanks = useMemo(
    () =>
      CERT_FIELDS.map((field) => {
        const text = String(values?.[field.key] ?? "");
        const size = certFitSize(field, certTextWidth(text, field));
        return { field, text, size, top: certCentreTop(field, size) };
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
      {blanks.map(({ field, text, size, top }) => (
        <span
          key={field.key}
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
      ))}
    </div>
  );
}
