/**
 * Training e-module reads and writes (`/emodule/*`).
 *
 * Covers both sides of the product: the officer's module list / create flow and
 * the learner's course detail view.
 */

import { api, sendForm, unwrap, getApiUrl } from "@/config/api";
import { clean, cleanOrNull, nowStamp } from "@/utils/etmsFormat";

/**
 * @typedef {object} ModuleRow
 * @property {number} id
 * @property {string} no  business code shown as the badge, e.g. "20-ST-57"
 * @property {string} name
 * @property {string} category
 * @property {string} instructor
 * @property {string} description
 * @property {number} status
 */

/** Projects one raw /emodule row down to the fields a table needs. */
const toModuleRow = (m) => ({
  id: m.id,
  no: clean(m.emoduleId),
  name: clean(m.emoduleName),
  category: clean(m.trainingCategory1?.categoryName),
  instructor: clean(m.emoduleAuthor),
  description: clean(m.emoduleLongDesc),
  status: m.status ?? 0,
});

/**
 * All e-modules, newest first.
 * @returns {Promise<ModuleRow[]>}
 */
export async function getModules() {
  const list = unwrap(await api.get("/emodule/list"), []) ?? [];
  return list.map(toModuleRow).sort((a, b) => b.id - a.id);
}

/** "13,36," → ["13","36"] — the backend stores id lists comma-joined. */
const parseIdList = (value) =>
  String(value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/** "1 [ 2024-04-01 to 2024-06-30 ]" → "1"; anything else → "". */
const parseQuarter = (kraQuarter) => {
  const match = String(kraQuarter ?? "").trim().match(/^([1-4])\b/);
  return match ? match[1] : "";
};

/**
 * One course with its sections, lectures and learning objectives.
 *
 * Also carries the administrative fields the officer's edit form needs
 * (`categoryId`, `deptIds`, `gradeIds`, `quarter`) and the ones an update must
 * preserve rather than rewrite (`status`, `regBy`, `regDate`, `regTime`,
 * `validTill`).
 *
 * @param {number|string} emoduleId
 * @returns {Promise<object|null>}
 */
export async function getCourseDetail(emoduleId) {
  const e = unwrap(await api.get("/emodule", { params: { emoduleId } }));
  if (!e || e.id == null) return null;

  return {
    id: e.id,
    code: clean(e.emoduleId),
    name: clean(e.emoduleName),
    category: clean(e.trainingCategory1?.categoryName),
    instructor: clean(e.emoduleAuthor),
    description: clean(e.emoduleLongDesc),
    // Editable ids behind the display values above.
    categoryId: e.categoryId != null ? String(e.categoryId) : "",
    deptIds: parseIdList(e.deptId),
    gradeIds: parseIdList(e.gradeId),
    quarter: parseQuarter(e.kraQuarter),
    // Carried through an update untouched, so editing never rewrites who
    // created the module or when.
    status: e.status ?? 1,
    regBy: e.regBy != null ? String(e.regBy) : "",
    regDate: clean(e.regDate),
    regTime: clean(e.regTime),
    kraQuarter: clean(e.kraQuarter),
    validTill: clean(e.validTill),
    objectives: (e.shortDescription ?? [])
      .map((s) => clean(s.emoduleShortDesc))
      .filter(Boolean),
    sections: (e.videoList ?? []).map((s) => ({
      id: s.id ?? 0,
      name: clean(s.section),
      assignmentStatus: s.assignmentStatus ?? 0,
      lectures: (s.trainingEmoduleCurriculam ?? []).map((l) => ({
        id: l.id ?? 0,
        name: clean(l.lecture),
        materialFile: cleanOrNull(l.materialFile),
        materialVideo: cleanOrNull(l.materialVideo),
        link: cleanOrNull(l.udemyLink),
      })),
    })),
  };
}

/**
 * The backend keeps a single global draft (status 0). `insertEmodule` always
 * calls `findByStatus(0)`; when a draft exists it takes the UPDATE path and
 * dereferences the incoming id — so an empty id crashes it (501). Reusing the
 * current draft's id keeps that path valid; with no draft we send no id and the
 * insert path creates a fresh module.
 *
 * The draft's own `emoduleId` code travels back with the id: the UPDATE path
 * rebuilds the whole row from the params, so the code has to be sent back or it
 * is merged away as null (see `updateModuleDetails`).
 *
 * @returns {Promise<{id: number, code: string}|null>}
 */
export async function getDraftModule() {
  try {
    const draft = unwrap(await api.get("/emodule/status", { params: { status: 0 } }));
    if (draft?.id == null) return null;
    return { id: draft.id, code: clean(draft.emoduleId) };
  } catch {
    // No draft (or the lookup failed) → fall through to the insert path.
    return null;
  }
}

/**
 * Creates (or updates the single draft) e-module and returns its id.
 *
 * @param {object} input
 * @param {string} input.name
 * @param {string} input.categoryId
 * @param {string} input.author
 * @param {string} input.description
 * @param {string} input.kraQuarter
 * @param {string} input.validTill
 * @param {string[]} input.objectives
 * @param {string[]} input.deptIds
 * @param {string[]} input.gradeIds
 * @param {string} input.regBy employee code of the training officer
 * @returns {Promise<number>} the saved module id
 */
export async function saveModule(input) {
  const draft = await getDraftModule();
  const { regDate, regTime } = nowStamp();

  const params = {
    emoduleName: input.name,
    categoryId: input.categoryId || "1",
    emoduleAuthor: input.author,
    emoduleLongDesc: input.description,
    regBy: input.regBy,
    status: "0", // draft; /emodule/mail flips it to submitted
    regDate,
    regTime,
    kraQuarter: input.kraQuarter,
    validTill: input.validTill,
    // The backend's @RequestParam array names literally include "[]".
    "shortDescList[]": input.objectives?.length ? input.objectives : ["0"],
    "deptIdList[]": input.deptIds,
    "gradeIdList[]": input.gradeIds,
  };
  // Reusing the draft slot sends /emodule/save down its UPDATE path, which
  // rebuilds the stored row from these params alone — so the existing course
  // number has to go back with it. Omitting it nulls the column, and everything
  // downstream that parses the code then fails (501). On the insert path there
  // is no code yet and the backend generates one.
  if (draft) {
    params.id = String(draft.id);
    if (draft.code) params.emoduleId = draft.code;
  }

  const id = unwrap(await sendForm("/emodule/save", params));
  if (id == null) throw new Error("The training service did not return a module id.");

  // Reusing a draft slot can carry over sections from an earlier unfinished
  // attempt; clear them so this module starts clean. Best-effort.
  if (draft) {
    try {
      const sections = await getSections(draft.id);
      await Promise.all(sections.map((s) => deleteSection(s.id).catch(() => {})));
    } catch {
      /* ignore cleanup failures */
    }
  }

  return id;
}

/**
 * Updates an existing module's details — name, category, instructor,
 * description, objectives, departments, grades and quarter.
 *
 * Unlike `saveModule` this never touches the draft slot: it passes the
 * module's own id, so `/emodule/save` takes its UPDATE path. Sections,
 * lectures and assignment questions are untouched.
 *
 * `status`, `regBy`, `regDate` and `regTime` are passed straight back so an
 * edit cannot un-submit a module or rewrite who created it and when.
 *
 * @param {object} input
 * @returns {Promise<void>}
 */
export async function updateModuleDetails(input) {
  const params = {
    id: String(input.id),
    // The course number, sent straight back untouched. `/emodule/save` binds a
    // whole TrainingEmodule from these params and, in its assignment loop, saves
    // THAT object over the stored row — so any column missing here is merged
    // away as null. Leaving this out is what blanked the number and left every
    // grid showing N/A for an edited module.
    emoduleId: input.code ?? "",
    // regBy stays the creator, so who is editing has to travel separately or
    // the history row would credit the change to whoever made the course.
    actionBy: input.actionBy,
    emoduleName: input.name,
    categoryId: input.categoryId || "1",
    emoduleAuthor: input.author,
    emoduleLongDesc: input.description,
    regBy: input.regBy,
    status: String(input.status ?? 1),
    regDate: input.regDate,
    regTime: input.regTime,
    kraQuarter: input.kraQuarter,
    validTill: input.validTill,
    // The backend's @RequestParam array names literally include "[]".
    "shortDescList[]": input.objectives?.length ? input.objectives : ["0"],
    "deptIdList[]": input.deptIds,
    "gradeIdList[]": input.gradeIds,
  };

  unwrap(await sendForm("/emodule/save", params));
}

/**
 * A module's sections (id + name), used to attach assignment questions after
 * the sections have been saved.
 * @param {number|string} emoduleId
 */
export async function getSections(emoduleId) {
  const list =
    unwrap(await api.get("/emodule/section/byid", { params: { emoduleId } }), []) ?? [];
  return list.map((s) => ({
    id: s.id ?? 0,
    name: clean(s.section),
    // The saved lectures with their ids — an assignment question is attached to
    // one of these, and the id only exists once the section has been written.
    lectures: (s.trainingEmoduleCurriculam ?? []).map((l) => ({
      id: l.id ?? 0,
      name: clean(l.lecture),
    })),
  }));
}

export function deleteSection(sectionId, actionBy) {
  return api.delete("/emodule/section/delete", {
    params: { sectionId, actionBy },
  });
}

/**
 * Builds the exact multipart shape `/emodule/section/save` expects.
 *
 * `lecturelist` and `udemyLinkList` go as comma-joined strings (Spring splits
 * them). `materialVideoList` / `materialFileList` are positional — one file
 * part per lecture, padded with a placeholder named "TrainingCertificate.jpg"
 * that the backend treats as "no file".
 */
function sectionFormData(emoduleId, section, actionBy) {
  const fd = new FormData();
  fd.append("emoduleId", String(emoduleId));
  if (actionBy) fd.append("actionBy", String(actionBy));
  fd.append("section", section.name);
  fd.append("lecturelist", section.lectures.map((l) => l.name).join(","));

  const placeholder = () =>
    new File([""], "TrainingCertificate.jpg", { type: "image/jpeg" });
  section.lectures.forEach((l) =>
    fd.append("materialVideoList", l.video ?? placeholder())
  );
  section.lectures.forEach((l) =>
    fd.append("materialFileList", l.file ?? placeholder())
  );
  fd.append(
    "udemyLinkList",
    section.lectures.map((l) => (l.link?.trim() ? l.link.trim() : "NA")).join(",")
  );
  return fd;
}

/**
 * Adds one **new** section with its lectures' videos / files / links.
 *
 * `/emodule/section/save` only ever inserts: it takes no section id and writes
 * a fresh section row plus a fresh lecture row per name it is sent. Sending an
 * already-saved section here is what used to leave a module holding the
 * original section and a near-identical copy of it — editing one goes through
 * `updateSection` instead.
 *
 * @param {number|string} emoduleId
 * @param {{name: string, lectures: Array}} section
 */
export async function saveSection(emoduleId, section, actionBy) {
  // Let the browser set the multipart boundary — do not pin Content-Type here.
  const res = await api.post(
    "/emodule/section/save",
    sectionFormData(emoduleId, section, actionBy)
  );
  unwrap(res);
}

/**
 * The leading run of lectures carrying a freshly picked file of `kind`
 * ("video" or "file") — i.e. how many material parts `updateSection` may send.
 *
 * `/emodule/section/update` walks the section's saved lectures in order and
 * overwrites the material of every position it was sent a part for. There is no
 * "leave this one alone" part: the placeholder the insert path reads as "no
 * file" is stored verbatim here. So the parts have to be an unbroken run
 * starting at the first lecture — one meant for lecture 3 would flatten 1 and 2
 * on its way there — and sending none at all is what keeps every existing
 * upload where it is.
 *
 * @param {Array<{video?: File|null, file?: File|null}>} lectures
 * @param {"video"|"file"} kind
 * @returns {number}
 */
export function pickedMaterialRun(lectures, kind) {
  let n = 0;
  while (n < lectures.length && lectures[n][kind]) n += 1;
  return n;
}

/**
 * Rewrites one saved section in place — its name, and its lectures' names,
 * links and (when re-attached) material.
 *
 * Unlike `saveSection` this touches no rows but the ones the section already
 * has, so lecture ids survive and the assignment questions and learner progress
 * hanging off them stay attached.
 *
 * Two limits come from the endpoint itself. It walks the lectures the section
 * already has, so the list sent must be exactly that long — it cannot add or
 * drop one. And material is positional; see `pickedMaterialRun`.
 *
 * @param {number|string} emoduleId
 * @param {{id: number, name: string, lectures: Array}} section
 */
export async function updateSection(emoduleId, section, actionBy) {
  const fd = new FormData();
  fd.append("emoduleId", String(emoduleId));
  fd.append("sectionId", String(section.id));
  fd.append("section", section.name);
  if (actionBy) fd.append("actionBy", String(actionBy));

  section.lectures.forEach((l) => fd.append("lecturelist", l.name));
  // A blank link goes as a space rather than "": Spring hands a single-element
  // list back as one string and splits it on commas, and splitting "" yields no
  // element at all — which would leave the old link sitting there. A space
  // survives that trip, is trimmed on the way in, and reads back as no link.
  section.lectures.forEach((l) =>
    fd.append("udemyLinkList", l.link?.trim() ? l.link.trim() : " ")
  );

  const videos = pickedMaterialRun(section.lectures, "video");
  for (let i = 0; i < videos; i += 1) {
    fd.append("materialVideoList", section.lectures[i].video);
  }
  const files = pickedMaterialRun(section.lectures, "file");
  for (let i = 0; i < files; i += 1) {
    fd.append("materialFileList", section.lectures[i].file);
  }

  unwrap(await api.put("/emodule/section/update", fd));
}

/**
 * Takes the uploaded video off one saved lecture. The row and its link stay;
 * only the material path is cleared, which `updateSection` has no way to do —
 * every part it sends puts a file on.
 */
export async function clearLectureVideo(lectureId) {
  unwrap(await api.delete("/emodule/lecture/video/delete", {
    params: { id: lectureId },
  }));
}

/** The same for a lecture's uploaded file (PDF, Excel, image). */
export async function clearLectureFile(lectureId) {
  unwrap(await api.delete("/emodule/lecture/file/delete", {
    params: { id: lectureId },
  }));
}

/**
 * Saves one assignment (pre-test) question. A module needs at least one of
 * these or `/emodule/mail` refuses to submit it.
 */
export async function saveQuizQuestion({
  emoduleId,
  sectionId,
  lectureId,
  name,
  options,
  answer,
  regBy,
}) {
  const { regDate, regTime } = nowStamp();
  unwrap(
    await sendForm("/quiz/save", {
      emoduleId,
      sectionId,
      // Which lecture the question is about. Omitted leaves it against the
      // section as a whole, which is how every older question is stored.
      lectureId,
      quaName: name,
      quaType: "PRE",
      optionsOne: options[0],
      optionsTwo: options[1],
      optionsThree: options[2],
      optionsFour: options[3],
      quaAnswer: String(answer),
      regBy,
      regDate,
      regTime,
      status: "1",
    })
  );
}

/**
 * One section's assignment questions **with the answer key**, for the officer's
 * editor.
 *
 * Deliberately separate from `AssignmentService.getAssignmentQuestions`, which
 * strips `quaAnswer` so the correct option never reaches an employee's browser.
 * Here the officer is the one setting that key, so it has to come through.
 *
 * @param {number|string} emoduleId
 * @param {number|string} sectionId
 */
export async function getSectionQuestions(emoduleId, sectionId) {
  const list =
    unwrap(
      await api.get("/quiz/list", {
        // lowercase "id" — the backend's @RequestParam name.
        params: { emoduleid: emoduleId, sectionId, examType: "PRE" },
      }),
      []
    ) ?? [];

  return list
    .filter((q) => q.id != null)
    .map((q) => ({
      id: q.id,
      name: clean(q.quaName),
      options: [q.optionsOne, q.optionsTwo, q.optionsThree, q.optionsFour].map(clean),
      // The stored key is the option's 1-based ordinal; 0 means none marked.
      answer: Number(q.quaAnswer) || 0,
      lectureId: q.lectureId ?? null,
    }));
}

/** Rewrites one existing question — text, options, answer key and lecture. */
export async function updateQuizQuestion({
  id,
  lectureId,
  name,
  options,
  answer,
  regBy,
}) {
  unwrap(
    await sendForm(
      "/quiz/update",
      {
        id,
        lectureId,
        quaName: name,
        optionsOne: options[0],
        optionsTwo: options[1],
        optionsThree: options[2],
        optionsFour: options[3],
        quaAnswer: String(answer),
        regBy,
      },
      "put"
    )
  );
}

/** Removes one question. The employees' saved answers are left as they are. */
export async function deleteQuizQuestion(id) {
  unwrap(await api.get("/quiz/delete", { params: { id } }));
}

const SUBMIT_OK = "Training Module Added Successfully";

/**
 * Final submit → `/emodule/mail`, which validates that at least one section and
 * one assignment exist, flips the module to submitted (status 1), and notifies
 * the matching employees.
 *
 * Success is signalled by `response === "Training Module Added Successfully"`;
 * any other string is the backend's rejection reason.
 */
export async function submitModule({ emoduleId, regards, deptIds, gradeIds }) {
  const response = unwrap(
    await sendForm("/emodule/mail", {
      emoduleId,
      regards,
      status: "1",
      "gradeIdList[]": gradeIds,
      "deptIdList[]": deptIds,
    })
  );
  if (response !== SUBMIT_OK) {
    throw new Error(
      response || "Please add at least one section before submitting."
    );
  }
}

/**
 * Direct URL to a lecture's uploaded material (PDF or video).
 *
 * `emoduleId` is optional and only helps the backend find the file: materials
 * used to be stored flat under material/ and are now stored per module under
 * material/files/<id>/, so the path recorded against an older lecture no longer
 * leads anywhere. `/trainingMaterial/file` falls back to searching for the name,
 * and the module id is what lets it look in one folder instead of all of them.
 *
 * @param {string} path the stored material path, passed through untouched
 * @param {number|string} [emoduleId]
 */
export function materialUrl(path, emoduleId) {
  const name = String(path ?? "").split(/[\\/]/).pop() || "file.pdf";
  const query = [
    `file_name=${encodeURIComponent(name)}`,
    `file_path=${encodeURIComponent(path)}`,
  ];
  if (emoduleId != null && String(emoduleId).trim() !== "") {
    query.push(`emodule_id=${encodeURIComponent(emoduleId)}`);
  }
  return `${getApiUrl("/trainingMaterial/file")}?${query.join("&")}`;
}
