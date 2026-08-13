"use client";

import { useEffect, useMemo, useState } from "react";

import {
  getAudienceEmployees,
  getDepartments,
} from "@/services/MasterDataService";

/**
 * The two dependent lists behind a course's audience filters: the departments
 * to offer for the chosen plants, and the employees the three filters above
 * USER currently resolve to.
 *
 * Shared by the Add Module form and the Edit Course Details form, which ask the
 * same question of the same four filters — plant, department, grade, then named
 * people. They held a copy each until this existed, and a copy is exactly where
 * the two would drift: the pruning below is what stops a course being sent to
 * someone the officer can no longer see in the field.
 *
 * The employee list is fetched rather than filtered in the browser: the form's
 * roster carries names and codes only, so this side has no way to tell which
 * plant, department or grade anyone is in.
 *
 * @param {object} input
 * @param {{id: number|string, name: string}[]} input.allDepartments every
 *   department, used before a plant is picked and as the fallback if the
 *   plant-wise lookup fails
 * @param {string[]} input.plantIds
 * @param {string[]} input.deptIds
 * @param {string[]} input.gradeIds
 * @param {Function} input.setDeptIds the department state setter — called with
 *   an updater to prune departments that the chosen plants do not staff
 * @param {Function} input.setEmpCodes likewise for the named employees
 * @param {{code: string, label: string}[]} [input.alwaysInclude] employees the
 *   field must offer whatever the filters resolve to, and which the pruning
 *   above must never drop. This is how the edit form keeps the people a course
 *   was already given to: an allottee who has since changed department is not
 *   in today's audience, and silently un-ticking them would read as the officer
 *   having taken them off the course.
 * @returns {{departments: Array, audienceOptions: Array, audienceLoading: boolean}}
 */
export default function useAudienceOptions({
  allDepartments,
  plantIds,
  deptIds,
  gradeIds,
  setDeptIds,
  setEmpCodes,
  alwaysInclude = [],
}) {
  /**
   * The departments to offer — plant-wise once a plant has been picked.
   *
   * Starts as the whole list the form was loaded with, so the field is usable
   * before a plant is chosen and stays usable if the lookup ever fails.
   */
  const [departments, setDepartments] = useState(allDepartments);
  const [audience, setAudience] = useState([]);
  const [audienceLoading, setAudienceLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await getDepartments({ plantIds });
        if (cancelled) return;
        setDepartments(rows);
        // A department with nobody at the newly chosen plants is no longer on
        // offer, so it must not stay ticked behind the officer's back — it
        // would resolve to an empty audience and silently narrow the course.
        const available = new Set(rows.map((d) => String(d.id)));
        setDeptIds((prev) => {
          const kept = prev.filter((id) => available.has(id));
          return kept.length === prev.length ? prev : kept;
        });
      } catch {
        // Leave whatever is already listed rather than emptying the field: an
        // officer mid-way through the form must not lose their department.
      }
    })();

    return () => {
      cancelled = true;
    };
    // setDeptIds is a state setter and stable; plantIds is what this follows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantIds]);

  useEffect(() => {
    // Department is the anchor of the chain — until one is picked there is no
    // audience to narrow, and the backend would answer with an empty list.
    // Nothing to clear here: `audienceOptions` below already reads as empty,
    // and save refuses a module with no department long before the stale codes
    // could reach the backend.
    if (deptIds.length === 0) return undefined;

    let cancelled = false;
    (async () => {
      setAudienceLoading(true);
      try {
        const rows = await getAudienceEmployees({ plantIds, deptIds, gradeIds });
        if (cancelled) return;
        setAudience(rows);
        // Tightening a filter can drop someone already ticked. Leaving them
        // selected would send the course to an employee the officer can no
        // longer see in the list, so the selection is pruned to match — except
        // for anyone the caller pinned; see alwaysInclude.
        const available = new Set([
          ...rows.map((r) => r.code),
          ...alwaysInclude.map((e) => e.code),
        ]);
        setEmpCodes((prev) => {
          const kept = prev.filter((code) => available.has(code));
          return kept.length === prev.length ? prev : kept;
        });
      } catch {
        // A failed lookup leaves USER empty rather than stale: an out-of-date
        // list here would assign the course to the wrong people.
        if (!cancelled) setAudience([]);
      } finally {
        if (!cancelled) setAudienceLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantIds, deptIds, gradeIds]);

  /**
   * What the USER field actually offers. Derived rather than stored, so
   * clearing the departments empties the field in the same render instead of
   * through a second one — and any codes still ticked simply stop matching an
   * option, which is what MultiSelect reads to draw them.
   *
   * The pinned employees are folded in and win on a clash: an allottee and the
   * same person out of today's audience are one entry, not two.
   */
  const audienceOptions = useMemo(() => {
    const rows = deptIds.length === 0 ? [] : audience;
    if (alwaysInclude.length === 0) return rows;

    const byCode = new Map(alwaysInclude.map((e) => [e.code, e]));
    rows.forEach((row) => {
      if (!byCode.has(row.code)) byCode.set(row.code, row);
    });
    return [...byCode.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [audience, deptIds, alwaysInclude]);

  return { departments, audienceOptions, audienceLoading };
}
