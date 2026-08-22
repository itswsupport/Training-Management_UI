"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import OfficerActionCards from "@/components/cards/OfficerActionCards";
import FilterBar from "@/components/dashboards/FilterBar";
import ModulesGrid from "@/components/dashboards/ModulesGrid";
import QuarterFilters from "@/components/dashboards/QuarterFilters";
import ToolbarSelect from "@/components/ui/common/ToolbarSelect";
import FeedbackFormPanel from "@/components/feedback/FeedbackFormPanel";
import ModuleFormPanel from "@/components/modules/ModuleFormPanel";
import { apiErrorMessage } from "@/config/api";
import {
  ANY_QUARTER,
  quarterFilterParams,
  useQuarterFilter,
} from "@/hooks/useQuarterFilter";
import { getModules } from "@/services/ModuleService";
import useMasterNames from "@/hooks/useMasterNames";
import {
  getCompanies,
  getPlants,
  plantLabel,
} from "@/services/MasterDataService";

const TAB_TITLES = {
  add: "TRAINING MODULE FORM",
  modules: "TRAINING OFFICER DASHBOARD",
  feedback: "FEEDBACK FORM",
};

/** Every company / every plant — what each control carries before a pick. */
const ANY = "";

export default function TrainingOfficerDashboard() {
  const router = useRouter();

  // Shared with COURSE STATUS, so opening that screen keeps the quarter the
  // officer is working on rather than resetting to everything.
  const filter = useQuarterFilter();

  // Which sites the module reached. Unlike COURSE STATUS these go to the
  // backend with the request: a module carries no plant of its own, so the only
  // way to answer it is from the allotment table, which is not on the row.
  const [companyId, setCompanyId] = useState(ANY);
  const [plantId, setPlantId] = useState(ANY);
  const [companies, setCompanies] = useState([]);
  const [plants, setPlants] = useState([]);

  // Names for the grid's own COMPANY and PLANT columns. Separate from the two
  // lists above, which are the dropdowns' and shrink with the filter.
  const { companyNames, plantNames } = useMasterNames();

  const [activeTab, setActiveTab] = useState("modules");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // The company list never changes while the screen is open, so it is fetched
  // once. A failure leaves the control holding "All companies" alone, which is
  // what this screen did before it had one.
  useEffect(() => {
    let cancelled = false;
    getCompanies()
      .then((rows) => {
        if (!cancelled) setCompanies(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // The plants the company control offers. Only the list — the SELECTION is
  // reset by the company control itself, not from here: doing it in this effect
  // meant the reset landed a render after the company changed, so the list was
  // fetched once for a company and plant that do not go together and again a
  // moment later for the right pair.
  useEffect(() => {
    let cancelled = false;
    getPlants({ companyIds: companyId ? [companyId] : [] })
      .then((rows) => {
        if (!cancelled) setPlants(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  /**
   * Changing the company always clears the plant.
   *
   * Not "clears it only when the new company does not staff it", which is what
   * this did first: one site is staffed by both companies, so switching company
   * with that plant picked silently kept it and the list stayed narrowed to a
   * single site the officer was no longer thinking about.
   */
  const changeCompany = (next) => {
    setCompanyId(next);
    setPlantId(ANY);
  };

  /**
   * Why the grid is empty, in the officer's own terms.
   *
   * Four things narrow this list at once - company, plant, financial year and
   * quarter - and "No training modules found" names none of them, so an empty
   * grid reads as a screen that failed to load rather than a filter that
   * matched nothing. It is a real state: no course has ever been given to
   * anyone at Rucha Yantra, and three of the active plants have never had one
   * either, so picking any of them empties the grid correctly.
   *
   * Naming what is applied lets the officer see which control to widen without
   * clearing all four to find out.
   */
  const narrowedBy = [
    companies.find((c) => String(c.id) === String(companyId))?.name,
    (() => {
      const plant = plants.find((p) => String(p.id) === String(plantId));
      return plant ? plantLabel(plant) : null;
    })(),
    filter.year ? `FY ${filter.year}` : null,
    filter.quarter && filter.quarter !== ANY_QUARTER
      ? `Q${filter.quarter}`
      : null,
  ].filter(Boolean);

  const emptyMessage = narrowedBy.length
    ? `No training modules for ${narrowedBy.join(" · ")}.`
    : "No training modules found";

  const fetchModules = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // The year and quarter go with the request: the officer's list is the
      // whole table, and fetching all of it to show one quarter is what the
      // filter exists to avoid.
      setData(
        await getModules({
          ...quarterFilterParams(filter.year, filter.quarter),
          companyIds: companyId ? [companyId] : [],
          plantIds: plantId ? [plantId] : [],
        })
      );
    } catch (err) {
      setData([]);
      setError(apiErrorMessage(err, "Failed to fetch training modules"));
    } finally {
      setLoading(false);
    }
  }, [filter.year, filter.quarter, companyId, plantId]);

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
          {/* Company then plant, in the order they narrow by, and both ahead of
              the period — the same arrangement COURSE STATUS carries, so the
              two screens read the same way round. */}
          <ToolbarSelect
            label="Company"
            value={companyId}
            onChange={changeCompany}
            options={[
              { value: ANY, label: "All companies" },
              ...companies.map((c) => ({ value: String(c.id), label: c.name })),
            ]}
          />
          <ToolbarSelect
            label="Plant"
            value={plantId}
            onChange={setPlantId}
            // Capped for the same reason as on COURSE STATUS: every plant name
            // carries the full company name in front of it, and a <select>
            // takes its width from the longest one.
            fieldClassName="w-[150px]"
            options={[
              { value: ANY, label: "All plants" },
              ...plants.map((p) => ({
                value: String(p.id),
                label: plantLabel(p),
              })),
            ]}
          />
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
          emptyMessage={emptyMessage}
          companyNames={companyNames}
          plantNames={plantNames}
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
