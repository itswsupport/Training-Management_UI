"use client";

import {
  ChevronLeft,
  Download,
  Eye,
  GraduationCap,
  Home,
  LogOut,
  Menu,
  User,
  UserCheck,
} from "lucide-react";

import { BRAND, TABLE_HEAD_BG } from "@/lib/palette";
import { gradient } from "@/components/userGuide/GuideArt";

/**
 * A drawing of a screen in ETMS — the manual's stand-in for a screenshot.
 *
 * Drawn rather than captured for the same reason the forms are: a screenshot
 * goes stale the moment a column is renamed or a colour changes, and it carries
 * whatever real employee data happened to be on screen when it was taken. These
 * use the same column headings and the same palette as the real grids, so they
 * stay honest and contain nobody's data.
 */

/** A cell is either plain text or a coloured status pill. */
function Cell({ value }) {
  if (value && typeof value === "object" && value.pill) {
    return (
      <span
        className="inline-block rounded px-2 py-0.5 text-[10.5px] font-bold tracking-wide text-white uppercase"
        style={{ backgroundColor: value.pill }}
      >
        {value.text}
      </span>
    );
  }
  if (value === "@certificate") {
    return (
      <span className="flex items-center gap-2 text-[#3482AE]">
        <Eye className="h-3.5 w-3.5" />
        <Download className="h-3.5 w-3.5" />
      </span>
    );
  }
  return <span className="text-gray-700">{value}</span>;
}

/** The status-tile row that sits above most grids. */
function Tiles({ items }) {
  return (
    <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map(({ label, color, active }) => (
        <div
          key={label}
          className={`rounded px-2 py-2.5 text-center text-[10px] font-bold tracking-wide text-white uppercase ${
            active ? "ring-2 ring-gray-800/25" : "opacity-70"
          }`}
          style={{ backgroundImage: gradient(color, 160) }}
        >
          {label}
        </div>
      ))}
    </div>
  );
}

