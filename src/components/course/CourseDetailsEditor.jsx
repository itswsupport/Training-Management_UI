"use client";

import React, { useImperativeHandle, useMemo, useState } from "react";
import { Lock, Plus } from "lucide-react";

import MultiSelect from "@/components/ui/common/MultiSelect";
import SearchableSelect from "@/components/ui/common/SearchableSelect";
import { useAuth } from "@/context/AuthContext";
import { getEmpCode } from "@/lib/permissions";
import { alerts } from "@/lib/alerts";
import { apiErrorMessage } from "@/config/api";
import {
  QUARTER_OPTIONS,
  financialYearOf,
  instructorName,
} from "@/services/MasterDataService";
import { updateModuleDetails } from "@/services/ModuleService";

// Same field styling as the Add Module form, so the two read as one thing.
const labelCls = "mb-1 block text-[12px] font-bold text-[#3482AE] uppercase";
const inputCls =
  "w-full rounded border border-gray-300 bg-white px-3 py-2 text-[12px] text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#3482AE] focus:ring-2 focus:ring-[#3482AE]/30";
function Field({ label, children }) {
  return (
    <div>
      <span className={labelCls}>{label}</span>
      {children}
    </div>
  );
}

/**
 * The officer's edit form for a course's details.
 *
 * Covers only the module's own fields — the sections and lectures below have
 * their own editor. There is no save button here: the page's single SAVE calls
 * the `save()` exposed on the ref, which returns whether the write succeeded.
 */
