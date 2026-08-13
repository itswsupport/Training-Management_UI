"use client";

import { EXAM_TYPE_LIST } from "@/lib/examType";

/**
 * Pre / Post switch for one lecture's assignment block.
 *
 * A segmented pair rather than a dropdown: there are only ever two papers, both
 * matter, and the officer needs to see at a glance how many questions each
 * already holds — which is what the count beside each label is for. Switching
 * only changes which paper is on screen; nothing is moved between them.
 *
 * @param {string} value the paper currently shown
 * @param {(type: string) => void} onChange
 * @param {Object<string, number>} counts questions written so far, per paper
 */
export default function ExamTypeToggle({ value, onChange, counts = {} }) {
  return (
    <div
      role="tablist"
      aria-label="Assignment paper"
      className="inline-flex shrink-0 gap-0.5 rounded-md border border-[#3482AE]/40 bg-white p-0.5"
    >
      {EXAM_TYPE_LIST.map((type) => {
        const active = value === type.value;
        const count = counts[type.value] ?? 0;
        return (
          <button
            key={type.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(type.value)}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase transition-colors ${
              active
                ? "bg-[#3482AE] text-white"
                : "text-[#3482AE] hover:bg-[#eaf3f9]"
            }`}
          >
            {type.label}
            {/* The count is on BOTH tabs, not just the open one — the whole
                point of the switch is to show that the other paper has (or has
                not) been written without having to click over to it. */}
            <span
              className={`rounded-full px-1.5 py-px text-[10px] font-semibold normal-case ${
                active
                  ? "bg-white/25 text-white"
                  : count > 0
                    ? "bg-[#3482AE]/10 text-[#2a6a8f]"
                    : "bg-gray-100 text-gray-400"
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
