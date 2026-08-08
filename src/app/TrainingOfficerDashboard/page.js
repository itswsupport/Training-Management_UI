"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import OfficerActionCards from "@/components/cards/OfficerActionCards";
import FilterBar from "@/components/dashboards/FilterBar";
import ModulesGrid from "@/components/dashboards/ModulesGrid";
import QuarterFilters from "@/components/dashboards/QuarterFilters";
import FeedbackFormPanel from "@/components/feedback/FeedbackFormPanel";
import ModuleFormPanel from "@/components/modules/ModuleFormPanel";
import { apiErrorMessage } from "@/config/api";
import { useQuarterFilter } from "@/hooks/useQuarterFilter";
import { getModules } from "@/services/ModuleService";

const TAB_TITLES = {
  add: "TRAINING MODULE FORM",
  modules: "TRAINING OFFICER DASHBOARD",
  feedback: "FEEDBACK FORM",
};

export default function TrainingOfficerDashboard() {
  const router = useRouter();

  // Shared with COURSE STATUS, so opening that screen keeps the quarter the
  // officer is working on rather than resetting to everything.
  const filter = useQuarterFilter();

  const [activeTab, setActiveTab] = useState("modules");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchModules = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // The year and quarter go with the request: the officer's list is the
      // whole table, and fetching all of it to show one quarter is what the
      // filter exists to avoid.
      setData(await getModules({ financialYear: filter.year, quarter: filter.quarter }));
    } catch (err) {
      setData([]);
      setError(apiErrorMessage(err, "Failed to fetch training modules"));
    } finally {
      setLoading(false);
    }
  }, [filter.year, filter.quarter]);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  // The other officer screens link here with ?tab=, as do the old /moduleForm
  // and /feedbackForm routes. Read from location rather than useSearchParams so
  // this page can stay statically prerendered.
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab && TAB_TITLES[tab]) {
      setActiveTab(tab);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const TabContent = {
    add: (
      <ModuleFormPanel
        onSaved={() => {
          setActiveTab("modules");
          fetchModules();
        }}
        onCancel={() => setActiveTab("modules")}
      />
    ),
    modules: (
      <>
        {/* Above the heading, not in the table's toolbar: this pair is shared
            with COURSE STATUS, so it belongs to the screen rather than to one
            grid on it. */}
        <FilterBar accent="#ffc107">
          <QuarterFilters
            year={filter.year}
            quarter={filter.quarter}
            onYearChange={filter.setYear}
            onQuarterChange={filter.setQuarter}
          />
        </FilterBar>
        <ModulesGrid
          data={data}
          loading={loading}
          error={error}
          onRetry={fetchModules}
          manage
          title="ALL MODULES"
          headerColor="#ffc107"
          emptyMessage="No training modules found"
        />
      </>
    ),
    feedback: <FeedbackFormPanel />,
  };

  return (
    <div className="p-4 bg-[#f5f8fa] overflow-x-hidden">
      {/* Header */}
      <header className="flex items-center justify-between mx-6 my-4">
        <h1 className="text-[16px] font-bold text-[#3482AE] uppercase tracking-wide">
          {TAB_TITLES[activeTab]}
        </h1>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 px-4 py-2 bg-[#3482AE] text-white text-sm font-semibold rounded shadow hover:bg-[#2a6a8f] transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> BACK
        </button>
      </header>

      {/* Status Tabs */}
      <OfficerActionCards activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* Tab Content */}
      <main className="w-full overflow-x-hidden">{TabContent[activeTab]}</main>
    </div>
  );
}
