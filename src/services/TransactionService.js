/**
 * The module history (`/emodule/transaction/list`).
 *
 * Every other ETMS table keeps current state and overwrites it, so this is the
 * only record of who created, edited or assigned a course, and when. Rows are
 * written by the backend on each save; nothing here writes.
 */

import { api, unwrap } from "@/config/api";
import { clean } from "@/utils/etmsFormat";

/** The actions the backend writes, with the label the grid shows. */
export const TRANSACTION_ACTIONS = [
  { value: "MODULE_CREATED", label: "Module created" },
  { value: "MODULE_UPDATED", label: "Module updated" },
  { value: "MODULE_ASSIGNED", label: "Module assigned" },
  { value: "SECTION_ADDED", label: "Section added" },
  { value: "SECTION_UPDATED", label: "Section updated" },
  { value: "SECTION_DELETED", label: "Section deleted" },
  { value: "QUESTION_ADDED", label: "Question added" },
  { value: "ASSIGNMENT_SUBMITTED", label: "Assignment submitted" },
  { value: "FEEDBACK_SUBMITTED", label: "Feedback submitted" },
];

const ACTION_LABELS = Object.fromEntries(
  TRANSACTION_ACTIONS.map((a) => [a.value, a.label])
);

/** "MODULE_CREATED" → "Module created"; anything unmapped is de-underscored. */
export const actionLabel = (action) =>
  ACTION_LABELS[action] ?? clean(action).replace(/_/g, " ");

/** Snapshot keys → what the officer calls that field on the form. */
const FIELD_LABELS = {
  name: "Course name",
  category: "Category",
  instructor: "Instructor",
  description: "Description",
  quarter: "Quarter",
  validTill: "Valid till",
  dept: "Departments",
  grade: "Grades",
  status: "Status",
};

/** A snapshot that cannot be read is treated as absent, never as an error. */
const parseSnapshot = (value) => {
  const text = clean(value);
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

/**
 * The before → after pairs behind one edit.
 *
 * `changed_fields` already names what differs, so this only has to read those
 * keys out of the two snapshots. A create has no "before", so every field of
 * the new snapshot is reported as a starting value.
 */
export function fieldChanges(changedFields, oldValue, newValue) {
  const before = parseSnapshot(oldValue);
  const after = parseSnapshot(newValue);
  const names = clean(changedFields)
    ? clean(changedFields).split(",").filter(Boolean)
    : Object.keys(after);

  return names.map((field) => ({
    field,
    label: FIELD_LABELS[field] ?? field,
    from: String(before[field] ?? ""),
    to: String(after[field] ?? ""),
  }));
}

/** Where the officers, the backend and every other ETMS stamp keep time. */
const DISPLAY_TIME_ZONE = "Asia/Kolkata";

/** `13` → `01`, for the 12-hour clock the app shows everywhere. */
const to12Hour = (hour) => String(hour % 12 || 12).padStart(2, "0");

/**
 * `{date: "28-07-2026", time: "04:35 PM"}` for one history row.
 *
 * Kept apart rather than as one string because the grid gives them a column
 * each; `when` below joins them back for the callers that want the phrase.
 *
 * A row carries the same moment twice: an instant, which the backend serialises
 * in UTC (`2026-07-30T06:55:13.000+00:00`), and its own local date and time
 * (`2026-07-30`, `12:25 pm`). The local pair is what is shown — it is the wall
 * clock the officer saved at, and it is how every other stamp in ETMS is
 * stored and read.
 *
 * The instant is only the fallback, and it has to be converted rather than
 * read: taking its digits at face value is what had a change made at 12:25 pm
 * listed as 06:55 AM, the whole history running 5:30 behind.
 */
const formatStamp = (instant, localDate, localTime) =>
  fromLocalPair(localDate, localTime) ?? fromInstant(instant);

/** `2026-07-30` + `12:25 pm` (or `12:25`) → `30-07-2026` and `12:25 PM`. */
function fromLocalPair(date, time) {
  const [y, m, d] = clean(date).split("-");
  const parts = clean(time).match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?$/);
  if (!y || !m || !d || !parts) return null;

  const [, rawHour, minute, meridiem] = parts;
  let hour = Number(rawHour);
  if (meridiem) {
    hour %= 12;
    if (/p/i.test(meridiem)) hour += 12;
  }
  return {
    date: `${d}-${m}-${y}`,
    time: `${to12Hour(hour)}:${minute} ${hour >= 12 ? "PM" : "AM"}`,
  };
}

