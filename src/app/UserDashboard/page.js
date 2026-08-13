"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  Hourglass,
} from "lucide-react";

import StatusCard from "@/components/StatusCard";
import CompletedCoursesGrid from "@/components/dashboards/CompletedCoursesGrid";
import FilterBar from "@/components/dashboards/FilterBar";
import ModulesGrid from "@/components/dashboards/ModulesGrid";
import QuarterFilters from "@/components/dashboards/QuarterFilters";
import { useAuth } from "@/context/AuthContext";
import {
  LEARNER_FILTER_KEY,
  quarterFilterParams,
  useQuarterFilter,
} from "@/hooks/useQuarterFilter";
import { getEmpCode } from "@/lib/permissions";
import { apiErrorMessage } from "@/config/api";
import {
  COURSE_STATUS,
  getUserCourses,
  getUserCoursesWithStamps,
} from "@/services/UserCourseService";

const TAB_CONFIG = [
  {
    id: "pending",
    status: COURSE_STATUS.PENDING,
    label: "PENDING",
    header: "PENDING COURSES",
    icon: Hourglass,
    color: "bg-[#ffc107] hover:bg-[#e0a800]",
    accent: "#ffc107",
  },
  {
    id: "in-process",
    status: COURSE_STATUS.IN_PROCESS,
    label: "IN PROCESS",
    header: "IN-PROCESS COURSES",
    icon: BookOpen,
    color: "bg-[#3482AE] hover:bg-[#2a6a8f]",
    accent: "#3482AE",
  },
  {
    id: "completed",
    status: COURSE_STATUS.COMPLETED,
    label: "COMPLETED",
    header: "COMPLETED COURSES",
    icon: CheckCircle2,
    color: "bg-[#20c997] hover:bg-[#1aa179]",
    accent: "#20c997",
  },
  {
    id: "overdue",
    status: COURSE_STATUS.OVERDUE,
    label: "OVERDUE",
    header: "OVERDUE COURSES",
    icon: AlertTriangle,
    color: "bg-[#dc3545] hover:bg-[#c82333]",
    accent: "#dc3545",
  },
];

export default function UserDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const empCode = getEmpCode(user);

  // One selection across all four tabs, on its own key so a learner who is also
  // a training officer does not carry one screen's filter into the other. Opens
  // on every year and quarter, unlike the officer's screens: a learner has to be
  // able to see a course the moment it is assigned, including one raised for a
  // quarter — or a year — still ahead.
  const filter = useQuarterFilter(LEARNER_FILTER_KEY, {
    openOnEverything: true,
  });

  const [activeTab, setActiveTab] = useState("pending");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const active = TAB_CONFIG.find((t) => t.id === activeTab) ?? TAB_CONFIG[0];

  // Only the open status is fetched. The tiles above are navigation, not
  // counters, so the other three statuses have nothing to load.
  const fetchCourses = useCallback(async () => {
    if (!empCode) return;
    try {
      setLoading(true);
      setError(null);
      // Only the lists that show an ASSIGNED ON column pay for the history
      // read behind it — the completed list shows when the course was
      // finished, which is on the learner's own row already.
      const quarterFilter = quarterFilterParams(filter.year, filter.quarter);
      setData(
        active.status === COURSE_STATUS.COMPLETED
          ? await getUserCourses(empCode, active.status, quarterFilter)
          : await getUserCoursesWithStamps(empCode, active.status, quarterFilter)
      );
    } catch (err) {
      setData([]);
      setError(apiErrorMessage(err, "Failed to fetch your courses"));
    } finally {
      setLoading(false);
    }
  }, [empCode, active.status, filter.year, filter.quarter]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  return (
    <div className="p-4 bg-[#f5f8fa] overflow-x-hidden">
      {/* Header */}
      <header className="flex items-center justify-between mx-6 my-4">
        <h1 className="text-[16px] font-bold text-[#3482AE] uppercase tracking-wide">
          USER DASHBOARD
        </h1>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 px-4 py-2 bg-[#3482AE] text-white text-sm font-semibold rounded shadow hover:bg-[#2a6a8f] transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> BACK
        </button>
      </header>

      {/* Status Tabs */}
      <nav className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {TAB_CONFIG.map((tab) => (
          <StatusCard
            key={tab.id}
            label={tab.label}
            Icon={tab.icon}
            color={tab.color}
            animate={tab.animate}
            isActive={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          />
        ))}
      </nav>

      {/* Tab Content */}
      <main className="w-full overflow-x-hidden">
        {/* Above the heading and shared by every tab, so switching between
            Pending and Completed keeps the quarter being looked at. */}
        <FilterBar accent={active.accent}>
          <QuarterFilters
            year={filter.year}
            quarter={filter.quarter}
            onYearChange={filter.setYear}
            onQuarterChange={filter.setQuarter}
          />
        </FilterBar>

        {active.id === "completed" ? (
          <CompletedCoursesGrid
            data={data}
            loading={loading}
            error={error}
            onRetry={fetchCourses}
            title={active.header}
            headerColor={active.accent}
          />
        ) : (
          <ModulesGrid
            data={data}
            loading={loading}
            error={error}
            onRetry={fetchCourses}
            title={active.header}
            headerColor={active.accent}
            emptyMessage={`No ${active.label.toLowerCase()} courses found`}
          />
        )}
      </main>
    </div>
  );
}
