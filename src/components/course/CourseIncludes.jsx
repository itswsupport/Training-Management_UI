import { BookOpen, Download, GraduationCap, Layers } from "lucide-react";

/**
 * "This course includes:" — an icon list summarising the course's content,
 * built from real data (sections, lectures, downloadable files), plus the
 * certificate at the end of it.
 *
 * It is drawn once, in the player card. The course card beside it carried a
 * second, fuller copy, so the same list was stated twice on one screen.
 *
 * `compact` is that card in the sidebar, and now means spacing only — the
 * columns are tighter at that width. It used to drop items as well, which is
 * why removing the duplicate would otherwise have taken the section and lecture
 * counts with it.
 */
export default function CourseIncludes({ course, compact = false }) {
  const lectures = course.sections.flatMap((s) => s.lectures);
  const totalLectures = lectures.length;
  const pdfCount = lectures.filter((l) => l.materialFile).length;

  // `half` shares a row with the item beside it. The two counts are short
  // enough to sit together even in the narrow card, and reading as one line
  // says what they are — the shape of the course — rather than two facts.
  const items = [
    {
      half: true,
      icon: <Layers className="h-3.5 w-3.5" />,
      label: `${course.sections.length} section${
        course.sections.length === 1 ? "" : "s"
      }`,
    },
    {
      half: true,
      icon: <BookOpen className="h-3.5 w-3.5" />,
      label: `${totalLectures} lecture${totalLectures === 1 ? "" : "s"}`,
    },
    ...(pdfCount
      ? [
          {
            icon: <Download className="h-3.5 w-3.5" />,
            label: `${pdfCount} downloadable resource${pdfCount === 1 ? "" : "s"}`,
          },
        ]
      : []),
    {
      icon: <GraduationCap className="h-3.5 w-3.5" />,
      label: "Certificate of completion",
    },
  ];

  return (
    <div>
      <h3 className="mb-2.5 flex items-center gap-2 text-[11px] font-bold tracking-wide text-[#3482AE] uppercase">
        <BookOpen className="h-3.5 w-3.5" /> This course includes
      </h3>
      {/* Two columns, so the section and lecture counts pair off on the first
          row. The rest carry longer labels and span the width, which they need
          — "1 downloadable resource" wraps badly in half a card. */}
      <ul
        className={`grid grid-cols-2 gap-y-2 ${compact ? "gap-x-3" : "gap-x-10"}`}
      >
        {items.map((item, i) => (
          <li
            key={i}
            className={`flex items-center gap-3 text-[13px] normal-case text-gray-700 ${
              item.half ? "" : "col-span-2"
            }`}
          >
            <span className="flex w-4 shrink-0 justify-center text-gray-500">
              {item.icon}
            </span>
            <span className="min-w-0">{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
