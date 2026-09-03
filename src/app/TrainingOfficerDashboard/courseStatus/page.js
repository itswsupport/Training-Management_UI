"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
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
import {
  quarterFilterParams,
  useQuarterFilter,
} from "@/hooks/useQuarterFilter";
import { getCourseStatusRows } from "@/services/CourseStatusService";
import useMasterNames from "@/hooks/useMasterNames";
import {
  getCompanies,
  getPlants,
  plantLabel,
} from "@/services/MasterDataService";

/** Every company / every plant — what each control carries before a pick. */
const ANY = "";

export default function CourseStatus() {
  const router = useRouter();
  const filter = useQuarterFilter();
  const [status, setStatus] = useState(STATUS_ALL);

  // Who the rows are about, rather than which courses they are. Both are read
  // off the row client-side like STATUS is, so neither refetches the report.
  const [companyId, setCompanyId] = useState(ANY);
  const [plantId, setPlantId] = useState(ANY);
  const [companies, setCompanies] = useState([]);
  const [plants, setPlants] = useState([]);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // The company list never changes while the screen is open, so it is fetched
  // once. A failure leaves the control holding "All companies" alone, which is
  // the same thing the screen did before it had one.
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
  // meant the reset landed a render after the company changed, so the report was
  // briefly filtered by a company and a plant that do not go together.
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
   * with that plant picked silently kept it and the report stayed narrowed to a
   * single site the officer was no longer thinking about. Clearing every time is
   * the rule that needs no explaining.
   */
  const changeCompany = (next) => {
    setCompanyId(next);
    setPlantId(ANY);
  };

  // Names for the COMPANY and PLANT columns, from the same hook the other two
  // dashboards use — so all four grids label a site identically.
  const { companyNames, plantNames } = useMasterNames();

  // Which request owns the grid — see the officer dashboard, which carries the
  // same guard for the same reason: a wider report takes longer to answer than
  // a narrower one, so responses do not come back in the order they were asked
  // for.
  const requestRef = useRef(0);

  const fetchCourseStatus = useCallback(async (force = false) => {
    const request = (requestRef.current += 1);
    const stale = () => request !== requestRef.current;
    try {
      setLoading(true);
      setError(null);
      const rows = await getCourseStatusRows({
        force,
        ...quarterFilterParams(filter.year, filter.quarter),
      });
      if (stale()) return;
      setData(rows);
    } catch (err) {
      if (stale()) return;
      setData([]);
      setError(apiErrorMessage(err, "Failed to fetch course status"));
    } finally {
      if (!stale()) setLoading(false);
    }
  }, [filter.year, filter.quarter]);

  useEffect(() => {
    // Not before the period is known — the first render still reads "all
    // years", and fetching on it costs an unfiltered report nobody asked for.
    if (!filter.ready) return;
    fetchCourseStatus();
  }, [filter.ready, fetchCourseStatus]);

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
        {/* The year / quarter pair is the same one ALL MODULES carries and holds
            the same selection, so arriving here from that screen keeps the
            quarter the officer was looking at. It sits mid-bar rather than
            first: this screen is read by site far more often than the other,
            and the two controls that pick the people come before the two that
            pick the period. */}
        <FilterBar accent="#20c997">
          {/* Who the rows are about comes first — company, then the plants it
              staffs — and which courses they are comes after. Company leads
              plant because that is the order they narrow by, the same chain the
              module form's audience filters use. */}
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
            // The one control on this bar whose options run long enough to set
            // its own width — every plant name carries the full company name in
            // front of it. Capped so the five filters stay on one line; the
            // whole name is still there when the list is open.
            fieldClassName="w-[150px]"
            options={[
              { value: ANY, label: "All plants" },
              // Code first, as on the module form: it is what the sites are
              // known by, and the only short way to tell the three Unit-4s
              // apart.
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
          companyId={companyId}
          plantId={plantId}
          companyNames={companyNames}
          plantNames={plantNames}
        />
      </main>
    </div>
  );
}
