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
  const [companies, setCompanies] = useState([]);
  const [plants, setPlants] = useState([]);

  useEffect(() => {
    let cancelled = false;
    getCompanies()
      .then((rows) => {
        if (!cancelled) setCompanies(rows);
      })
      .catch(() => {});
    getPlants({})
      .then((rows) => {
        if (!cancelled) setPlants(rows);
      })
      .catch(() => {});
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
