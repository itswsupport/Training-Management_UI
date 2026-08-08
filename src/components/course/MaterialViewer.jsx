"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, X } from "lucide-react";

import PdfReader from "@/components/course/PdfReader";
import useMaterialProgress from "@/hooks/useMaterialProgress";

/** Past this many rows a workbook is shown in part; see SheetView. */
const ROW_LIMIT = 500;

/**
 * How long a workbook or a picture has to be looked at before it counts.
 *
 * Neither has pages to walk through the way a PDF does, so time in front of it
 * is all there is — but it has to be more than the instant it takes to open and
 * close one. A picture is taken in at a glance; a table is not.
 */
const SHEET_SECONDS = 15;
const IMAGE_SECONDS = 5;

/**
 * Counts seconds the material is genuinely being looked at, and calls `onDone`
 * once when there have been enough of them.
 *
 * "Genuinely" is the whole point: a tab in the background or a window that lost
 * focus is not being read, and counting it would make the requirement a formality.
 */
function useDwell(seconds, onDone) {
  const spent = useRef(0);
  const reported = useRef(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!onDone) return undefined;

    const tick = setInterval(() => {
      if (document.visibilityState !== "visible" || !document.hasFocus()) return;
      spent.current += 1;
      setProgress(Math.min(100, Math.round((spent.current / seconds) * 100)));
      if (spent.current >= seconds && !reported.current) {
        reported.current = true;
        onDone();
      }
    }, 1000);

    return () => clearInterval(tick);
  }, [seconds, onDone]);

  return progress;
}

/** The "43% read" pill, in the same place and shape as the video's. */
function ReadBadge({ done, label }) {
  return (
    <span className="absolute top-2 left-2 z-10 rounded bg-black/60 px-2 py-0.5 text-[11px] font-semibold normal-case text-white">
      {done ? "Read" : label}
    </span>
  );
}

/**
 * A lecture's material, read inside the page instead of being handed to the
 * browser.
 *
 * A new tab took the learner out of the course — getting back meant finding the
 * tab again, and on a phone the switch loses the page entirely. Worse for a
 * spreadsheet or an image, which the endpoint marks as an attachment: clicking
 * one only ever produced a download, so the material never appeared on screen
 * at all.
 *
 * It fills the content area rather than the window, so the sidebar, the header
 * and the footer stay where they are and stay usable — the learner is still
 * visibly inside ETMS, one click from the rest of it.
 *
 * @param {object} props
 * @param {"pdf"|"sheet"|"image"} props.kind how the body is rendered
 * @param {string} props.name shown in the bar and read out as the panel's label
 * @param {string} props.url the `/trainingMaterial/file` URL for the document
 * @param {() => void} [props.onRead] called once the material has actually been
 *   read — every page of a PDF, or enough time on a sheet or a picture. Absent
 *   for an officer, who is checking the material rather than working through it.
 * @param {object} [props.material] who is reading what, as
 *   `{empCode, emoduleId, sectionId, lectureId, kind}`. Present only for a
 *   learner: it is what the time spent here is reported against, and an officer
 *   browsing the material has no progress to record.
 * @param {() => void} props.onClose
 */
export default function MaterialViewer({
  kind,
  name,
  url,
  onRead,
  material,
  onClose,
}) {
  const box = useContentBox();

  /**
   * How far through the material the learner is, as the body last reported it.
   *
   * Kept in a ref rather than state because only the heartbeat ever reads it —
   * re-rendering the panel every time a page turns would buy nothing and cost a
   * repaint of the document underneath.
   */
  const coverage = useRef({
    requiredSecs: 0,
    coveragePct: 0,
    position: 0,
    lastPosition: 0,
  });
  const report = useCallback((next) => {
    coverage.current = next;
  }, []);
  const snapshot = useCallback(() => coverage.current, []);

  useMaterialProgress({
    active: Boolean(material?.lectureId),
    material,
    snapshot,
  });

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Only ever rendered from a click, so it is never part of the server's HTML
  // and cannot mismatch on hydration.
  if (typeof document === "undefined") return null;

  return createPortal(
    // Portalled out of the course rather than left in place: a wheel over the
    // panel would otherwise chain up to the page behind and scroll it.
    <div
      className="fixed z-40 flex flex-col overflow-hidden bg-white shadow-lg"
      style={box ?? { top: 0, left: 0, width: "100%", height: "100%" }}
      role="dialog"
      aria-modal="true"
      aria-label={name}
    >
      <div className="flex shrink-0 items-center gap-2 bg-[#3482AE] px-3 py-2 sm:px-4">
        <h2 className="min-w-0 flex-1 truncate text-[13px] font-bold normal-case text-white">
          {name}
        </h2>
        {/* The one thing worth offering beside the document: for a PDF the
            browser's own toolbar covers printing and saving, and for anything
            else this is the way to the file itself. */}
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="hidden shrink-0 items-center gap-1.5 rounded bg-white/15 px-3 py-1.5 text-[11px] font-bold tracking-wide text-white uppercase transition hover:bg-white/25 sm:inline-flex"
        >
          <ExternalLink className="h-3 w-3" />
          {kind === "pdf" ? "Open in new tab" : "Download"}
        </a>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-white transition hover:bg-white/20"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {kind === "sheet" ? (
        <SheetView url={url} onRead={onRead} onCoverage={report} />
      ) : kind === "image" ? (
        <ImageView url={url} name={name} onRead={onRead} onCoverage={report} />
      ) : (
        <PdfView url={url} onRead={onRead} onCoverage={report} />
      )}
    </div>,
    document.body
  );
}

