"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A single-select dropdown with a type-to-filter box.
 *
 * A native `<select>` can't be searched, and several of these lists run to
 * hundreds of entries (the instructor list is the worst), so scrolling to find
 * a name is impractical. Styled to match the form's other controls.
 *
 * @param {{value: string, label: string}[]} options
 * @param {boolean} [clearable] shows an X on the chosen value that puts the
 *   field back to nothing. Off by default: on a field that must hold a value —
 *   the applicable quarter, say — an empty state is not a legal answer, and
 *   offering one only invites a form that cannot be submitted.
 */
export default function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = "- Select -",
  searchPlaceholder = "Type to search…",
  clearable = false,
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

  const showClear = clearable && !disabled && Boolean(selected);

  return (
    <div className={cn("relative", className)} ref={ref}>
      {/* A div rather than a button, for the same reason MultiSelect is one:
          the chosen value carries its own × and a <button> cannot legally hold
          another button. role, tabIndex and the key handler give back what the
          button provided. */}
      <div
        role="button"
        id={id}
        tabIndex={disabled ? -1 : 0}
        onClick={disabled ? undefined : toggleOpen}
        onKeyDown={(e) => {
          // Only when the field itself has focus — Enter on the badge's × is
          // that button's to handle and must not also open the list.
          if (disabled || e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleOpen();
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-disabled={disabled || undefined}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded border border-gray-300 bg-white px-2 py-1.5 text-left text-[12px] outline-none transition-colors focus:border-[#3482AE] focus:ring-2 focus:ring-[#3482AE]/30",
          disabled ? "cursor-not-allowed bg-gray-100" : "cursor-pointer"
        )}
      >
        {/* The chosen value reads as a badge, matching the multi-selects it
            sits beside on the module form — and, when the field is clearable,
            carrying its × in the same place theirs do. */}
        {selected ? (
          <span
            className={cn(
              "flex min-w-0 items-center gap-1 rounded-full bg-[#3482AE]/10 py-1 text-[11px] font-semibold text-[#2a6a8f] ring-1 ring-[#3482AE]/20",
              showClear ? "pr-1 pl-2.5" : "px-2.5"
            )}
          >
            <span className="truncate">{selected.label}</span>
            {/* stopPropagation is the whole trick: the × sits inside the field,
                and the click would otherwise bubble up and toggle the dropdown
                on its way out — so clearing would leave the list hanging open. */}
            {showClear ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                  setOpen(false);
                }}
                onKeyDown={(e) => e.stopPropagation()}
                title={`Remove ${selected.label}`}
                aria-label={`Remove ${selected.label}`}
                className="shrink-0 cursor-pointer rounded-full p-0.5 text-[#2a6a8f]/60 transition hover:bg-[#3482AE]/25 hover:text-[#1f5f86]"
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </span>
        ) : (
          <span className="truncate text-gray-400">{placeholder}</span>
        )}
        <span className="shrink-0 text-gray-400">▾</span>
      </div>

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
