/**
 * Reading and watching progress (`/emodule/progress/*`).
 *
 * The browser reports what a learner did with a material; the backend decides
 * what it amounts to. Nothing here sends a "completed" flag — `done` is only
 * ever read back, never asserted, because a flag the client can set is a gate
 * the client can open.
 */

import { api, getApiUrl, sendForm, toFormBody, unwrap } from "@/config/api";
import { clean } from "@/utils/etmsFormat";

/** The three kinds of material a lecture can carry. */
export const MATERIAL_KINDS = { VIDEO: "video", FILE: "file", LINK: "link" };

/** One progress row, keyed the way the course screen looks it up. */
export const progressKey = (lectureId, kind) => `${lectureId}:${kind}`;

const toProgressRow = (p) => ({
  lectureId: p.lectureId ?? 0,
  sectionId: p.sectionId ?? 0,
  empCode: p.empCode ?? 0,
  kind: clean(p.materialKind) || MATERIAL_KINDS.VIDEO,
  seconds: p.secondsSpent ?? 0,
  required: p.requiredSecs ?? 0,
  coverage: p.coveragePct ?? 0,
  // Where to pick up again: the page or second they were last on.
  resumeAt: p.lastPosition ?? 0,
  furthest: p.maxPosition ?? 0,
  done: p.completed === 1,
});

/**
 * One heartbeat.
 *
 * `secondsDelta` is the time since the last beat, never a running total — the
 * server keeps the total and clamps whatever it is handed, so a forged hour
 * buys nothing.
 *
 * @param {object} beat
 * @param {number} beat.secondsDelta active seconds since the last call
 * @param {number} beat.requiredSecs what this material is worth
 * @param {number} beat.coveragePct pages seen / video covered, 0-100
 * @param {number} beat.position furthest page or second reached
 * @param {number} beat.lastPosition where they are now, for resuming
 */
export async function saveProgress(beat) {
  unwrap(await sendForm("/emodule/progress/save", beatParams(beat)));
}

/** The exact params `/emodule/progress/save` binds. */
const beatParams = ({
  empCode,
  emoduleId,
  sectionId,
  lectureId,
  kind,
  secondsDelta,
  requiredSecs = 0,
  coveragePct = 0,
  position = 0,
  lastPosition = 0,
}) => ({
  empCode,
  emoduleId,
  sectionId,
  lectureId,
  materialKind: kind,
  secondsDelta: Math.round(secondsDelta),
  requiredSecs: Math.round(requiredSecs),
  coveragePct: Math.round(coveragePct),
  position: Math.round(position),
  lastPosition: Math.round(lastPosition),
});

/**
 * The last beat, sent as the page goes away.
 *
 * A closing tab kills an in-flight XHR, which is exactly when the final and
 * largest stretch of watching would be lost. `sendBeacon` is handed to the
 * browser to deliver after the page is gone, and it takes the same
 * form-encoded body the endpoint already expects.
 */
export function sendFinalProgress(beat) {
  if (typeof navigator === "undefined" || !navigator.sendBeacon) return false;
  try {
    return navigator.sendBeacon(
      getApiUrl("/emodule/progress/save"),
      toFormBody(beatParams(beat))
    );
  } catch {
    return false;
  }
}

/**
 * This learner's progress through one course, as a Map keyed by
 * `${lectureId}:${kind}`.
 *
 * @returns {Promise<Map<string, object>>}
 */
export async function getProgress(empCode, emoduleId) {
  const list =
    unwrap(
      await api.get("/emodule/progress/list", { params: { empCode, emoduleId } }),
      []
    ) ?? [];

  const byMaterial = new Map();
  list.map(toProgressRow).forEach((row) => {
    byMaterial.set(progressKey(row.lectureId, row.kind), row);
  });
  return byMaterial;
}

/**
 * True once every material of every lecture in the section has been finished.
 *
 * The screen asks this to decide whether to show the assignment; it is asked
 * again on submit, server-side, because a learner can type that URL.
 */
export async function isSectionUnlocked(empCode, sectionId) {
  return (
    unwrap(
      await api.get("/emodule/progress/unlocked", { params: { empCode, sectionId } }),
      0
    ) === 1
  );
}

/** Every learner's progress through one course, for the officer's report. */
export async function getCourseProgress(emoduleId) {
  const list =
    unwrap(await api.get("/emodule/progress/report", { params: { emoduleId } }), []) ?? [];
  return list.map(toProgressRow);
}
