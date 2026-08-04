/**
 * The building blocks of the user guide.
 *
 * A guide card is the same white card every other screen uses — a solid
 * coloured header bar over a bordered white body — so the manual reads as part
 * of the app rather than a document dropped into it. Colours come from
 * `@/lib/palette`, which is payroll's palette verbatim.
 */

import { BRAND, DANGER, PENDING, APPROVED, REJECTED } from "@/lib/palette";
import { gradient } from "@/components/userGuide/GuideArt";

/**
 * One section of the manual.
 *
 * @param {object} props
 * @param {string} props.title shown in the header bar, upper-cased by the style
 * @param {React.ElementType} [props.icon] lucide icon for the header bar
 * @param {string} [props.color] header fill; defaults to brand teal
 * @param {string} [props.subtitle] one line under the title, inside the body
 */
export function GuideCard({ id, title, icon: Icon, color = BRAND, subtitle, children }) {
  return (
    <section
      id={id}
      // Chips jump here, and the app's own header bar sits over the top of the
      // scroll area — without the offset the heading lands underneath it.
      className="scroll-mt-6 overflow-hidden rounded-xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] ring-1 ring-black/5"
    >
      {/* The header carries the gradient and a soft diagonal sheen over it, so
          a row of cards reads as depth rather than as flat colour bars. */}
      <div
        className="relative flex items-center gap-3 overflow-hidden px-5 py-4"
        style={{ backgroundImage: gradient(color) }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-10 -right-8 h-32 w-32 rounded-full bg-white/10"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -bottom-14 h-28 w-28 rounded-full bg-black/5"
        />
        {Icon ? (
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/25 backdrop-blur-sm">
            <Icon className="h-5 w-5 text-white" />
          </span>
        ) : null}
        <h2 className="relative text-[17px] leading-tight font-bold tracking-[-0.01em] normal-case text-white drop-shadow-sm sm:text-[18px]">
          {title}
        </h2>
      </div>
      <div className="space-y-4 px-5 py-5 sm:px-6">
        {subtitle ? (
          <p className="text-[14px] leading-[1.85] normal-case text-gray-600">
            {subtitle}
          </p>
        ) : null}
        {children}
      </div>
    </section>
  );
}

/**
 * A row of solid tiles standing in for the dashboard cards being described —
 * the same shapes the reader is looking at on the real screen.
 *
 * @param {{ items: Array<{label: string, color: string, icon?: React.ElementType}> }} props
 */
export function MiniCards({ items }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map(({ label, color, icon: Icon }) => (
        <div
          key={label}
          className="relative flex flex-col items-center justify-center gap-2 overflow-hidden rounded-xl px-2 py-5 text-white shadow-md transition-transform hover:-translate-y-0.5"
          style={{ backgroundImage: gradient(color, 160) }}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-8 -right-6 h-20 w-20 rounded-full bg-white/10"
          />
          {Icon ? <Icon className="relative h-8 w-8 drop-shadow" /> : null}
          <span className="relative text-center text-[11px] font-bold tracking-[0.06em] uppercase">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

/** The heading over a block inside a card — mirrors course `BlockHeading`. */
export function GuideHeading({ icon, children }) {
  return (
    <h3 className="mt-1 mb-2.5 flex items-center gap-2.5 text-[15px] font-bold normal-case text-gray-800">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[#3482AE]/10 text-[#3482AE]">
        {icon}
      </span>
      {children}
    </h3>
  );
}

/**
 * A numbered walk-through. Each item is a string, or `{ title, text }` when the
 * step needs a bold lead-in.
 *
 * @param {{ items: Array<string|{title?: string, text: string}> }} props
 */
export function Steps({ items }) {
  return (
    <ol className="space-y-4">
      {items.map((item, index) => {
        const { title, text } = typeof item === "string" ? { text: item } : item;
        return (
          <li key={index} className="flex gap-3.5">
            <span
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white shadow-sm"
              style={{ backgroundImage: gradient(BRAND, 150) }}
            >
              {index + 1}
            </span>
            <div className="min-w-0 pt-0.5">
              {title ? (
                <p className="text-[14.5px] leading-snug font-bold normal-case text-[#2c7bb0]">
                  {title}
                </p>
              ) : null}
              <p
                className={`text-[14px] leading-[1.8] normal-case text-gray-600 ${
                  title ? "mt-1" : ""
                }`}
              >
                {text}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** A plain list of points, ticked rather than bulleted. */
export function Bullets({ items }) {
  return (
    <ul className="space-y-2">
      {items.map((text, index) => (
        <li key={index} className="flex gap-2.5">
          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#3482AE]" />
          <p className="text-[14px] leading-[1.85] normal-case text-gray-700">
            {text}
          </p>
        </li>
      ))}
    </ul>
  );
}

/**
 * Term-and-meaning rows — used for the status tiles and the on-screen badges,
 * where the point is what a colour or word means.
 *
 * @param {{ items: Array<{term: string, color?: string, text: string}> }} props
 */
export function Terms({ items }) {
  return (
    <dl className="space-y-2.5">
      {items.map(({ term, color, text }) => (
        <div key={term} className="flex flex-wrap items-start gap-x-3 gap-y-1">
          <dt
            className="mt-0.5 shrink-0 rounded-md px-2.5 py-1 text-[11px] font-bold tracking-[0.05em] text-white uppercase shadow-sm"
            style={{ backgroundImage: gradient(color || BRAND, 150) }}
          >
            {term}
          </dt>
          <dd className="min-w-[12rem] flex-1 text-[14px] leading-[1.85] normal-case text-gray-700">
            {text}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A drawing of a form the reader is about to fill in.
 *
 * Deliberately not real inputs: nothing here submits anywhere, and a field that
 * accepts typing invites someone to fill in the manual instead of the screen.
 * They are boxes that look like the form, with the same labels and the same
 * placeholder text as the real one.
 *
 * @param {object} props
 * @param {string} props.title the badge across the top
 * @param {Array<{label: string, placeholder?: string, options?: string[],
 *   wide?: boolean, lines?: number}>} props.fields
 * @param {Array<{label: string, tone?: "brand"|"danger"}>} [props.actions]
 */
export function FormMock({ title, fields, actions = [] }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-[#f8f9fa] p-4 sm:p-5">
      {title ? (
        <span
          className="mb-4 inline-block rounded-md px-4 py-2.5 text-[12px] font-bold tracking-[0.04em] text-white uppercase shadow-sm"
          style={{ backgroundImage: gradient(BRAND, 150) }}
        >
          {title}
        </span>
      ) : null}

      <div className="grid grid-cols-1 gap-x-5 gap-y-3.5 sm:grid-cols-2">
        {fields.map((field) => (
          <div
            key={field.label}
            className={field.wide || field.options ? "sm:col-span-2" : undefined}
          >
            <p className="mb-1 text-[12.5px] font-semibold normal-case text-[#3482AE]">
              {field.label}
            </p>

            {field.options ? (
              // Multiple choice, laid out row-major across two columns — the
              // same shape the assignment and feedback papers use.
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {field.options.map((option, i) => (
                  <div
                    key={option}
                    className="flex items-center gap-2.5 rounded border border-gray-300 bg-white px-3 py-2"
                  >
                    <span className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-gray-300" />
                    <span className="text-[13px] font-semibold normal-case text-[#3086b5]">
                      {String.fromCharCode(65 + i)})
                    </span>
                    <span className="truncate text-[13px] normal-case text-gray-600">
                      {option}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="rounded border border-gray-300 bg-white px-3 py-2 text-[13px] normal-case text-gray-400"
                style={
                  field.lines
                    ? { minHeight: `${field.lines * 20 + 16}px` }
                    : undefined
                }
              >
                {field.placeholder}
              </div>
            )}
          </div>
        ))}
      </div>

      {actions.length ? (
        <div className="mt-4 flex flex-wrap gap-2.5">
          {actions.map(({ label, tone }) => (
            <span
              key={label}
              className="rounded px-5 py-2 text-[13px] font-semibold normal-case text-white shadow-sm"
              style={{
                backgroundImage: gradient(tone === "danger" ? DANGER : BRAND, 150),
              }}
            >
              {label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const NOTICE_TONES = {
  info: { border: BRAND, bg: "#eaf3f9", ink: "#215875" },
  warn: { border: PENDING, bg: "#fff8e6", ink: "#7a5c00" },
  success: { border: APPROVED, bg: "#e7f8f2", ink: "#12705a" },
  danger: { border: REJECTED, bg: "#fdecee", ink: "#a71d2a" },
};

/**
 * A tinted call-out. The same shape the course page uses for its "new content"
 * and "feedback is mandatory" banners.
 *
 * @param {{ tone?: keyof typeof NOTICE_TONES }} props
 */
export function Notice({ tone = "info", children }) {
  const { border, bg, ink } = NOTICE_TONES[tone] ?? NOTICE_TONES.info;
  return (
    <p
      className="rounded-lg border-l-4 px-4 py-3 text-[14px] leading-[1.8] normal-case"
      style={{ borderColor: border, backgroundColor: bg, color: ink }}
    >
      {children}
    </p>
  );
}

export default GuideCard;
