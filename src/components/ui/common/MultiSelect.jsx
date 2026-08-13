"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";

/** How many chosen labels the closed field spells out before it counts them. */
const INLINE_LABELS = 3;

/**
 * A badge's own remove button — the × that takes one pick straight off the
 * field, instead of reopening the list and hunting for the row to untick.
 *
 * `stopPropagation` is the whole trick: the badge sits inside the field, and a
 * click on it would otherwise bubble up and toggle the dropdown on its way out,
 * so removing a value would leave the list hanging open every time. The same
 * guard on keydown keeps Enter here from also reaching the field behind it.
 *
 * Declared at module level, not inside MultiSelect: a component defined during
 * render is a new type on every render, so React would unmount and remount
 * every badge on each keystroke.
 */
function RemoveBadgeBtn({ label, onRemove }) {
  return (
    <button
      type="button"
      aria-label={`Remove ${label}`}
      title={`Remove ${label}`}
      onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
      onKeyDown={(e) => e.stopPropagation()}
      className="shrink-0 cursor-pointer rounded-full p-0.5 text-[#2a6a8f]/60 transition hover:bg-[#3482AE]/25 hover:text-[#1f5f86]"
    >
      <X className="h-3 w-3" />
    </button>
  );
}

/**
 * Checkbox-dropdown multi-select (Department / Grade), styled to match the
 * other form controls. The closed field reads back what was chosen.
 *
 * The list is type-to-filter — these run to dozens of departments and grades,
 * so scrolling to find one is impractical. Filtering only hides rows; ticks
 * already made stay selected.
 *
 * @param {{value: string, label: string, search?: string}[]} options `search` is
 *   what typing matches against when it is not the label — the employee field
 *   shows bare codes but is still searched by name, and a list of codes that
 *   only answered to codes would be unusable.
 * @param {string} [allLabel] when given, an "All …" row is offered above the
 *   list that ticks or clears everything at once. It is a real checkbox rather
 *   than a link because it also has to READ as the current state: a field with
 *   every option ticked is "all of them", and showing that unticked would be a
 *   lie. Its own tick follows the list, so removing one option unticks it.
 * @param {boolean} [disabled] the field is not answerable yet — it will not
 *   open, and its badges lose their × so nothing can be changed through them
 *   either. Say why in `placeholder`; a greyed field with no reason reads as
 *   broken. See DEPARTMENT on the module form, which waits on PLANT.
 */
