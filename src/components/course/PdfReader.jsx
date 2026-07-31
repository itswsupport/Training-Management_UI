"use client";

import { useEffect, useRef, useState } from "react";

/**
 * How long a page has to be on screen before it counts as read. Long enough
 * that a fast scroll to the end registers nothing; short enough that a slide
 * with six words on it does not become a waiting game.
 */
const PAGE_SECONDS = 5;

/** A page has to be at least half in view to be the one being read. */
const VISIBLE_RATIO = 0.5;

/** Pages are drawn just before they are scrolled to, not all at once. */
const RENDER_MARGIN = "300px";

/** Until a page has been measured, stand it up at A4 so scrolling behaves. */
const A4_RATIO = 1.414;

/**
 * A PDF, rendered here rather than handed to the browser's own viewer.
 *
 * The point is not the look — it is that the browser's viewer is a document we
 * cannot see into. It reports no page number and no scroll position, so with it
 * "read the file" could only ever mean "opened the file", which is what it
 * meant until now.
 *
 * Rendering it ourselves means a page counts only once it has genuinely been on
 * screen for a few seconds. Dragging the scrollbar to the end registers nothing
 * at all: every page flicks past below the dwell and none of them are counted.
 *
 * @param {object} props
 * @param {string} props.url  the `/trainingMaterial/file` URL
 * @param {ArrayBuffer} props.buffer  the already-fetched bytes
 * @param {(read: number, total: number) => void} [props.onProgress]
 * @param {() => void} [props.onRead]  called once, when every page is read.
 *   Absent for an officer, who is checking the material rather than sitting it.
 */
export default function PdfReader({ url, buffer, onProgress, onRead }) {
  const [pdf, setPdf] = useState(null);
  const [failed, setFailed] = useState(false);

  const scrollRef = useRef(null);
  const pageRefs = useRef(new Map());
  const drawn = useRef(new Set());
  const visible = useRef(new Set());
  const dwell = useRef(new Map());
  const read = useRef(new Set());
  const reported = useRef(false);

  // Loaded on demand — the parser is the heaviest thing on this screen, and a
  // learner who only ever opens videos should never pay for it.
  useEffect(() => {
    if (!buffer) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();

        // A copy: pdf.js hands the buffer to its worker and detaches it, which
        // would leave the caller holding an empty one.
        const doc = await pdfjs.getDocument({ data: buffer.slice(0) }).promise;
        if (!cancelled) setPdf(doc);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [buffer]);

  /** Draws one page into its canvas, at the width the panel gives it. */
  const drawPage = async (pageNumber) => {
    if (!pdf || drawn.current.has(pageNumber)) return;
    const holder = pageRefs.current.get(pageNumber);
    const canvas = holder?.querySelector("canvas");
    if (!canvas) return;

    drawn.current.add(pageNumber);
    try {
      const page = await pdf.getPage(pageNumber);
      const unscaled = page.getViewport({ scale: 1 });
      const width = holder.clientWidth || unscaled.width;
      // Drawn at the device's own pixel density, or the text is soft on a
      // laptop screen and unreadable on a phone.
      const ratio = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: (width / unscaled.width) * ratio });

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = "100%";
      canvas.style.height = "auto";
      holder.style.aspectRatio = `${unscaled.width} / ${unscaled.height}`;

      await page.render({ canvasContext: canvas.getContext("2d"), viewport })
        .promise;
    } catch {
      // One page failing to draw must not take the document with it.
      drawn.current.delete(pageNumber);
    }
  };

  // Watches which pages are on screen: to draw them, and to time them.
  useEffect(() => {
    if (!pdf) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const pageNumber = Number(entry.target.dataset.page);
          if (entry.isIntersecting) drawPage(pageNumber);
          if (entry.intersectionRatio >= VISIBLE_RATIO) {
            visible.current.add(pageNumber);
          } else {
            visible.current.delete(pageNumber);
          }
        });
      },
      { root: scrollRef.current, rootMargin: RENDER_MARGIN, threshold: [0, VISIBLE_RATIO] }
    );

    pageRefs.current.forEach((node) => node && observer.observe(node));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf]);

  // The clock. A second only counts against a page when the tab is the one in
  // front — a document behind three other windows is not being read.
  useEffect(() => {
    if (!pdf || !onRead) return undefined;

    const tick = setInterval(() => {
      if (document.visibilityState !== "visible" || !document.hasFocus()) return;

      let changed = false;
      visible.current.forEach((pageNumber) => {
        if (read.current.has(pageNumber)) return;
        const seconds = (dwell.current.get(pageNumber) ?? 0) + 1;
        dwell.current.set(pageNumber, seconds);
        if (seconds >= PAGE_SECONDS) {
          read.current.add(pageNumber);
          changed = true;
        }
      });

      if (!changed) return;
      onProgress?.(read.current.size, pdf.numPages);
      if (read.current.size >= pdf.numPages && !reported.current) {
        reported.current = true;
        onRead();
      }
    }, 1000);

    return () => clearInterval(tick);
  }, [pdf, onRead, onProgress]);

  if (failed) {
    return (
      <div className="flex flex-1 items-center justify-center bg-white p-6">
        <p className="text-center text-[13px] normal-case text-[#dc3545]">
          This PDF could not be opened here —{" "}
          <a href={url} target="_blank" rel="noreferrer" className="underline">
            open it in a new tab
          </a>
          .
        </p>
      </div>
    );
  }

  if (!pdf) {
    return (
      <div className="flex flex-1 items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#3482AE]" />
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto bg-[#525659] p-4">
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        {Array.from({ length: pdf.numPages }, (_, i) => i + 1).map((pageNumber) => (
          <div
            key={pageNumber}
            data-page={pageNumber}
            ref={(node) => {
              if (node) pageRefs.current.set(pageNumber, node);
              else pageRefs.current.delete(pageNumber);
            }}
            style={{ aspectRatio: `1 / ${A4_RATIO}` }}
            className="relative w-full bg-white shadow-lg"
          >
            <canvas className="block h-auto w-full" />
            <span className="absolute right-2 bottom-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {pageNumber} / {pdf.numPages}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
