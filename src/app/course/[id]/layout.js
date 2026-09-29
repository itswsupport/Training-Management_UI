"use client";

import React from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { getDefaultDashboardForUser } from "@/lib/permissions";

/**
 * The course area's chrome, in payroll's page shape: a tinted page field, a
 * teal uppercase title with a BACK button, then the route's content.
 * Sidebar and header come from ProtectedLayout.
 */
export default function CourseLayout({ children }) {
  const router = useRouter();
  const { id } = useParams();
  const pathname = usePathname();
  const { user } = useAuth();

  /**
   * Back one page — or, in a tab that has no page to go back to, up one level.
   *
   * OPEN IN NEW TAB starts the lecture and reading pages in a fresh tab whose
   * history holds nothing but themselves, so router.back() there did nothing
   * at all. Such a tab goes to the course the page belongs to instead, and the
   * course page itself to the dashboard.
   */
  const goBack = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    const coursePath = `/course/${id}`;
    const onCourse = pathname.replace(/\/$/, "").endsWith(coursePath);
    router.push(onCourse ? getDefaultDashboardForUser(user) : coursePath);
  };

  return (
    <div className="p-4 bg-[#f5f8fa] overflow-x-hidden">
      {/* Header */}
      <header className="flex items-center justify-between mx-6 my-4">
        <h1 className="text-[16px] font-bold text-[#3482AE] uppercase tracking-wide">
          TRAINING MODULES
        </h1>
        <button
          onClick={goBack}
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