/** The white card with a coloured title bar that every grid sits in. */
function Panel({ title, color = BRAND, columns, rows }) {
  return (
    <div className="overflow-hidden rounded border border-gray-200 bg-white">
      <div className="px-3 py-1.5" style={{ backgroundColor: color }}>
        <p className="text-[11px] font-bold tracking-wide text-white uppercase">
          {title}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[11.5px]">
          <thead>
            <tr style={{ backgroundColor: TABLE_HEAD_BG }}>
              {columns.map((column) => (
                <th
                  key={column}
                  className="border-b border-gray-200 px-3 py-2 text-left text-[10.5px] font-bold tracking-wide whitespace-nowrap text-gray-600 uppercase"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className="border-b border-gray-100 last:border-0">
                {row.map((value, c) => (
                  <td key={c} className="px-3 py-2 whitespace-nowrap">
                    <Cell value={value} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** The certificate sheet, as it appears on the certificate page. */
function CertificateSheet() {
  return (
    <div className="rounded border-4 border-double border-[#3482AE]/40 bg-white px-6 py-7 text-center">
      <p className="text-[10px] font-bold tracking-[0.3em] text-[#3482AE] uppercase">
        Rucha Engineers Pvt. Ltd.
      </p>
      <p className="mt-2 text-[17px] font-bold tracking-wide text-gray-800 uppercase">
        Certificate of Completion
      </p>
      <p className="mt-4 text-[11px] normal-case text-gray-500">
        This is to certify that
      </p>
      <p className="mt-1 border-b border-dotted border-gray-300 pb-1 text-[15px] font-bold normal-case text-gray-800">
        Employee Name
      </p>
      <p className="mt-3 text-[11px] normal-case text-gray-500">
        has successfully completed
      </p>
      <p className="mt-1 text-[13px] font-semibold normal-case text-[#3482AE]">
        Introduction to Workplace Safety
      </p>
      <div className="mt-5 flex items-center justify-center gap-8 text-[11px] normal-case text-gray-500">
        <span>
          Date: <span className="font-semibold text-gray-700">DD-MM-YYYY</span>
        </span>
        <span>
          Grade: <span className="font-semibold text-gray-700">A</span>
        </span>
      </div>
    </div>
  );
}

/** The blue sidebar, exactly as `AppSidebar` builds it. */
function Sidebar({ officer }) {
  const items = [
    { label: "HOME", Icon: Home },
    { label: "USER", Icon: UserCheck, active: !officer },
    ...(officer
      ? [{ label: "TRAINING OFFICER", Icon: GraduationCap, active: true }]
      : []),
    { label: "LOGOUT", Icon: LogOut },
  ];
  return (
    <aside className="hidden w-40 shrink-0 flex-col bg-[#3482AE] text-white sm:flex">
      <div className="border-b border-white/30 px-3 py-2.5">
        <p className="text-[10px] font-bold tracking-[0.12em] whitespace-nowrap">
          REPL ETMS
        </p>
      </div>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-[#f5f5f5]">
          <User className="h-3 w-3 text-[#3482AE]" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[9px] font-semibold normal-case">
            Employee Name
          </p>
          <p className="text-[8px] tracking-wider text-white/70 uppercase">
            [{officer ? "Training Officer" : "User"}]
          </p>
        </div>
      </div>
      <div className="border-t border-white/60" />
      <nav className="py-1">
        {items.map(({ label, Icon, active }) => (
          <div
            key={label}
            className={`flex items-center gap-2 px-3 py-2 text-[9.5px] font-semibold ${
              active ? "bg-[#1e7ca0]" : ""
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{label}</span>
          </div>
        ))}
      </nav>
    </aside>
  );
}

/**
 * @param {object} props
 * @param {string} [props.caption] the line under the drawing
 * @param {boolean} [props.chrome] draw the app's own header bar around it
 * @param {boolean} [props.full] the whole shell — sidebar, header and footer
 * @param {boolean} [props.officer] which sidebar the shell shows
 * @param {string} [props.screenTitle] the page heading beside the BACK button
 * @param {Array} [props.tiles] the status tiles above the panel
 * @param {object} [props.panel] `{title, color, columns, rows}`
 * @param {"certificate"} [props.kind] a sheet instead of a grid
 */
export default function ScreenMock({
  caption,
  chrome,
  full,
  officer,
  screenTitle,
  tiles,
  panel,
  kind,
}) {
  if (full) {
    return (
      <figure className="overflow-hidden rounded-lg border border-gray-300 bg-white shadow-md">
        <div className="flex min-h-[300px]">
          <Sidebar officer={officer} />

          <div className="flex min-w-0 flex-1 flex-col">
            {/* Header bar */}
            <div className="flex items-center justify-between bg-[#3482AE] px-3 py-2 text-white">
              <Menu className="h-4 w-4" />
              <div className="flex items-center gap-4 text-[10px] font-semibold tracking-wide uppercase">
                <span>? Help</span>
                <span>Logout</span>
              </div>
            </div>

            {/* Page body */}
            <div className="flex-1 bg-[#f5f8fa] p-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[11px] font-bold tracking-wide text-[#3482AE] uppercase">
                  {screenTitle}
                </p>
                <span className="flex items-center gap-1 rounded bg-[#3482AE] px-2.5 py-1 text-[9px] font-semibold tracking-wide text-white uppercase">
                  <ChevronLeft className="h-3 w-3" /> Back
                </span>
              </div>
              {tiles ? <Tiles items={tiles} /> : null}
              {panel ? <Panel {...panel} /> : null}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-gray-200 bg-white px-3 py-2 text-[9px] text-gray-600">
              <span>
                Copyright © 2024-2025 Rucha Yantra Pvt. Ltd. All rights
                reserved.
              </span>
              <span className="hidden gap-3 sm:flex">
                <span>Privacy Policy</span>
                <span>Terms of Service</span>
                <span>Contact</span>
              </span>
            </div>
          </div>
        </div>

        {caption ? (
          <figcaption className="border-t border-gray-200 bg-white px-3 py-2 text-[12px] normal-case text-gray-500">
            {caption}
          </figcaption>
        ) : null}
      </figure>
    );
  }

  return (
    <figure className="overflow-hidden rounded-lg border border-gray-200 bg-[#f5f8fa] shadow-sm">
      {chrome ? (
        // The app's own blue bar, so the drawing reads as a screen rather than
        // as another panel inside the manual.
        <div className="flex items-center justify-between bg-[#3482AE] px-3 py-1.5 text-white">
          <div className="flex items-center gap-2">
            <Menu className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold tracking-[0.14em] uppercase">
              REPL ETMS
            </span>
          </div>
          <span className="text-[10px] font-semibold tracking-wide uppercase opacity-80">
            Help · Logout
          </span>
        </div>
      ) : null}

      <div className="p-3">
        {tiles ? <Tiles items={tiles} /> : null}
        {kind === "certificate" ? <CertificateSheet /> : null}
        {panel ? <Panel {...panel} /> : null}
      </div>

      {caption ? (
        <figcaption className="border-t border-gray-200 bg-white px-3 py-2 text-[12px] normal-case text-gray-500">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
