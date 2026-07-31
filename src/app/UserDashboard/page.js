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
import ModulesGrid from "@/components/dashboards/ModulesGrid";
import { useAuth } from "@/context/AuthContext";
import { getEmpCode } from "@/lib/permissions";
import { apiErrorMessage } from "@/config/api";
import { COURSE_STATUS, getUserCourses } from "@/services/UserCourseService";

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
      setData(await getUserCourses(empCode, active.status));
    } catch (err) {
      setData([]);
      setError(apiErrorMessage(err, "Failed to fetch your courses"));
    } finally {
      setLoading(false);
    }
  }, [empCode, active.status]);

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
          // Overdue is view-only: the quarter lapsed, so the course can be seen
          // but not opened, started, or acted on.
          <ModulesGrid
            data={data}
            loading={loading}
            error={error}
            onRetry={fetchCourses}
            readOnly={active.id === "overdue"}
            title={active.header}
            headerColor={active.accent}
            emptyMessage={`No ${active.label.toLowerCase()} courses found`}
          />
        )}
      </main>
    </div>
  );
}
