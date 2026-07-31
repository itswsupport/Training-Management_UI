"use client";

import { useState } from "react";
import { Check, ChevronDown, GraduationCap } from "lucide-react";

import BlockHeading from "@/components/course/BlockHeading";

/**
 * "What you'll learn": the course's learning objectives laid out as a
 * checklist, collapsed to the first few with a Show more / Show less toggle
 * when there are many.
 *
 * `embedded` drops the card chrome and renders it as a labelled block, for use
 * inside the course header card alongside the description and topics.
 */
export default function WhatYouLearn({ objectives = [], embedded = false }) {
  const [showAll, setShowAll] = useState(false);
  const LIMIT = 4;
  const collapsible = objectives.length > LIMIT;
  const visible = showAll || !collapsible ? objectives : objectives.slice(0, LIMIT);

  const body = (
    <>
      {/* One column when embedded — the card it sits in is already the narrow
          side of the page. */}
      <ul
        className={`grid grid-cols-1 gap-x-10 gap-y-3 ${
          embedded ? "" : "sm:grid-cols-2"
        }`}
      >
        {visible.map((objective, i) => (
          <li
            key={i}
            className="flex items-start gap-2.5 text-[13px] normal-case leading-relaxed text-gray-700"
          >
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
            <span className="min-w-0">{objective}</span>
          </li>
        ))}
      </ul>

      {collapsible ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 flex cursor-pointer items-center gap-1 text-[13px] font-bold normal-case text-[#3482AE] hover:underline"
        >
          {showAll ? "Show less" : "Show more"}
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${showAll ? "rotate-180" : ""}`}
          />
        </button>
      ) : null}
    </>
  );

  if (embedded) {
    return (
      <div>
        <BlockHeading icon={<GraduationCap className="h-3.5 w-3.5" />}>
          What you&apos;ll learn
        </BlockHeading>
        {body}
      </div>
    );
  }

  return (
    <section className="bg-white rounded shadow border border-gray-200 overflow-hidden text-[12px]">
      {/* Header */}
      <div className="bg-[#3482AE] px-4 py-2">
        <h2 className="text-white font-bold uppercase tracking-wide">
          What you&apos;ll learn
        </h2>
      </div>

      <div className="p-3 space-y-4">{body}</div>
    </section>
  );
}
