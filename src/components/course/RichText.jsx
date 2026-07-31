import { Fragment } from "react";
import { Check } from "lucide-react";

/**
 * A small, dependency-free renderer for the markdown subset course authors use
 * in descriptions: `#`..`######` headings, `**bold**`, and `*`/`-` bullet
 * lists, with blank lines separating paragraphs. Bullet lists render as a
 * two-column checklist so long curricula stay readable. Input is plain text, so
 * there is no raw HTML to sanitise.
 */

function parseBlocks(md) {
  const lines = String(md ?? "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let list = null;

  const flushList = () => {
    if (list) {
      blocks.push({ type: "list", items: list });
      list = null;
    }
  };

  lines.forEach((raw) => {
    const line = raw.trim();
    if (!line) {
      flushList();
      return;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushList();
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2] });
      return;
    }
    const item = line.match(/^[*-]\s+(.*)$/);
    if (item) {
      if (!list) list = [];
      list.push(item[1]);
      return;
    }
    flushList();
    blocks.push({ type: "paragraph", text: line });
  });

  flushList();
  return blocks;
}

/** Renders inline `**bold**` runs within a line. */
function inline(text, keyPrefix) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return (
        <strong key={key} className="font-semibold text-gray-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

export default function RichText({ text }) {
  const blocks = parseBlocks(text);

  return (
    <div className="space-y-3 text-[13px] normal-case leading-relaxed text-gray-700">
      {blocks.map((block, i) => {
        if (block.type === "heading") {
          const cls =
            block.level <= 2
              ? "text-base font-bold text-gray-900"
              : block.level === 3
                ? "text-[14px] font-bold text-gray-900"
                : "text-[13px] font-bold text-[#3482AE]";
          return (
            <p key={i} className={`${cls} normal-case ${i === 0 ? "" : "pt-2"}`}>
              {inline(block.text, `h${i}`)}
            </p>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={i} className="grid grid-cols-1 gap-x-10 gap-y-1.5 sm:grid-cols-2">
              {block.items.map((it, j) => (
                <li key={j} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#3482AE]" />
                  <span className="min-w-0">{inline(it, `li${i}-${j}`)}</span>
                </li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{inline(block.text, `p${i}`)}</p>;
      })}
    </div>
  );
}
