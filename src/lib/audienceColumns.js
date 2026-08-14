/**
 * The COMPANY and PLANT columns, shared by every grid that carries them.
 *
 * A row holds ids and a `names` map turns them into words. Both are LISTS: on
 * the officer's module list one course reaches several plants at once, and on a
 * learner's own list it is a list of one. Reading them the same way is what lets
 * the two screens share these definitions instead of each writing their own.
 */

/** The names behind a row's id list, in the order the backend grouped them. */
const namesOf = (ids = [], names = {}) =>
  ids.map((id) => names[id]).filter(Boolean);

/**
 * Every name, comma-joined — what sorting and the column filter match on, and
 * what the exports write.
 */
export const audienceFull = (ids = [], names = {}) => {
  const known = namesOf(ids, names);
  return known.length ? known.join(", ") : "-";
};

/**
 * All of them on one line, comma-separated — "1006, 9001, 1010".
 *
 * This stacked one per line while the column carried full plant labels, where
 * six of them down a cell was the only way to read the list without hovering.
 * Codes are four characters, so the whole list fits across instead and every row
 * keeps one height — which is what a table of a hundred courses wants.
 *
 * A dash where a course has reached nobody yet, so an unallotted module reads as
 * having no plant rather than as a blank cell that failed to load.
 */
function AudienceCell({ ids, names }) {
  const known = namesOf(ids, names);
  if (known.length === 0) return <span>-</span>;

  return <span className="whitespace-nowrap">{known.join(", ")}</span>;
}

/**
 * The pair of column definitions, ready to splice in after COURSE NO.
 *
 * @param {Record<string, string>} companyNames
 * @param {Record<string, string>} plantNames
 */
export const audienceColumns = (companyNames, plantNames) => [
  {
    id: "company",
    header: "COMPANY",
    // accessorFn, not accessorKey: the value shown is derived from an id list
    // and a lookup, so there is no field on the row to point at. It returns the
    // names joined on one line, which is what sorting and the column filter
    // should match — the cell below stacks the same names for reading.
    accessorFn: (row) => audienceFull(row.compIds, companyNames),
    Cell: ({ row }) => (
      <AudienceCell ids={row.original.compIds} names={companyNames} />
    ),
  },
  {
    id: "plant",
    // "PLANT CODE", not "PLANT": the column carries 1006, not Unit-6, and a
    // heading that promised the name would read as the wrong value rather than
    // as a shorter one.
    header: "PLANT CODE",
    accessorFn: (row) => audienceFull(row.plantIds, plantNames),
    Cell: ({ row }) => (
      <AudienceCell ids={row.original.plantIds} names={plantNames} />
    ),
  },
];
