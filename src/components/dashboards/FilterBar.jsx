"use client";

/**
 * The strip of filters above a grid.
 *
 * Given the same card treatment as the grid below it — white, hairline border,
 * the same corner radius — so the two read as one panel with a divider rather
 * than as a control that happens to be floating above a table. The left accent
 * borrows the heading colour of whichever grid it belongs to, which is what
 * ties the pair together on a page carrying more than one.
 *
 * The word alone, with no icon beside it: the funnel and its neighbours belong
 * to the table's own toolbar on the right, and a second filter glyph over here
 * would read as another control of the same kind rather than as a heading.
 *
 * @param {object} props
 * @param {string} [props.accent] the grid's header colour
 * @param {React.ReactNode} props.children the controls, laid out in one row
 */
export default function FilterBar({ accent = "#3482AE", children }) {
  return (
    <div
      className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-3 rounded border border-gray-200 border-l-4 bg-white px-4 py-2.5 shadow-sm"
      style={{ borderLeftColor: accent }}
    >
      <span className="text-[11px] font-bold tracking-wide text-gray-400 uppercase">
        Filters
      </span>
      {children}
    </div>
  );
}
