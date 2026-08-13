"use client";

import React, {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Lock, Plus } from "lucide-react";

import MultiSelect from "@/components/ui/common/MultiSelect";
import SearchableSelect from "@/components/ui/common/SearchableSelect";
import useAudienceOptions from "@/hooks/useAudienceOptions";
import { useAuth } from "@/context/AuthContext";
import { getEmpCode } from "@/lib/permissions";
import { alerts } from "@/lib/alerts";
import { apiErrorMessage } from "@/config/api";
import {
  QUARTER_OPTIONS,
  getAllottedEmployees,
  instructorName,
  plantLabel,
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
  // Read-only: the quarter is displayed but never edited, so it is derived
  // rather than held in state. Courses raised before the quarter fields existed
  // have none to show.
  const quarterLabel =
    QUARTER_OPTIONS.find((q) => q.value === String(course.quarter))?.label ??
    (course.kraQuarter || "Not set");
  const [objectives, setObjectives] = useState(
    course.objectives.length ? course.objectives : [""]
  );
  const [deptIds, setDeptIds] = useState(course.deptIds);
  const [gradeIds, setGradeIds] = useState(course.gradeIds);

  /**
   * Plant and the named employees, filled in from the course's real allotment
   * rather than left empty.
   *
   * Neither is stored on the module, so both are read back from the people it
   * actually went to: their codes are the USER field, and the sites they work
   * at are the PLANT field. The form used to open with both blank on a course
   * already out with a hundred people, which read as a course assigned to
   * nobody.
   *
   * Allotment is only ever added to: the backend skips an employee who already
   * has the course and never takes it off anyone, so editing these fields
   * cannot withdraw a course from someone part-way through it.
   */
  const [plantIds, setPlantIds] = useState([]);
  const [empCodes, setEmpCodes] = useState([]);
  const [allotted, setAllotted] = useState([]);

  /**
   * What the fields were filled with, so `save` can tell an untouched pair from
   * a deliberate one. Untouched must not narrow: the four filters are an AND,
   * so saving a course back with its existing hundred people ticked would mean
   * "only these hundred" and a department added in the same edit would reach
   * nobody new. A ref, not state — it is read at save time and must never
   * cause a render.
   */
  const initial = useRef({ plantIds: [], empCodes: [] });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await getAllottedEmployees(course.id);
        if (cancelled) return;
        const codes = rows.map((e) => e.code);
        // One entry per site, and only sites that are actually named — an
        // employee with no plant on their record must not tick "no plant".
        const plants = [...new Set(rows.map((e) => e.plantId).filter(Boolean))];
        setAllotted(rows);
        setEmpCodes(codes);
        setPlantIds(plants);
        initial.current = { plantIds: plants, empCodes: codes };
      } catch {
        // An unreadable allotment leaves both fields empty, which is how this
        // form has always opened — the edit still saves, it simply does not
        // show who the course already went to.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [course.id]);

  const { departments, audienceOptions, audienceLoading } = useAudienceOptions({
    allDepartments: options.departments,
    plantIds,
    deptIds,
    gradeIds,
    setDeptIds,
    setEmpCodes,
    // The people already on the course stay on offer and stay ticked even when
    // today's filters no longer reach them.
    alwaysInclude: allotted,
  });

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

    // Read here rather than during render: this is the moment the answer is
    // needed, and a ref must not be read while rendering.
    const sameSet = (a, b) =>
      a.length === b.length && a.every((v) => b.includes(v));
    const untouchedAudience =
      sameSet(plantIds, initial.current.plantIds) &&
      sameSet(empCodes, initial.current.empCodes);

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
        // Sent only when the officer actually changed them; see `initial`.
        plantIds: untouchedAudience ? [] : plantIds,
        deptIds,
        gradeIds,
        empCodes: untouchedAudience ? [] : empCodes,
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
            // Clearable here as on the Add Module form: a wrong pick otherwise
            // has no way out except picking another one.
            clearable
          />
        </Field>

        <Field label="COURSE INSTRUCTOR:">
          <SearchableSelect
            options={instructorOptions}
            value={author}
            onChange={setAuthor}
            placeholder="- Select Instructor -"
            searchPlaceholder="Search instructor…"
            clearable
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

        {/* The four audience filters, in the order they narrow by — site, then
            function, then seniority, then named people — exactly as the Add
            Module form has them. Plant and Select User were missing here, so a
            course could only ever be re-aimed at whole departments and grades:
            handing one to a single named employee meant raising a second course
            for them alone. */}
        <Field label="PLANT:">
          <MultiSelect
            options={options.plants.map((p) => ({
              value: String(p.id),
              label: plantLabel(p),
            }))}
            selected={plantIds}
            onChange={setPlantIds}
            placeholder="All plants"
            searchPlaceholder="Search plant name or code…"
            allLabel="All plants"
          />
        </Field>

        <Field label="DEPARTMENT:">
          <MultiSelect
            // Plant-wise once a plant is picked, so the officer chooses from
            // the departments actually staffed there.
            options={departments.map((d) => ({
              value: String(d.id),
              label: d.name,
            }))}
            selected={deptIds}
            onChange={setDeptIds}
            placeholder={
              plantIds.length > 0
                ? "Select department(s) at these plants"
                : "Select department(s)"
            }
            searchPlaceholder="Search department…"
            allLabel={
              plantIds.length > 0
                ? "All departments at these plants"
                : "All departments"
            }
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
            allLabel="All grades"
          />
        </Field>

        <Field label="SELECT USER:">
          <MultiSelect
            // Codes only, as on the Add Module form — see the note there.
            options={audienceOptions.map((e) => ({
              value: e.code,
              label: e.code,
              search: e.label,
            }))}
            selected={empCodes}
            onChange={setEmpCodes}
            // The empty field has to explain itself — it reads as broken
            // otherwise, and the reason differs.
            placeholder={
              deptIds.length === 0
                ? "Select department first"
                : audienceLoading
                  ? "Loading employees…"
                  : audienceOptions.length === 0
                    ? "No matching employees"
                    : `All ${audienceOptions.length} employee${
                        audienceOptions.length === 1 ? "" : "s"
                      }`
            }
            searchPlaceholder="Search employee name or code…"
            allLabel={
              audienceOptions.length > 0
                ? `All ${audienceOptions.length} employees`
                : ""
            }
          />
          {/* Said out loud, because the field is doing two things at once: it
              reports who has the course and it decides who else gets it. The
              second half is the one that surprises — taking a name out reads
              like withdrawing the course, and it does not. */}
          {allotted.length > 0 ? (
            <p className="mt-1 text-[11px] normal-case text-gray-500">
              Assigned to {allotted.length} employee
              {allotted.length === 1 ? "" : "s"}. Adding a name assigns the
              course to them as well; removing one does not take it away from
              anyone who already has it.
            </p>
          ) : null}
        </Field>

        {/* Shown, not editable. Moving a course's quarter moves the window it
            was assigned against, which is the same thing as assigning it again
            — to the same people, for a period they have already been reported
            on. The quarter is fixed when the course is raised; a course wanted
            for the next quarter is a new course. */}
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
