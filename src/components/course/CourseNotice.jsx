"use client";

import React from "react";
import Link from "next/link";

/**
 * The card shown in place of a course form when there is nothing to fill in —
 * already submitted, not pending, no questions set up, or a load failure.
 * Same card shape payroll gives every panel.
 */
export default function CourseNotice({ tone = "info", emoduleId, title, children }) {
  const headerColor = tone === "error" ? "#dc3545" : "#3482AE";

  return (
    <div className="bg-white rounded shadow border border-gray-200 overflow-hidden text-[12px] mx-auto max-w-md">
      {/* Header */}
      <div className="px-4 py-2" style={{ backgroundColor: headerColor }}>
        <h2 className="text-white font-bold uppercase tracking-wide">
          {title ?? (tone === "error" ? "Something went wrong" : "Notice")}
        </h2>
      </div>

      <div className="p-3 space-y-4 text-center">
        <p className={`normal-case ${tone === "error" ? "text-red-500" : "text-gray-700"}`}>
          {children}
        </p>
        <Link
          href={`/course/${emoduleId}`}
          className="inline-block px-6 py-2 bg-[#3482AE] text-white text-sm font-semibold rounded shadow hover:bg-[#2a6a8f] transition-colors"
        >
          BACK TO COURSE
        </Link>
      </div>
    </div>
  );
}

/** The centred spinner payroll shows while a panel's data loads. */
export function CourseLoading({ color = "#3482AE" }) {
  return (
    <div className="bg-white rounded shadow border border-gray-200 overflow-hidden text-[12px]">
      <div className="flex justify-center items-center p-8">
        <div
          className="animate-spin rounded-full h-8 w-8 border-b-2"
          style={{ borderColor: color }}
        ></div>
      </div>
    </div>
  );
}
