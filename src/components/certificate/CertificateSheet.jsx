"use client";

import {
  CERT_ARTWORK,
  CERT_ASPECT,
  CERT_FIELDS,
  CERT_INK,
} from "@/lib/certificate";

/**
 * The certificate as it appears on screen — the artwork with the four blanks
 * written over it.
 *
 * Its own component because three places draw this sheet now: the dialog the
 * employee opens from COMPLETED COURSES, the standalone /certificate route a
 * bookmark still reaches, and — in the same coordinates, through CERT_FIELDS —
 * the PDF the download writes. A blank that moved in one and not the others
 * would print over the artwork's own lettering.
 *
 * @param {object} props
 * @param {{name: string, course: string, date: string, grade: string}} props.values
 * @param {string} [props.className] laid on the sheet itself, for the minimum
 *   width and print overrides each caller needs differently.
 */
export default function CertificateSheet({ values, className = "" }) {
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
      {CERT_FIELDS.map((f) => (
        <span
          key={f.key}
          className="absolute whitespace-nowrap"
          style={{
            left: `${f.left}%`,
            top: `${f.top}%`,
            transform: "translate(-50%, -50%)",
            fontSize: `${f.size}cqw`,
            fontWeight: f.weight,
            color: CERT_INK,
          }}
        >
          {values[f.key]}
        </span>
      ))}
    </div>
  );
}
