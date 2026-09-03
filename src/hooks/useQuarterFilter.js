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
  //
  // `ready` is what keeps that first render from being fetched on. Until the
  // effect below has run, the year here is ANY_YEAR — every year — and a screen
  // that fetches on it fires a second, unfiltered request for the whole table
  // alongside the filtered one. The unfiltered one is the slower of the two (it
  // is the entire module list, audience lookups and all), so it regularly
  // landed last and left the grid showing every year while the control above it
  // read the current one. Callers wait for this flag instead.
  const [filter, setFilter] = useState({
    year: ANY_YEAR,
    quarter: ANY_QUARTER,
    ready: false,
  });

  useEffect(() => {
    let stored = null;
    try {
      stored = JSON.parse(window.sessionStorage.getItem(storageKey) ?? "null");
    } catch {
      /* an unreadable value simply falls back to the default below */
    }

    // Every screen opens on the year and quarter in progress — the learner's
    // dashboard included, which used to open on "All years, all quarters". A
    // dashboard that shows everything at once never says which period it is
    // reporting, and the learner had no way to tell that the list spanned
    // several.
    //
    // The cost is that a course raised for a quarter or a year still ahead no
    // longer shows on arrival: it is assigned from that day, but now sits behind
    // the filter until the learner widens it, or until its quarter comes round.
    // Both controls are one click, and this is how the officer's screens have
    // always behaved.
    const fallback = {
      year: String(currentFinancialYear()),
      quarter: currentQuarter(),
    };

    // An empty year is "All years", and it is deliberately NOT restored: a
    // screen opened fresh should say which year it is showing, and restoring
    // that choice left the heading reading "All years" with no sign of why.
    // Widening is a working step, not a setting — it lasts as long as the
    // screen does, and a refresh puts the year in progress back. This now
    // applies to the learner's dashboard too, which used to land on "All years"
    // itself and so had nothing to restore.
    setFilter(
      stored && typeof stored === "object"
        ? {
            year: stored.year ? String(stored.year) : fallback.year,
            quarter: stored.quarter
              ? String(stored.quarter)
              : fallback.quarter,
            ready: true,
          }
        : { ...fallback, ready: true }
    );
  }, [storageKey]);

  const update = useCallback((next) => {
    setFilter((prev) => {
      const merged = { ...prev, ...next };
      try {
        // Only the choice is stored. `ready` describes this mount, not the
        // officer's selection, and a stored copy of it would mean nothing to
        // the next one.
        window.sessionStorage.setItem(
          storageKey,
          JSON.stringify({ year: merged.year, quarter: merged.quarter })
        );
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
    // False for the one render before the stored / default period is known.
    // Fetch on the filter only once this is true.
    ready: filter.ready,
    setYear,
    setQuarter,
  };
}

/**
 * The year and quarter as a request carries them.
 *
 * ANY_QUARTER is this app's own word for "do not filter", and it must not reach
 * the backend: `/emodule/list` and `/user_module1/by_status` happen to ignore an
 * unrecognised quarter, but `/user_module/by_status` — the learner's own list —
 * matches it literally and answers with nothing at all. Picking "All quarters"
 * on the User Dashboard therefore emptied every tile. Sent as an absent param
 * instead, which all three read the same way.
 *
 * @param {string} year the financial year's starting year, "" for all
 * @param {string} quarter "1".."4", or ANY_QUARTER
 */
export function quarterFilterParams(year, quarter) {
  return {
    financialYear: year || "",
    quarter: !quarter || quarter === ANY_QUARTER ? "" : quarter,
  };
}

/** Whether a row falls inside the chosen year and quarter. */
export function matchesQuarterFilter(row, year, quarter) {
  return (
    (!year || row.financialYear === year) &&
    (!quarter || quarter === ANY_QUARTER || row.quarter === quarter)
  );
}