export default function MultiSelect({
  options = [],
  selected = [],
  onChange,
  placeholder,
  searchPlaceholder = "Type to search…",
  allLabel = "",
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);
  const searchRef = useRef(null);

  /**
   * Whether the list is actually down. Derived rather than stored, so a field
   * that goes disabled while its list is open closes in the same render —
   * anything else leaves the dropdown hanging over the form with nothing able
   * to shut it, since a disabled field no longer answers a click.
   */
  const isOpen = open && !disabled;

  useEffect(() => {
    if (!isOpen) return undefined;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) searchRef.current?.focus();
  }, [isOpen]);

  /** Opening starts from a clean filter, so a stale query never hides rows. */
  const toggleOpen = () => {
    if (disabled) return;
    const next = !isOpen;
    setOpen(next);
    if (next) setQuery("");
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) =>
      (o.search ?? o.label).toLowerCase().includes(q)
    );
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

  // Every option ticked. `> 0` matters: an empty list must not read as "all".
  const allSelected =
    options.length > 0 && options.every((o) => selected.includes(o.value));

  /**
   * Ticks or clears the whole list — the FULL list, not the filtered view. A
   * search that is narrowing the rows on screen must not silently turn this
   * into "all of the four you can currently see".
   */
  const toggleAll = () => onChange(allSelected ? [] : options.map((o) => o.value));

  // What was picked shows as badges in the field. Only the first few are drawn
  // so the control keeps one height however many are chosen — the rest are
  // counted, and the title carries the full list.
  const selectedOptions = options.filter((o) => selected.includes(o.value));
  const shown = selectedOptions.slice(0, INLINE_LABELS);
  const extra = selectedOptions.length - INLINE_LABELS;

  /** Takes one value off the selection, without touching the rest. */
  const remove = (value) => onChange(selected.filter((v) => v !== value));

  return (
    <div className="relative" ref={ref}>
      {/* A div rather than a button: every badge now carries its own remove
          button, and a <button> cannot legally contain another one. The role,
          tabIndex and key handler give back everything the button provided. */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-expanded={isOpen}
        aria-disabled={disabled || undefined}
        onClick={toggleOpen}
        onKeyDown={(e) => {
          // Only when the field itself has focus — Enter on a badge's × is that
          // button's to handle, and must not also open the list.
          if (disabled || e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleOpen();
          }
        }}
        title={disabled ? placeholder : selectedLabels.join(", ")}
        className={`flex w-full items-center justify-between gap-2 rounded border px-2 py-1.5 text-left text-[12px] outline-none transition focus:border-[#3482AE] focus:ring-2 focus:ring-[#3482AE]/30 ${
          disabled
            ? "cursor-not-allowed border-gray-200 bg-gray-100"
            : "cursor-pointer border-gray-300 bg-white"
        }`}
      >
        <span className="flex min-w-0 flex-1 flex-nowrap items-center gap-1.5 overflow-hidden">
          {allLabel && allSelected ? (
            // One badge instead of three-plus-a-count: "all of them" is the
            // thing being said, and spelling out the first three implies a
            // selection that stops there. Its × clears the lot.
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#3482AE]/10 py-1 pr-1 pl-2.5 text-[11px] font-semibold text-[#2a6a8f] ring-1 ring-[#3482AE]/20">
              <span className="truncate">{allLabel}</span>
              {/* No × while the field is shut: it is the one control that would
                  still change the value through a disabled field. */}
              {disabled ? null : (
                <RemoveBadgeBtn label={allLabel} onRemove={() => onChange([])} />
              )}
            </span>
          ) : selectedOptions.length === 0 ? (
            <span className="px-1 text-gray-400">{placeholder}</span>
          ) : (
            shown.map((o) => (
              <span
                key={o.value}
                className="flex max-w-[45%] shrink-0 items-center gap-1 rounded-full bg-[#3482AE]/10 py-1 pr-1 pl-2.5 text-[11px] font-semibold text-[#2a6a8f] ring-1 ring-[#3482AE]/20"
              >
                <span className="truncate">{o.label}</span>
                {disabled ? null : (
                  <RemoveBadgeBtn
                    label={o.label}
                    onRemove={() => remove(o.value)}
                  />
                )}
              </span>
            ))
          )}
          {allLabel && allSelected ? null : extra > 0 ? (
            <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600 ring-1 ring-gray-300">
              +{extra}
            </span>
          ) : null}
        </span>
        <span className="shrink-0 text-gray-400">▾</span>
      </div>

      {isOpen ? (
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

          {/* Outside the scrolling list, so it stays reachable however far down
              a long list of departments the officer has scrolled. */}
          {allLabel && options.length > 0 ? (
            <label className="flex cursor-pointer items-center gap-2 border-b border-gray-200 bg-[#fbfcfd] px-3 py-2 text-[12px] font-semibold text-[#2a6a8f] hover:bg-[#eaf3f9]">
              <input
                type="checkbox"
                className="accent-[#3482AE]"
                checked={allSelected}
                onChange={toggleAll}
              />
              {allLabel}
              <span className="ml-auto text-[11px] font-normal normal-case text-gray-500">
                {selected.length}/{options.length}
              </span>
            </label>
          ) : null}

          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-[12px] text-gray-500">No matches</p>
            ) : (
              filtered.map((o) => (
                <label
                  key={o.value}
                  // Whatever the row does not spell out, on hover — a field of
                  // bare employee codes is otherwise unreadable.
                  title={o.search ?? o.label}
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
