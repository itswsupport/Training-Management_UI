"use client";

import { useEffect, useMemo, useState } from "react";

import {
  getCompanies,
  getPlants,
  plantLabel,
} from "@/services/MasterDataService";

/**
 * `id → name` for the companies and the plants, for any grid that shows either.
 *
 * The rows carry ids and nothing else: they are built from reports that join the
 * employee master for a name and a designation, not for the master rows behind
 * a plant id. So the names are fetched once here and looked up per row.
 *
 * Every plant, deliberately — NOT the list a company filter is narrowed to. A
 * screen filtered to one company still has to name the plants on the rows it is
 * showing, and a map built from the narrowed list blanks the column the moment
 * the filter moves. Naming and offering are two different jobs; this is the
 * first, and the filter dropdown keeps its own list for the second.
 *
 * Fetched once per mount and never refetched: neither master changes while a
 * screen is open, and both are two-figure lists. A failure leaves the maps empty
 * and every cell reads a dash, which is what the grids draw for an unknown id
 * anyway — the screen still works, it just cannot name the site.
 *
 * @returns {{companyNames: Record<string, string>,
 *   plantNames: Record<string, string>}}
 */
export default function useMasterNames() {
  /* Both lists in ONE piece of state, settled together.
   *
   * They used to be two, set by two independent `.then`s, and every grid using
   * this hook memoises its column definitions on the two maps below. So the two
   * arrivals threw those definitions away and rebuilt them twice - and on Course
   * Status that means the table recomputing accessors across 20,000 rows, twice,
   * for the second and third time in a row. Settling both before either is
   * published costs nothing and leaves exactly one rebuild.
   *
   * `Promise.all` would abandon both lists if either failed, so each is caught
   * down to [] on its own: an unreachable /company/list must not also cost the
   * PLANT column its names. */
  const [{ companies, plants }, setMasters] = useState({
    companies: [],
    plants: [],
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getCompanies().catch(() => []),
      getPlants({}).catch(() => []),
    ]).then(([companyRows, plantRows]) => {
      if (!cancelled) setMasters({ companies: companyRows, plants: plantRows });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const companyNames = useMemo(
    () => Object.fromEntries(companies.map((c) => [String(c.id), c.name])),
    [companies]
  );

  // The CODE alone — "1042", not "1042 — Rucha Engineers Pvt. Ltd. Unit- 4,
  // PressShop". It is what the sites are known by on paper, and it is the only
  // form short enough for a column that stacks one entry per line: a course
  // reaching six plants would otherwise carry six copies of the company name
  // down a single cell. The dropdowns still label themselves in full, where
  // there is a whole row to spend and the officer is choosing rather than
  // reading. Falls back to the name for a site with no code recorded.
  const plantNames = useMemo(
    () =>
      Object.fromEntries(
        plants.map((p) => [String(p.id), p.code || plantLabel(p)])
      ),
    [plants]
  );

  return { companyNames, plantNames };
}
