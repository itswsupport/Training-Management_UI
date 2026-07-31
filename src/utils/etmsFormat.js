/**
 * Formatting helpers shared by the ETMS services.
 *
 * The backend stores registration stamps as two separate columns — a
 * `yyyy-MM-dd` date and a 12-hour `hh:mm AM/PM` time — and every write endpoint
 * expects both, so they are built in one place.
 */

const pad = (n) => String(n).padStart(2, "0");

/** `2026-07-27` */
export const toRegDate = (date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** `04:35 PM` */
export const toRegTime = (date = new Date()) => {
  const ampm = date.getHours() >= 12 ? "PM" : "AM";
  const hour = date.getHours() % 12 || 12;
  return `${pad(hour)}:${pad(date.getMinutes())} ${ampm}`;
};

/** Both stamps for one write. */
export const nowStamp = (date = new Date()) => ({
  regDate: toRegDate(date),
  regTime: toRegTime(date),
});

/**
 * A `yyyy-MM-dd` date and its `hh:mm AM/PM` (or 24-hour) time as one sortable
 * number, or null when the date cannot be read.
 *
 * Both halves are the backend's own local strings, so two stamps built this way
 * compare correctly without dragging a timezone into it — which parsing the
 * UTC instant beside them would.
 */
export function stampValue(date, time) {
  const [y, m, d] = String(date ?? "")
    .trim()
    .split("-")
    .map(Number);
  if (!y || !m || !d) return null;

  const match = String(time ?? "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?$/);
  if (!match) return Date.UTC(y, m - 1, d);

  const [, rawHour, minute, meridiem] = match;
  let hour = Number(rawHour);
  if (meridiem) {
    hour %= 12;
    if (/p/i.test(meridiem)) hour += 12;
  }
  return Date.UTC(y, m - 1, d, hour, Number(minute));
}

/** Trims a backend string, mapping null / "null" / "-" to "". */
export const clean = (value) => {
  const text = String(value ?? "").trim();
  if (!text || text.toLowerCase() === "null" || text === "-") return "";
  return text;
};

/** Trims a backend string, mapping null / "null" to null (keeps "-"). */
export const cleanOrNull = (value) => {
  const text = String(value ?? "").trim();
  return text && text.toLowerCase() !== "null" ? text : null;
};

/** "FIRST LAST" from a backend row's two name columns. */
export const fullName = (first, last) =>
  [first, last].filter(Boolean).join(" ").trim();

/** The final segment of a Windows or POSIX file path. */
export const fileName = (path) => String(path ?? "").split(/[\\/]/).pop() || "";
