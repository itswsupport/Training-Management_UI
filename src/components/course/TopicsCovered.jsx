import { Layers } from "lucide-react";

import BlockHeading from "@/components/course/BlockHeading";

/**
 * "Topics covered" — the course's section names rendered as bordered pill tags.
 * Duplicates and blanks are dropped; renders nothing when there are no topics.
 */
export default function TopicsCovered({ topics = [] }) {
  const unique = Array.from(new Set(topics.map((t) => t.trim()).filter(Boolean)));
  if (unique.length === 0) return null;

  return (
    <div>
      <BlockHeading icon={<Layers className="h-3.5 w-3.5" />}>
        Topics covered
      </BlockHeading>
      <div className="flex flex-wrap gap-2">
        {unique.map((topic, i) => (
          <span
            key={i}
            className="inline-flex items-center rounded-full border border-gray-200 bg-[#f8f9fa] px-3.5 py-1.5 text-[12.5px] font-semibold normal-case text-gray-700 transition-colors hover:border-[#3482AE]/40 hover:bg-[#3482AE]/10 hover:text-[#2a6a8f]"
          >
            {topic}
          </span>
        ))}
      </div>
    </div>
  );
}
