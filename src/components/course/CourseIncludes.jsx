import {
  BookOpen,
  CirclePlay,
  Download,
  GraduationCap,
  Layers,
  MonitorSmartphone,
} from "lucide-react";

/**
 * "This course includes:" — a two-column icon list summarising the course's
 * content, built from real data (sections, lectures, videos, downloadable
 * PDFs), plus the standing perks (mobile/desktop access, certificate).
 *
 * `compact` is the preview card in the sidebar. At that width it drops the
 * section and lecture counts and the mobile/desktop line, leaving only what the
 * course itself carries; the full list on the course card states the rest.
 */
export default function CourseIncludes({ course, compact = false }) {
  const lectures = course.sections.flatMap((s) => s.lectures);
  const totalLectures = lectures.length;
  const videoCount = lectures.filter((l) => l.link || l.materialVideo).length;
  const pdfCount = lectures.filter((l) => l.materialFile).length;

  const items = [
    ...(compact
      ? []
      : [
          {
            icon: <Layers className="h-3.5 w-3.5" />,
            label: `${course.sections.length} section${
              course.sections.length === 1 ? "" : "s"
            }`,
          },
          {
            icon: <BookOpen className="h-3.5 w-3.5" />,
            label: `${totalLectures} lecture${totalLectures === 1 ? "" : "s"}`,
          },
        ]),
    ...(videoCount
      ? [
          {
            icon: <CirclePlay className="h-3.5 w-3.5" />,
            label: `${videoCount} on-demand video${videoCount === 1 ? "" : "s"}`,
          },
        ]
      : []),
    ...(pdfCount
      ? [
          {
            icon: <Download className="h-3.5 w-3.5" />,
            label: `${pdfCount} downloadable resource${pdfCount === 1 ? "" : "s"}`,
          },
        ]
      : []),
    ...(compact
      ? []
      : [
          {
            icon: <MonitorSmartphone className="h-3.5 w-3.5" />,
            label: "Access on mobile and desktop",
          },
        ]),
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
      {/* `compact` keeps one column — the preview card in the sidebar is too
          narrow for two, however wide the viewport is. */}
      <ul
        className={`grid grid-cols-1 gap-x-10 gap-y-2 ${
          compact ? "" : "sm:grid-cols-2"
        }`}
      >
        {items.map((item, i) => (
          <li
            key={i}
            className="flex items-center gap-3 text-[13px] normal-case text-gray-700"
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