export default function CourseDetailsEditor({ course, options, ref }) {
  // Who is editing — recorded against the change in the module history.
  const { user } = useAuth();
  const actionBy = getEmpCode(user);

  const [name, setName] = useState(course.name);
  const [categoryId, setCategoryId] = useState(course.categoryId);
  const [author, setAuthor] = useState(course.instructor);
  const [description, setDescription] = useState(course.description);
  // Read-only: both are displayed but never edited, so they are derived rather
  // than held in state. Courses raised before the quarter fields existed have
  // neither to show.
  const quarterLabel =
    QUARTER_OPTIONS.find((q) => q.value === String(course.quarter))?.label ??
    (course.kraQuarter || "Not set");
  const yearLabel = financialYearOf(course.kraQuarter) || "Not set";
  const [objectives, setObjectives] = useState(
    course.objectives.length ? course.objectives : [""]
  );
  const [deptIds, setDeptIds] = useState(course.deptIds);
  const [gradeIds, setGradeIds] = useState(course.gradeIds);

  const [error, setError] = useState(null);

  // Courses saved before the dropdown carried employee codes hold a bare name,
  // which matches no option — keep it in the list so the field shows what the
  // course actually has instead of falling back to the placeholder.
  const instructorOptions = useMemo(() => {
    const list = options.instructors.map((i) => ({
      value: i.label,
      label: i.label,
    }));
    if (author && !list.some((o) => o.value === author)) {
      list.unshift({ value: author, label: author });
    }
    return list;
  }, [options.instructors, author]);

  /** Writes the details. Returns true only when the module was saved. */
  const handleSave = async () => {
    setError(null);

    const reject = (message) => {
      setError(message);
      alerts.warning(message, "Incomplete form");
      return false;
    };

    if (!name.trim()) return reject("Please enter the course name.");
    if (!author.trim()) return reject("Please select the course instructor.");
    if (!description.trim()) return reject("Please enter the course description.");
    if (deptIds.length === 0) return reject("Please select at least one department.");
    if (gradeIds.length === 0) return reject("Please select at least one grade.");

    // Carried through untouched. The officer cannot pick a quarter here, so
    // there is nothing to recompute — and recomputing would be the bug this
    // guards against, since it would re-date the course's window and put it
    // back in front of the same departments for a period already reported on.
    const quarterFields = {
      kraQuarter: course.kraQuarter,
      validTill: course.validTill,
    };

    try {
      await updateModuleDetails({
        id: course.id,
        // Carried through untouched — an edit must not renumber the course, and
        // leaving it out is worse than that: it blanks it. See updateModuleDetails.
        code: course.code,
        actionBy,
        name: name.trim(),
        categoryId,
        // The dropdown carries the employee code; only the name is stored.
        author: instructorName(author),
        description: description.trim(),
        objectives: objectives.map((o) => o.trim()).filter(Boolean),
        deptIds,
        gradeIds,
        status: course.status,
        regBy: course.regBy,
        regDate: course.regDate,
        regTime: course.regTime,
        ...quarterFields,
      });
      return true;
    } catch (err) {
      const message = apiErrorMessage(err, "Could not save the course details.");
      setError(message);
      await alerts.error(message, "Could not save");
      return false;
    }
  };

  useImperativeHandle(ref, () => ({ save: handleSave }));

  return (
    <section className="bg-white rounded shadow border border-gray-200 text-[12px]">
      {/* Header */}
      <div className="bg-[#3482AE] px-4 py-2">
        <h2 className="text-white font-bold uppercase tracking-wide">
          Edit Course Details
        </h2>
      </div>

      <div className="p-3 grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
        <Field label="COURSE NAME:">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
          />
        </Field>

        <Field label="COURSE CATEGORY:">
          <SearchableSelect
            options={options.categories.map((c) => ({
              value: String(c.id),
              label: c.name,
            }))}
            value={categoryId}
            onChange={setCategoryId}
            placeholder="- Select Category -"
            searchPlaceholder="Search category…"
          />
        </Field>

        <Field label="COURSE INSTRUCTOR:">
          <SearchableSelect
            options={instructorOptions}
            value={author}
            onChange={setAuthor}
            placeholder="- Select Instructor -"
            searchPlaceholder="Search instructor…"
          />
        </Field>

        <Field label="COURSE DESCRIPTION:">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={1}
            placeholder="Enter ..."
            className={`${inputCls} normal-case`}
          />
        </Field>

        <Field label="DEPARTMENT:">
          <MultiSelect
            options={options.departments.map((d) => ({
              value: String(d.id),
              label: d.name,
            }))}
            selected={deptIds}
            onChange={setDeptIds}
            placeholder="Select department(s)"
            searchPlaceholder="Search department…"
          />
        </Field>

        <Field label="GRADE:">
          <MultiSelect
            options={options.grades.map((g) => ({
              value: String(g.id),
              label: g.label,
            }))}
            selected={gradeIds}
            onChange={setGradeIds}
            placeholder="Select grade(s)"
            searchPlaceholder="Search grade…"
          />
        </Field>

        {/* Shown, not editable. Moving a course's quarter moves the window it
            was assigned against, which is the same thing as assigning it again
            — to the same people, for a period they have already been reported
            on. The quarter is fixed when the course is raised; a course wanted
            for the next quarter is a new course. */}
        {/* Shown beside the quarter and locked for the same reason: the year is
            the other half of the window the course was assigned against, and a
            quarter without it reads as any year's. Both are here because the
            Add Module form asks for both, and an edit screen that shows only
            one of them looks like it lost the other. */}
        <Field label="FINANCIAL YEAR:">
          <div
            title="A course's financial year is fixed when it is created and cannot be changed here."
            className={`${inputCls} flex cursor-not-allowed items-center justify-between gap-2 bg-gray-100 text-gray-600`}
          >
            <span>{yearLabel}</span>
            <Lock className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          </div>
        </Field>

        <Field label="APPLICABLE QUARTER:">
          <div
            title="A course's quarter is fixed when it is created and cannot be changed here."
            className={`${inputCls} flex cursor-not-allowed items-center justify-between gap-2 bg-gray-100 text-gray-600`}
          >
            <span>{quarterLabel}</span>
            <Lock className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          </div>
        </Field>

        <div className="md:col-span-2">
          <span className={labelCls}>LEARNING OBJECTIVE:</span>
          <div className="space-y-2">
            {objectives.map((obj, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={obj}
                  onChange={(e) =>
                    setObjectives((prev) =>
                      prev.map((o, j) => (j === i ? e.target.value : o))
                    )
                  }
                  placeholder="Learning Objective"
                  className={`${inputCls} normal-case`}
                />
                {i === objectives.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setObjectives((prev) => [...prev, ""])}
                    className="shrink-0 rounded bg-[#3482AE] px-3 text-white hover:bg-[#2b6b90]"
                    aria-label="Add objective"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      setObjectives((prev) => prev.filter((_, j) => j !== i))
                    }
                    className="shrink-0 rounded bg-[#f23a4c] px-3 text-white hover:bg-[#d92e3f]"
                    aria-label="Remove objective"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {error ? (
          <p className="md:col-span-3 text-[11px] font-semibold text-[#f23a4c]">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