/**
 * The UTC instant, read in Indian time. Built from parts rather than a locale
 * string so the separators are ours and not the engine's.
 */
function fromInstant(value) {
  const text = clean(value);
  const parsed = Date.parse(text);
  // Unreadable: show it as it came rather than inventing a date, and leave the
  // time empty so the column says nothing instead of something wrong.
  if (Number.isNaN(parsed)) return { date: text, time: "" };

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: DISPLAY_TIME_ZONE,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(parsed)
      .map((p) => [p.type, p.value])
  );

  // Midnight comes back as hour 24 from some engines.
  const hour = Number(parts.hour) % 24;
  return {
    date: `${parts.day}-${parts.month}-${parts.year}`,
    time: `${to12Hour(hour)}:${parts.minute} ${hour >= 12 ? "PM" : "AM"}`,
  };
}

/**
 * A section save can carry lecture videos, so the wizard can sit on one for a
 * while. Between two question saves there is nothing to upload — they are plain
 * form posts written in a tight loop — so anything slower than this is a person
 * coming back later, not the wizard still running.
 */
const SECTION_GAP_MS = 10 * 60 * 1000;
const QUESTION_GAP_MS = 60 * 1000;

/** Milliseconds between two raw stamps, or null if either cannot be read. */
function gapBetween(earlier, later) {
  const a = Date.parse(earlier);
  const b = Date.parse(later);
  return Number.isNaN(a) || Number.isNaN(b) ? null : Math.abs(b - a);
}

/**
 * Drops the rows written while the module was being created.
 *
 * Creating a module is one uninterrupted run — the form saves the module, then
 * every section, then every question, then submits — so a brand-new course
 * arrives with half a dozen history rows before anyone has edited anything.
 * "Edit History" should be empty until someone actually changes the course, and
 * fill up from the first edit onward.
 *
 * The run's end is found by SHAPE rather than by a stopwatch. The wizard writes
 * all of its sections before any of its questions (ModuleForm saves the
 * sections in one loop, then attaches the questions in the next), so a section
 * appearing after a question is somebody adding one later — however soon after.
 * Timing is only a secondary guard, and errs towards showing a row: anything
 * unreadable or slow ends the run rather than absorbing it.
 */
export function withoutCreationRun(rows) {
  // Rows arrive newest first, so the creation run sits at the end of the list.
  let i = rows.length - 1;
  if (i < 0 || rows[i].action !== "MODULE_CREATED") return rows;

  let previous = rows[i].at;
  let intoQuestions = false;
  i -= 1;

  while (i >= 0) {
    const { action, at } = rows[i];

    if (action === "QUESTION_ADDED") {
      if (gapNotWithin(previous, at, QUESTION_GAP_MS)) break;
      intoQuestions = true;
    } else if (action === "SECTION_ADDED") {
      // The wizard is past its sections once it starts writing questions, so
      // this one belongs to a later edit.
      if (intoQuestions) break;
      if (gapNotWithin(previous, at, SECTION_GAP_MS)) break;
    } else {
      break;
    }

    previous = at;
    i -= 1;
  }
  return rows.slice(0, i + 1);
}

/** True when two rows are too far apart — or too unreadable — to be one run. */
function gapNotWithin(earlier, later, limit) {
  const gap = gapBetween(earlier, later);
  return gap == null || gap > limit;
}

