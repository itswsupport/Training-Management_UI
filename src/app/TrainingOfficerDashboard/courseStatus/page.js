"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import OfficerActionCards from "@/components/cards/OfficerActionCards";
import CourseStatusGrid from "@/components/dashboards/CourseStatusGrid";
import { apiErrorMessage } from "@/config/api";
import { getCourseStatusRows } from "@/services/CourseStatusService";

export default function CourseStatus() {
  const router = useRouter();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCourseStatus = useCallback(async (force = false) => {
    try {
      setLoading(true);
      setError(null);
      setData(await getCourseStatusRows({ force }));
    } catch (err) {
      setData([]);
      setError(apiErrorMessage(err, "Failed to fetch course status"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCourseStatus();
  }, [fetchCourseStatus]);

  return (
    <div className="p-4 bg-[#f5f8fa] overflow-x-hidden">
      {/* Header */}
      <header className="flex items-center justify-between mx-6 my-4">
        <h1 className="text-[16px] font-bold text-[#3482AE] uppercase tracking-wide">
          COURSE STATUS
        </h1>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 px-4 py-2 bg-[#3482AE] text-white text-sm font-semibold rounded shadow hover:bg-[#2a6a8f] transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> BACK
        </button>
      </header>

      {/* Status Tabs — this screen has no panels of its own, so the other tiles
          open their tab back on the dashboard. */}
      <OfficerActionCards />

      {/* Tab Content */}
      <main className="w-full overflow-x-hidden">
        <CourseStatusGrid
          data={data}
          loading={loading}
          error={error}
          onRetry={() => fetchCourseStatus(true)}
        />
      </main>
    </div>
  );
}
