"use client";

import { useCallback, useEffect, useRef } from "react";

import { saveProgress, sendFinalProgress } from "@/services/ProgressService";

/** How often the accumulated seconds are sent up. */
const FLUSH_MS = 15_000;

/**
 * How long without a keystroke, a scroll or a mouse move before the learner is
 * taken to have walked away. Reading a slow page is not inactivity, so this is
 * generous; leaving the room is what it is meant to catch.
 */
const IDLE_MS = 60_000;

/**
 * Counts the time a learner actually spends on one material, and reports it.
 *
 * The whole value of this hook is in what it refuses to count. A tab left open
 * overnight, a video playing to an empty chair, a document behind three other
 * windows — a naive timer counts all of it, and a learner only has to discover
 * that once for every gate in the system to become a joke. So a second is only
 * counted when all three of these hold:
 *
 *   - the tab is the visible one
 *   - the window has focus
 *   - something has happened in the last minute
 *
 * Seconds are accumulated locally and sent as a delta every fifteen. The server
 * keeps the running total, and clamps each delta it is handed — this hook is
 * how honest time is measured, not how it is proven.
 *
 * @param {object} options
 * @param {boolean} options.active whether the material is open and being used
 * @param {object} options.material `{empCode, emoduleId, sectionId, lectureId, kind}`
 * @param {() => {requiredSecs: number, coveragePct: number, position: number,
 *   lastPosition: number}} options.snapshot reads the caller's current
 *   coverage — a PDF's pages seen, a video's unique seconds — at flush time
 */
export function useMaterialProgress({ active, material, snapshot }) {
  const seconds = useRef(0);
  const lastInput = useRef(0);

  // Held in refs so the interval never has to be torn down and rebuilt when a
  // page turns or a video advances — restarting it would drop the part-second
  // and, worse, re-register the listeners on every tick.
  const materialRef = useRef(material);
  const snapshotRef = useRef(snapshot);
  useEffect(() => {
    materialRef.current = material;
    snapshotRef.current = snapshot;
  });

  /** Sends what has been counted and starts the next stretch from zero. */
  const flush = useCallback((final = false) => {
    const counted = seconds.current;
    const target = materialRef.current;
    if (!target?.empCode || !target?.lectureId) return;
    // A beat with no time in it still has nothing to say — except the last one,
    // which carries the final coverage even if the seconds are already sent.
    if (counted === 0 && !final) return;

    seconds.current = 0;
    const beat = { ...target, secondsDelta: counted, ...snapshotRef.current() };

    if (final) {
      // The page is going; an XHR would die with it.
      if (!sendFinalProgress(beat)) saveProgress(beat).catch(() => {});
      return;
    }
    // A dropped beat must not take the learner's time with it, so the seconds
    // go back on the pile and travel with the next one.
    saveProgress(beat).catch(() => {
      seconds.current += counted;
    });
  }, []);

  useEffect(() => {
    if (!active) return undefined;

    // Opening the material counts as the first sign of life; without this the
    // learner would be idle from the outset and the first minute lost.
    lastInput.current = Date.now();

    const wake = () => {
      lastInput.current = Date.now();
    };
    const events = ["mousemove", "mousedown", "keydown", "wheel", "scroll", "touchstart"];
    events.forEach((event) =>
      window.addEventListener(event, wake, { passive: true, capture: true })
    );

    const tick = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (!document.hasFocus()) return;
      if (Date.now() - lastInput.current > IDLE_MS) return;
      seconds.current += 1;
    }, 1000);

    const beat = setInterval(() => flush(false), FLUSH_MS);

    // Switching away is the most common way a stretch of reading ends, and the
    // browser may never come back to tell us about it.
    const onHide = () => {
      if (document.visibilityState === "hidden") flush(true);
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", () => flush(true));

    return () => {
      events.forEach((event) =>
        window.removeEventListener(event, wake, { capture: true })
      );
      clearInterval(tick);
      clearInterval(beat);
      document.removeEventListener("visibilitychange", onHide);
      // Closing the material is itself the end of a stretch — send it, with the
      // coverage as it finally stood.
      flush(true);
    };
  }, [active, flush]);

  /** Report coverage now rather than waiting for the next beat. */
  return { flushNow: () => flush(false) };
}

export default useMaterialProgress;
