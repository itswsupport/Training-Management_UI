"use client";

import { ChevronDown } from "lucide-react";

/**
 * Shared by every control on a filter bar, so a <select> and a date box are the
 * same height and sit on the same line without either being nudged.
 */
export const filterFieldCls =
  "h-8 rounded border border-gray-300 bg-white px-2.5 text-[12px] text-gray-800 outline-none transition hover:border-gray-400 focus:border-[#3482AE] focus:ring-2 focus:ring-[#3482AE]/25";

/**
 * A labelled dropdown for a filter bar or a grid's top toolbar.
 *
 * The table's own column filters sit behind the funnel icon and filter one
 * column by text. These are the filters someone opens the screen already
 * knowing they want — the quarter they are working on, the status they are
 * chasing — so they are in front of the table rather than two clicks inside it,
 * and they narrow the rows the grid is given rather than the rows it shows,
 * which is what keeps the exports honest.
 *
 * A plain <select> under the styling: it is one short list of fixed values, and
 * the searchable component used on the forms would be a heavier control than
 * the choice needs. `appearance-none` plus an icon of our own only because the
 * native arrow is drawn differently by every browser and would be the one part
 * of the bar that did not match.
 *
 * @param {object} props
 * @param {string} props.label shown before the control, and read out with it
 * @param {string} props.value
 * @param {(value: string) => void} props.onChange
 * @param {{value: string, label: string}[]} props.options
 * @param {React.ElementType} [props.icon] drawn inside the field at the right,
 *   where a browser puts the calendar on a real date input — which is what
 *   makes a year read as a date control rather than as one more list. It stands
 *   in for the chevron rather than joining it: two glyphs at the same end say
 *   the field opens twice.
 * @param {string} [props.fieldClassName] width for the closed field, where the
 *   longest option would otherwise set it. A <select> sizes itself to its widest
 *   entry, so one list of plant names — "1042 — Rucha Engineers Pvt. Ltd. Unit-
 *   4, PressShop" — stretches the control far past what its own label needs and
 *   pushes the rest of the bar onto a second line. The full text is still there
 *   when the list is open, which is where it is actually read.
 */
export default function ToolbarSelect({
  label,
  value,
  onChange,
  options,
  icon: Icon,
  fieldClassName = "",
}) {
  const Adornment = Icon ?? ChevronDown;

  return (
    <label className="flex items-center gap-2 whitespace-nowrap">
      <span className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">
        {label}
      </span>
      <span className="relative inline-flex items-center">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${filterFieldCls} cursor-pointer appearance-none truncate pr-8 font-medium ${fieldClassName}`}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Adornment
          className={`pointer-events-none absolute right-2.5 h-3.5 w-3.5 ${
            Icon ? "text-[#3482AE]" : "text-gray-400"
          }`}
        />
      </span>
    </label>
  );
}
