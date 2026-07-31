"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";

/** How many chosen labels the closed field spells out before it counts them. */
const INLINE_LABELS = 3;

/**
 * Checkbox-dropdown multi-select (Department / Grade), styled to match the
 * other form controls. The closed field reads back what was chosen.
 *
 * The list is type-to-filter — these run to dozens of departments and grades,
 * so scrolling to find one is impractical. Filtering only hides rows; ticks
 * already made stay selected.
 *
 * @param {{value: string, label: string}[]} options
 */
export default function MultiSelect({
  options = [],
  selected = [],
  onChange,
  placeholder,
  searchPlaceholder = "Type to search…",
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  /** Opening starts from a clean filter, so a stale query never hides rows. */
  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next) setQuery("");
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const toggle = (value) =>
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    );

  const selectedLabels = options
    .filter((o) => selected.includes(o.value))
    .map((o) => o.label);

  // What was picked shows as badges in the field. Only the first few are drawn
  // so the control keeps one height however many are chosen — the rest are
  // counted, and the title carries the full list.
  const shown = selectedLabels.slice(0, INLINE_LABELS);
  const extra = selectedLabels.length - INLINE_LABELS;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggleOpen}
        title={selectedLabels.join(", ")}
        className="flex w-full items-center justify-between gap-2 rounded border border-gray-300 bg-white px-2 py-1.5 text-left text-[12px] outline-none transition focus:border-[#3482AE] focus:ring-2 focus:ring-[#3482AE]/30"
      >
        <span className="flex min-w-0 flex-1 flex-nowrap items-center gap-1.5 overflow-hidden">
          {selectedLabels.length === 0 ? (
            <span className="px-1 text-gray-400">{placeholder}</span>
          ) : (
            shown.map((label) => (
              <span
                key={label}
                className="max-w-[45%] shrink-0 truncate rounded-full bg-[#3482AE]/10 px-2.5 py-1 text-[11px] font-semibold text-[#2a6a8f] ring-1 ring-[#3482AE]/20"
              >
                {label}
              </span>
            ))
          )}
          {extra > 0 ? (
            <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600 ring-1 ring-gray-300">
              +{extra}
            </span>
          ) : null}
        </span>
        <span className="shrink-0 text-gray-400">▾</span>
      </button>

      {open ? (
        <div className="absolute z-30 mt-1 w-full rounded border border-gray-300 bg-white shadow-lg">
          <div className="border-b border-gray-200 p-2">
            <span className="relative block">
              <Search className="pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setOpen(false);
                }}
                placeholder={searchPlaceholder}
                className="w-full rounded border border-gray-300 py-1.5 pr-2 pl-7 text-[12px] normal-case outline-none focus:border-[#3482AE]"
              />
            </span>
          </div>

          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-[12px] text-gray-500">No matches</p>
            ) : (
              filtered.map((o) => (
                <label
                  key={o.value}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[12px] hover:bg-[#eaf3f9]"
                >
                  <input
                    type="checkbox"
                    className="accent-[#3482AE]"
                    checked={selected.includes(o.value)}
                    onChange={() => toggle(o.value)}
                  />
                  {o.label}
                </label>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
