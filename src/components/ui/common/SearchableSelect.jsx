"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A single-select dropdown with a type-to-filter box.
 *
 * A native `<select>` can't be searched, and several of these lists run to
 * hundreds of entries (the instructor list is the worst), so scrolling to find
 * a name is impractical. Styled to match the form's other controls.
 *
 * @param {{value: string, label: string}[]} options
 */
export default function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = "- Select -",
  searchPlaceholder = "Type to search…",
  disabled,
  id,
  className,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const ref = useRef(null);
  const searchRef = useRef(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // Opening should land the caret in the search box, not the trigger.
  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  /** Opening starts from a clean filter, so a stale query never hides rows. */
  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setQuery("");
      setActive(0);
    }
  };

  const choose = (option) => {
    onChange(option.value);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[active]) choose(filtered[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={toggleOpen}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-2 rounded border border-gray-300 bg-white px-2 py-1.5 text-left text-[12px] outline-none transition-colors focus:border-[#3482AE] focus:ring-2 focus:ring-[#3482AE]/30 disabled:cursor-not-allowed disabled:bg-gray-100"
      >
        {/* The chosen value reads as a badge, matching the multi-selects it
            sits beside on the module form. */}
        {selected ? (
          <span className="min-w-0 truncate rounded-full bg-[#3482AE]/10 px-2.5 py-1 text-[11px] font-semibold text-[#2a6a8f] ring-1 ring-[#3482AE]/20">
            {selected.label}
          </span>
        ) : (
          <span className="truncate text-gray-400">{placeholder}</span>
        )}
        <span className="shrink-0 text-gray-400">▾</span>
      </button>

      {open ? (
        <div className="absolute z-40 mt-1 w-full rounded border border-gray-300 bg-white shadow-lg">
          <div className="border-b border-gray-200 p-2">
            <span className="relative block">
              <Search className="pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
                placeholder={searchPlaceholder}
                className="w-full rounded border border-gray-300 py-1.5 pr-2 pl-7 text-[12px] normal-case outline-none focus:border-[#3482AE]"
              />
            </span>
          </div>

          <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-[12px] text-gray-500">No matches</li>
            ) : (
              filtered.map((option, i) => {
                const isSelected = option.value === value;
                return (
                  <li key={option.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => choose(option)}
                      className={cn(
                        "block w-full cursor-pointer px-3 py-1.5 text-left text-[12px]",
                        i === active && "bg-[#eaf3f9]",
                        isSelected && "font-bold text-[#3482AE]"
                      )}
                    >
                      {option.label}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
