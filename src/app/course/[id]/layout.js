"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/**
 * The course area's chrome, in payroll's page shape: a tinted page field, a
 * teal uppercase title with a BACK button, then the route's content.
 * Sidebar and header come from ProtectedLayout.
 */
export default function CourseLayout({ children }) {
  const router = useRouter();

  return (
    <div className="p-4 bg-[#f5f8fa] overflow-x-hidden">
      {/* Header */}
      <header className="flex items-center justify-between mx-6 my-4">
        <h1 className="text-[16px] font-bold text-[#3482AE] uppercase tracking-wide">
          TRAINING MODULES
        </h1>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 px-4 py-2 bg-[#3482AE] text-white text-sm font-semibold rounded shadow hover:bg-[#2a6a8f] transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> BACK
        </button>
      </header>

      {/* Content */}
      <main className="w-full overflow-x-hidden">{children}</main>
    </div>
  );
}
