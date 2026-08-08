"use client";

import { CalendarRange } from "lucide-react";

import ToolbarSelect from "@/components/ui/common/ToolbarSelect";
import YearPicker from "@/components/ui/common/YearPicker";
import { QUARTER_OPTIONS } from "@/services/MasterDataService";
import { ANY_QUARTER } from "@/hooks/useQuarterFilter";

const QUARTER_CHOICES = [
  { value: ANY_QUARTER, label: "All quarters" },
  ...QUARTER_OPTIONS,
];

/**
 * The year / quarter filter — a pair of controls for a FilterBar, not a row of
 * its own, so a screen can put its own filters on the same line.
 *
 * The year opens a calendar's year view (YearPicker); the quarter stays a list,
 * because four fixed spans are a list however they are drawn. Only the year is
 * ever filtered on — no month, no day.
 *
 * @param {object} props
 * @param {string} props.year  the financial year's starting year, "" for all
 * @param {string} props.quarter
 * @param {(year: string) => void} props.onYearChange
 * @param {(quarter: string) => void} props.onQuarterChange
 */
export default function QuarterFilters({
  year,
  quarter,
  onYearChange,
  onQuarterChange,
}) {
  return (
    <>
      <YearPicker value={year} onChange={onYearChange} />

      {/* A quarter is a span of months, not a day — the ranged calendar says
          so, and keeps the pair reading as one date control in two parts. */}
      <ToolbarSelect
        label="Quarter"
        value={quarter}
        onChange={onQuarterChange}
        options={QUARTER_CHOICES}
        icon={CalendarRange}
      />
    </>
  );
}