/**
 * The history rows, newest first, capped at 500 by the backend.
 *
 * `/emodule/transaction/list` returns positional tuples, not objects — the
 * column order below mirrors the SELECT in EmoduleTransactionRepository.
 *
 * `onlyEdits` narrows it to what an officer changed about the course — module,
 * section and question edits — leaving out assignment and feedback traffic.
 *
 * @param {{emoduleId?: number|string, empCode?: number|string, action?: string,
 *   onlyEdits?: boolean}} [filters]
 */
export async function getTransactions(filters = {}) {
  const params = {};
  if (filters.emoduleId) params.emoduleId = filters.emoduleId;
  if (filters.empCode) params.empCode = filters.empCode;
  if (filters.action) params.action = filters.action;
  if (filters.onlyEdits) params.onlyEdits = true;

  const list = unwrap(await api.get("/emodule/transaction/list", { params }), []) ?? [];

  return list.map((row, index) => {
    const stamp = formatStamp(row?.[1], row?.[16], row?.[17]);
    return {
    id: row?.[0] ?? index,
    // Kept alongside the formatted stamp because grouping rows into a single
    // save run needs the gaps between them, not their display text.
    at: clean(row?.[1]),
    // The two halves for the grid, and the phrase for the sentences elsewhere
    // that read "…updated on 28-07-2026 04:35 PM".
    whenDate: stamp.date,
    whenTime: stamp.time,
    when: `${stamp.date} ${stamp.time}`.trim(),
    action: clean(row?.[2]),
    actionText: actionLabel(row?.[2]),
    entity: clean(row?.[3]),
    emoduleId: row?.[4] ?? null,
    course: clean(row?.[5]) || (row?.[4] ? `Module ${row[4]}` : "—"),
    sectionId: row?.[6] ?? null,
    empCode: row?.[7] ?? null,
    // MODULE_ASSIGNED names the employee it was assigned to; an officer-only
    // action has no subject, so the column reads as a dash rather than blank.
    empName: clean(row?.[8]) || (row?.[7] ? String(row[7]) : "—"),
    actionBy: row?.[9] ?? null,
    actionByName: clean(row?.[10]) || (row?.[9] ? String(row[9]) : "—"),
    // Whether that name came from the backend or is the employee code standing
    // in for one. The officer is stored as a code and the join behind this
    // column does not always find them, which is what leaves a history reading
    // "101588" where a person's name belongs — see CourseHistory, which resolves
    // the rest against the employee roster.
    actionByNamed: Boolean(clean(row?.[10])),
    role: clean(row?.[11]),
    changedFields: clean(row?.[12]),
    oldValue: clean(row?.[13]),
    newValue: clean(row?.[14]),
    description: clean(row?.[15]),
    // The backend's own local date and time for this row. Compared against the
    // learner's completion stamp, which is stored the same way — the ISO column
    // above is UTC and would need a timezone to line the two up.
    atDate: clean(row?.[16]),
    atTime: clean(row?.[17]),
    changes: fieldChanges(row?.[12], row?.[13], row?.[14]),
    };
  });
}

/**
 * The actions that put new material in front of a learner. A section save
 * rewrites its lecture list, so adding a lecture to an existing section arrives
 * as SECTION_UPDATED rather than an add of its own.
 */
const CONTENT_ACTIONS = new Set([
  "SECTION_ADDED",
  "SECTION_UPDATED",
  "QUESTION_ADDED",
]);

/**
 * The most recent change to a course's content, ignoring the rows written while
 * it was first being built. Null when nothing has been added since.
 *
 * @param {number|string} emoduleId
 */
export async function getLatestContentChange(emoduleId) {
  const rows = withoutCreationRun(
    await getTransactions({ emoduleId, onlyEdits: true })
  );
  // Rows are newest first, so the first match is the latest change.
  return rows.find((r) => CONTENT_ACTIONS.has(r.action)) ?? null;
}
