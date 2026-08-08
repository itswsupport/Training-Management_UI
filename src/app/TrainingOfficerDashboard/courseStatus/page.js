"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import OfficerActionCards from "@/components/cards/OfficerActionCards";
import CourseStatusGrid, {
  STATUS_ALL,
  STATUS_CHOICES,
} from "@/components/dashboards/CourseStatusGrid";
import FilterBar from "@/components/dashboards/FilterBar";
import QuarterFilters from "@/components/dashboards/QuarterFilters";
import ToolbarSelect from "@/components/ui/common/ToolbarSelect";
import { apiErrorMessage } from "@/config/api";
import { useQuarterFilter } from "@/hooks/useQuarterFilter";
import { getCourseStatusRows } from "@/services/CourseStatusService";

export default function CourseStatus() {
  const router = useRouter();
  const filter = useQuarterFilter();
  const [status, setStatus] = useState(STATUS_ALL);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCourseStatus = useCallback(async (force = false) => {
    try {
      setLoading(true);
      setError(null);
      setData(
        await getCourseStatusRows({
          force,
          financialYear: filter.year,
          quarter: filter.quarter,
        })
      );
    } catch (err) {
      setData([]);
      setError(apiErrorMessage(err, "Failed to fetch course status"));
    } finally {
      setLoading(false);
    }
  }, [filter.year, filter.quarter]);

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
        {/* The same pair as ALL MODULES, in the same place and holding the
            same selection — arriving here from that screen keeps the quarter
            the officer was looking at. */}
        <FilterBar accent="#20c997">
          <QuarterFilters
            year={filter.year}
            quarter={filter.quarter}
            onYearChange={filter.setYear}
            onQuarterChange={filter.setQuarter}
          />
          {/* This screen's own filter, beside the two it shares with ALL
              MODULES rather than back inside the table's toolbar. */}
          <ToolbarSelect
            label="Status"
            value={status}
            onChange={setStatus}
            options={STATUS_CHOICES}
          />
        </FilterBar>
        <CourseStatusGrid
          data={data}
          loading={loading}
          error={error}
          onRetry={() => fetchCourseStatus(true)}
          status={status}
        />
      </main>
    </div>
  );
}
