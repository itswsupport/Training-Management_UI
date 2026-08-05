"use client";

import {
  ChevronLeft,
  CircleCheckBig,
  CirclePlay,
  Download,
  Eye,
  GraduationCap,
  Home,
  LogOut,
  Menu,
  Play,
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

/** One lecture in the COURSE CONTENT list, in whichever of its three states. */
function LectureRow({ name, state, action }) {
  const done = state === "done";
  const playing = state === "playing";
  return (
    <div className="flex items-center gap-3 border-b border-gray-100 px-3 py-2 last:border-0">
      {/* As on the course page, the icon doubles as the done tick rather than
          the row carrying a status column of its own. */}
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
          done
            ? "bg-[#20c997]/15 text-[#158765]"
            : playing
              ? "bg-[#3482AE]/15 text-[#3482AE]"
              : "bg-gray-100 text-gray-500"
        }`}
      >
        {done ? (
          <CircleCheckBig className="h-3.5 w-3.5" />
        ) : (
          <CirclePlay className="h-3.5 w-3.5" />
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-[12px] font-semibold normal-case text-gray-700">
        {name}
      </span>
      {done ? (
        <span className="shrink-0 rounded-full bg-[#20c997]/15 px-2.5 py-1 text-[10px] font-bold tracking-wide text-[#158765] uppercase">
          Completed
        </span>
      ) : action ? (
        <span className="shrink-0 rounded bg-[#3482AE] px-3 py-1 text-[10px] font-bold tracking-wide text-white uppercase">
          {action}
        </span>
      ) : null}
    </div>
  );
}

/**
 * The course page's video preview card, and the lecture list under it.
 *
 * The one drawing the grid shapes cannot describe: a video is a picture, and
 * what the manual has to show about it is where the watched counter sits and
 * what a lecture looks like before and after it has been finished. Drawn like
 * the rest of these — see the note at the top of the file.
 */
function PlayerMock({ badge, lecture, note, progress, rows }) {
  const done = rows?.filter((row) => row.state === "done").length ?? 0;

  return (
    <div className="space-y-3">
      {/* The 16:9 stage the player and its thumbnail share, so nothing on the
          real page jumps when playback starts. */}
      <div className="w-full sm:w-[55%]">
        <div className="relative aspect-video w-full overflow-hidden rounded-t bg-[linear-gradient(135deg,#3482AE_0%,#1f4e6b_100%)]">
          {badge ? (
            <span className="absolute top-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[10px] font-semibold normal-case text-white">
              {badge}
            </span>
          ) : null}
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow-lg">
              <Play
                className="h-5 w-5 translate-x-0.5 text-[#3482AE]"
                fill="currentColor"
              />
            </span>
          </span>
          <span className="absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,0.75),transparent)] px-3 pt-6 pb-2 text-[11px] font-semibold normal-case text-white">
            Preview this course
          </span>
        </div>
        {lecture ? (
          <p className="flex items-center gap-1.5 rounded-b border-x border-b border-gray-200 bg-[#fbfcfd] px-3 py-2 text-[11.5px] normal-case text-gray-700">
            <CirclePlay className="h-3.5 w-3.5 shrink-0 text-[#3482AE]" />
            <span className="truncate">{lecture}</span>
          </p>
        ) : null}
      </div>

      {rows?.length ? (
        <div className="overflow-hidden rounded border border-gray-200 bg-white">
          <div className="px-3 py-1.5" style={{ backgroundColor: BRAND }}>
            <p className="text-[11px] font-bold tracking-wide text-white uppercase">
              Course Content
            </p>
          </div>
          {/* The toolbar. A learner is told how far through they are; an officer
              is told that nothing they do here counts. */}
          <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-[#fbfcfd] px-3 py-2">
            <p className="text-[11px] normal-case text-gray-500">
              1 section · {rows.length} lecture{rows.length === 1 ? "" : "s"}
            </p>
            {note ? (
              <span className="rounded bg-[#ffc107]/20 px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#a17200] uppercase">
                {note}
              </span>
            ) : progress ? (
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-200">
                  <span
                    className="block h-full rounded-full bg-[#20c997]"
                    style={{ width: `${(done / rows.length) * 100}%` }}
                  />
                </span>
                <span className="text-[11px] font-semibold normal-case text-gray-600">
                  {progress}
                </span>
              </span>
            ) : null}
          </div>
          {rows.map((row) => (
            <LectureRow key={row.name} {...row} />
          ))}
        </div>
      ) : null}
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
 * @param {"certificate"|"player"} [props.kind] a sheet instead of a grid
 * @param {string} [props.badge] the watched counter over the video
 * @param {string} [props.lecture] which lecture the preview card is playing
 * @param {string} [props.note] the amber strip an officer gets in place of the
 *   learner's progress bar
 * @param {string} [props.progress] that progress bar's label, e.g. "1/3 done"
 * @param {Array} [props.rows] the COURSE CONTENT lectures under the player
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
  badge,
  lecture,
  note,
  progress,
  rows,
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
        {kind === "player" ? (
          <PlayerMock
            badge={badge}
            lecture={lecture}
            note={note}
            progress={progress}
            rows={rows}
          />
        ) : null}
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
