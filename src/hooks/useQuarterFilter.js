"use client";

import { useCallback, useEffect, useState } from "react";

import {
  currentFinancialYear,
  currentQuarter,
} from "@/services/MasterDataService";

/** Every year, the value the year dropdown carries for "All years". */
export const ANY_YEAR = "";

/** Both halves cleared: every course, whatever quarter raised it. */
export const ANY_QUARTER = "all";

export const OFFICER_FILTER_KEY = "etms_officer_quarter_filter";
export const LEARNER_FILTER_KEY = "etms_learner_quarter_filter";

/**
 * The year / quarter the officer is working on, shared across their screens.
 *
 * ALL MODULES and COURSE STATUS are separate routes, so a filter held in either
 * page's own state is lost the moment the officer moves between them — they
 * pick a quarter, open Course Status to see who has finished, and find
 * themselves back at everything. Kept in sessionStorage rather than in the URL
 * because the tiles that navigate between these screens are a shared component
 * with no knowledge of this filter, and it should not have to grow one.
 *
 * Session, not local: it is a working context, not a preference. Closing the
 * tab is the officer finishing, and the next visit starts from everything.
 *
 * @param {string} [storageKey] which screens share one selection. The officer's
 *   two screens are one working context; a learner's dashboard is another, and
 *   the same person opening both should not find one filtered by the other.
 */
export function useQuarterFilter(storageKey = OFFICER_FILTER_KEY) {
  // Opens on the year and quarter in progress, which is what an officer is
  // working on nearly every time they arrive. Widening to an older quarter, or
  // to every year, is one control away — so there is no Clear button, and a
  // refresh is enough to get back here.
  //
  // Empty on the very first render and filled in on mount: today's date is not
  // available to the server's HTML, and rendering it directly would mismatch on
  // hydration.
  const [filter, setFilter] = useState({
    year: ANY_YEAR,
    quarter: ANY_QUARTER,
  });

  useEffect(() => {
    let stored = null;
    try {
      stored = JSON.parse(window.sessionStorage.getItem(storageKey) ?? "null");
    } catch {
      /* an unreadable value simply falls back to the default below */
    }

    const fallback = {
      year: String(currentFinancialYear()),
      quarter: currentQuarter(),
    };

    // An empty year is "All years", and it is deliberately NOT restored: a
    // screen opened fresh should say which year it is showing, and restoring
    // that choice left the heading reading "All years" with no sign of why.
    // Widening is a working step, not a setting — it lasts as long as the
    // screen does, and a refresh puts the year in progress back.
    setFilter(
      stored && typeof stored === "object"
        ? {
            year: stored.year ? String(stored.year) : fallback.year,
            quarter: stored.quarter
              ? String(stored.quarter)
              : fallback.quarter,
          }
        : fallback
    );
  }, [storageKey]);

  const update = useCallback((next) => {
    setFilter((prev) => {
      const merged = { ...prev, ...next };
      try {
        window.sessionStorage.setItem(storageKey, JSON.stringify(merged));
      } catch {
        /* a full or blocked store must not break filtering */
      }
      return merged;
    });
  }, [storageKey]);

  const setYear = useCallback((year) => update({ year }), [update]);
  const setQuarter = useCallback((quarter) => update({ quarter }), [update]);

  return {
    year: filter.year,
    quarter: filter.quarter,
    setYear,
    setQuarter,
  };
}

/** Whether a row falls inside the chosen year and quarter. */
export function matchesQuarterFilter(row, year, quarter) {
  return (
    (!year || row.financialYear === year) &&
    (!quarter || quarter === ANY_QUARTER || row.quarter === quarter)
  );
}
