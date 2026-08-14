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
 * No "Filters" heading on the bar. Every control in it is already labelled with
 * the thing it filters, so the word only repeated what the row plainly was, and
 * on the screens carrying five of them it was taking width off the controls
 * that needed it.
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
      {children}
    </div>
  );
}
