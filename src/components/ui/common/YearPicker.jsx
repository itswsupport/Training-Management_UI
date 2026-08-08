"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";

import { filterFieldCls } from "@/components/ui/common/ToolbarSelect";
import { currentFinancialYear } from "@/services/MasterDataService";

/**
 * Twelve years, three to a row — the block a date picker shows when you click
 * its year. Weighted backwards because a course list is a record of what has
 * happened, with only the next year or two ahead of it worth planning for.
 */
const YEARS_BEFORE = 8;
const YEARS_AFTER = 3;

/**
 * The year filter, drawn as a calendar's year view rather than as a list.
 *
 * A <select> put the years in a scrolling column, which is not how anyone
 * pictures years — a calendar lays them out as a grid and lets you see the run
 * of them at once. This is that view and nothing else: no months, no days,
 * because the only thing filtered on is the year.
 *
 * A single year per cell, the way a calendar writes one. The value behind it is
 * still the year a financial year starts in, so picking 2026 takes in the
 * quarter running to March 2027 — spelling that out as "2026-27" put two
 * numbers in a cell that a calendar gives one.
 *
 * "All years" sits above the grid rather than in it. It is not a year, so it
 * would read as one more cell among equals and be picked by accident; pinned
 * to the top with a rule under it, it is plainly the way out of the filter.
 *
 * @param {object} props
 * @param {string} props.value  the financial year's starting year, "" for all
 * @param {(value: string) => void} props.onChange
 * @param {string} [props.label]
 * @param {boolean} [props.allowAll] false on a form, where the field is a value
 *   the course is saved with and "every year" is not one of the things it can be
 * @param {number} [props.minYear] years before this are shown but not
 *   selectable, the way a date picker greys out days it will not take. Shown
 *   rather than hidden so the run of years still reads as a calendar, and so it
 *   is visible that the year exists and is simply past.
 * @param {string} [props.triggerClassName] the closed field's styling, for a
 *   form that wants it to match the inputs around it rather than the filter bar
 */
export default function YearPicker({
  value,
  onChange,
  label = "Year",
  allowAll = true,
  minYear = null,
  triggerClassName = null,
}) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  // Built from today, so the run of years stays current with no upkeep.
  const years = useMemo(() => {
    const start = currentFinancialYear() - YEARS_BEFORE;
    return Array.from(
      { length: YEARS_BEFORE + YEARS_AFTER + 1 },
      (_, i) => start + i
    );
  }, []);

  // A click anywhere else, or Escape, closes it. Bound only while open: a
  // listener per picker on every click of the page is a cost for nothing.
  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (!box.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (next) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div
      className={
        label
          ? "flex items-center gap-2 whitespace-nowrap"
          : // On a form the field carries the form's own label above it, so
            // there is nothing to sit beside and the control fills its column
            // like every other field in the grid.
            "w-full"
      }
    >
      {label ? (
        <span className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">
          {label}
        </span>
      ) : null}

      <div ref={box} className={label ? "relative" : "relative w-full"}>
        <button
          type="button"
          onClick={() => setOpen((wasOpen) => !wasOpen)}
          aria-haspopup="dialog"
          aria-expanded={open}
          // On a filter bar, a fixed width rather than one that follows the
          // text: "2026" and "All years" are very different lengths, and a
          // field that resized as you chose would shift the Quarter box beside
          // it every time. A form passes its own field styling instead, so the
          // year sits flush with the inputs around it.
          className={`${
            triggerClassName ?? `${filterFieldCls} w-36`
          } flex cursor-pointer items-center pr-8 pl-2.5 font-medium`}
        >
          {value || "All years"}
          {/* At the right end, standing in for a chevron: it is the same
              affordance, and it says what opens. */}
          <CalendarDays className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-[#3482AE]" />
        </button>

        {open ? (
          <div
            role="dialog"
            aria-label="Choose a financial year"
            className="absolute left-0 z-50 mt-1 w-72 rounded border border-gray-200 bg-white p-3 shadow-lg"
          >
            {allowAll ? (
              <>
                <button
                  type="button"
                  onClick={() => pick("")}
                  className={`mb-1 w-full rounded px-2 py-1.5 text-left text-[12px] font-semibold transition ${
                    value
                      ? "text-gray-600 hover:bg-gray-100"
                      : "bg-[#3482AE] text-white"
                  }`}
                >
                  All years
                </button>

                <div className="mb-2 border-t border-gray-100" />
              </>
            ) : null}

            <div className="grid grid-cols-3 gap-1.5">
              {years.map((year) => {
                const key = String(year);
                const selected = key === value;
                const blocked = minYear != null && year < minYear;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={blocked}
                    title={blocked ? "This year has already ended." : undefined}
                    onClick={() => pick(key)}
                    className={`rounded px-2 py-1.5 text-[12px] font-medium transition ${
                      blocked
                        ? "cursor-not-allowed text-gray-300"
                        : selected
                          ? "bg-[#3482AE] text-white"
                          : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {year}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