/**
 * The box the panel fills: the page's content area, leaving the sidebar, the
 * header and the footer on screen.
 *
 * Measured rather than assumed — the sidebar slides open and shut, and the
 * header's height follows its own content. Null until it can be read, and for a
 * screen with no shell around it at all, which falls back to the whole window.
 *
 * The footer is subtracted rather than left underneath. It is positioned over
 * the bottom of the same column, so the content area's own height runs behind
 * it and a panel given all of that would cover it. `offsetHeight`, not the
 * bounding rect: the footer slides out of the way on scroll, and a transformed
 * rect would report it as gone and hand the panel the space back.
 */
function useContentBox() {
  const [box, setBox] = useState(null);

  useEffect(() => {
    const main = document.getElementById("main-content");
    if (!main) return;

    const measure = () => {
      const rect = main.getBoundingClientRect();
      const footer = document.getElementById("app-footer");
      setBox({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: Math.max(0, rect.height - (footer?.offsetHeight ?? 0)),
      });
    };
    measure();

    // Collapsing the sidebar resizes the content area under the panel.
    const observer = new ResizeObserver(measure);
    observer.observe(main);
    const footer = document.getElementById("app-footer");
    if (footer) observer.observe(footer);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return box;
}

/**
 * The material's bytes.
 *
 * Everything but a PDF is served with `Content-Disposition: attachment` and no
 * content type, so it has to be fetched rather than pointed at: `fetch` is not
 * bound by that header, which keeps both the browser's download prompt and its
 * `nosniff` handling out of the way.
 */
function useMaterialBytes(url) {
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const buffer = await response.arrayBuffer();
        // The endpoint answers 200 with nothing at all when it cannot read the
        // file, so an empty body is a missing upload, not an empty document.
        if (buffer.byteLength === 0) throw new Error("empty response");
        if (!cancelled) setState({ status: "ready", buffer });
      } catch {
        if (!cancelled) setState({ status: "error" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  return state;
}

function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center bg-white">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#3482AE]" />
    </div>
  );
}

function Failed() {
  return (
    <div className="flex flex-1 items-center justify-center bg-white p-6">
      <p className="text-center text-[13px] normal-case text-[#dc3545]">
        File Not Available
      </p>
    </div>
  );
}

/** `.jpg` → `image/jpeg`. The blob needs a type; the response has none. */
const IMAGE_TYPES = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
};

const imageType = (name) =>
  IMAGE_TYPES[String(name).split(".").pop()?.toLowerCase()] ?? "image/jpeg";

/**
 * A PDF, read page by page.
 *
 * The bytes are fetched here and handed on, so the reader has nothing to do
 * with how the file is served — and the page count it finds is what decides
 * whether the document has been read.
 */
function PdfView({ url, onRead, onCoverage }) {
  const file = useMaterialBytes(url);
  const [pages, setPages] = useState({ read: 0, total: 0 });

  // A PDF is measured in pages, not seconds — there is no fixed time it is
  // worth, so the server is handed coverage and left to decide.
  useEffect(() => {
    onCoverage?.({
      requiredSecs: 0,
      coveragePct: pages.total
        ? Math.round((pages.read / pages.total) * 100)
        : 0,
      // The reader counts pages seen rather than tracking which page is on
      // screen, so how far they have got and where they are are the same
      // number here.
      position: pages.read,
      lastPosition: pages.read,
    });
  }, [pages, onCoverage]);

  if (file.status === "error") return <Failed />;
  if (file.status !== "ready") return <Loading />;

  const done = pages.total > 0 && pages.read >= pages.total;

  return (
    <>
      {onRead ? (
        <ReadBadge
          done={done}
          label={
            pages.total
              ? `${pages.read} of ${pages.total} pages read`
              : "reading…"
          }
        />
      ) : null}
      <PdfReader
        url={url}
        buffer={file.buffer}
        onRead={onRead}
        onProgress={(read, total) => setPages({ read, total })}
      />
    </>
  );
}

/** A picture, shown at its own size within the space it has. */
function ImageView({ url, name, onRead, onCoverage }) {
  const file = useMaterialBytes(url);
  const progress = useDwell(IMAGE_SECONDS, onRead);

  // A picture has no pages to walk through, so time in front of it is the whole
  // of its coverage.
  useEffect(() => {
    onCoverage?.({
      requiredSecs: IMAGE_SECONDS,
      coveragePct: progress,
      position: 0,
      lastPosition: 0,
    });
  }, [progress, onCoverage]);

  // Built as the bytes arrive rather than in an effect, so the picture is on
  // screen in the same render they land in.
  const src = useMemo(
    () =>
      file.status === "ready"
        ? URL.createObjectURL(new Blob([file.buffer], { type: imageType(name) }))
        : null,
    [file, name]
  );

  // The blob holds the whole picture in memory until it is let go of.
  useEffect(() => () => (src ? URL.revokeObjectURL(src) : undefined), [src]);

  if (file.status === "error") return <Failed />;
  if (!src) return <Loading />;

  return (
    <>
      {onRead ? (
        <ReadBadge done={progress >= 100} label={`${progress}% viewed`} />
      ) : null}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[#f4f6f9] p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={name}
          className="max-h-full max-w-full object-contain"
        />
      </div>
    </>
  );
}

/**
 * A workbook, read as a table.
 *
 * The parser is loaded on demand: it is by far the heaviest thing on this
 * screen, and the great majority of material is PDF that never needs it.
 */
function SheetView({ url, onRead, onCoverage }) {
  const file = useMaterialBytes(url);
  const [sheets, setSheets] = useState(null);
  const [unreadable, setUnreadable] = useState(false);
  const [active, setActive] = useState(0);
  const progress = useDwell(SHEET_SECONDS, onRead);

  // As with a picture: dwell time is all there is to measure.
  useEffect(() => {
    onCoverage?.({
      requiredSecs: SHEET_SECONDS,
      coveragePct: progress,
      position: 0,
      lastPosition: 0,
    });
  }, [progress, onCoverage]);

  useEffect(() => {
    if (file.status !== "ready") return undefined;
    let cancelled = false;

    (async () => {
      try {
        const XLSX = await import("xlsx");
        const book = XLSX.read(file.buffer, { type: "array", cellDates: true });
        const parsed = book.SheetNames.map((name) => ({
          name,
          // `raw: false` hands back what the cell displays — a date as the date
          // it shows, not the serial number underneath it.
          rows: XLSX.utils.sheet_to_json(book.Sheets[name], {
            header: 1,
            defval: "",
            raw: false,
            blankrows: false,
          }),
        }));
        if (!cancelled) setSheets(parsed);
      } catch {
        if (!cancelled) setUnreadable(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file]);

  if (file.status === "error" || unreadable) return <Failed />;
  if (!sheets) return <Loading />;

  const sheet = sheets[active] ?? sheets[0];
  const rows = sheet?.rows ?? [];
  const [header = [], ...body] = rows;
  const shown = body.slice(0, ROW_LIMIT);
  // Ragged rows are normal in a spreadsheet — the widest one sets the table.
  const columns = rows.reduce((n, row) => Math.max(n, row.length), 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      {onRead ? (
        <ReadBadge done={progress >= 100} label={`${progress}% read`} />
      ) : null}
      {/* One tab per sheet, only when the workbook actually has more than one. */}
      {sheets.length > 1 ? (
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-gray-200 bg-[#f8f9fa] px-3 py-2">
          {sheets.map((s, i) => (
            <button
              key={s.name}
              type="button"
              onClick={() => setActive(i)}
              className={`shrink-0 cursor-pointer rounded px-3 py-1 text-[11px] font-bold tracking-wide uppercase transition ${
                i === active
                  ? "bg-[#3482AE] text-white"
                  : "bg-white text-[#3482AE] hover:bg-[#eaf3f9]"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="text-[13px] normal-case text-gray-500">
            This sheet is empty.
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#f8f9fa] text-[#3482AE]">
                {Array.from({ length: columns }, (_, c) => (
                  <th
                    key={c}
                    className="border border-gray-200 px-3 py-2 text-left text-[11px] font-bold tracking-wide whitespace-nowrap"
                  >
                    {header[c] ?? ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((row, r) => (
                <tr key={r} className="odd:bg-white even:bg-[#fbfcfd]">
                  {Array.from({ length: columns }, (_, c) => (
                    <td
                      key={c}
                      className="border border-gray-200 px-3 py-1.5 align-top normal-case text-gray-700"
                    >
                      {row[c] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {/* A sheet long enough to lock the browser up is cut short rather
              than half-drawn, and says so instead of looking complete. */}
          {body.length > shown.length ? (
            <p className="border-t border-gray-200 bg-[#fff9e6] px-3 py-2 text-[12px] normal-case text-[#7a5c00]">
              Showing the first {ROW_LIMIT} of {body.length} rows — download the
              file to see all of it.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
